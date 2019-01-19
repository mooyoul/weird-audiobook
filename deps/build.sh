#!/bin/bash

# Variables
DIRNAME="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NUM_CPU_CORES="$(cat /proc/cpuinfo | grep processor | wc -l)"
WORKSPACE_DIR="/tmp/workspace"
DIST_DIR="${DIRNAME}"
FFMPEG_WORKSPACE_DIR="${WORKSPACE_DIR}/ffmpeg"

echo "${NUM_CPU_CORES} cores detected."

# Setup compilation flags
export MAKEFLAGS="-j${NUM_CPU_CORES}"

# Prepare ffmpeg Workspace
FFMPEG_SOURCE_DIR="${FFMPEG_WORKSPACE_DIR}/ffmpeg_sources"
FFMPEG_BUILD_DIR="${FFMPEG_WORKSPACE_DIR}/ffmpeg_build"
FFMPEG_BIN_DIR="${FFMPEG_WORKSPACE_DIR}/bin"


# If any command exited without code 0, Fire ERR signal and stop executing remaining lines
set -e

# Setup signal traps
trap 'echo "Line ${BASH_LINENO}: ${BASH_COMMAND} failed with exit code $?"; cleanup failed; exit 1' ERR
trap 'echo "received signal to stop"; cleanup interrupted; exit 1' SIGQUIT SIGTERM SIGINT
function cleanup() {
  rm -rf ${WORKSPACE_DIR}
}

echo "Cleaning workspace"
cleanup

echo "Creating ffmpeg workspace directory"
mkdir -p ${FFMPEG_SOURCE_DIR} ${FFMPEG_BUILD_DIR} ${FFMPEG_BIN_DIR}

echo "Created ffmpeg workspace directories."

cd ${WORKSPACE_DIR}

# Install nasm
which nasm || (yum install -y nasm || true)

# Install yasm
which yasm || (yum install -y yasm || true)

yum clean all

# Update PATH

export PATH="${FFMPEG_BIN_DIR}:${PATH}"
echo "PATH: $PATH"

# Build LAME
pushd ${FFMPEG_SOURCE_DIR}
LAME_VERSION="3.100"
curl -O -L "http://downloads.sourceforge.net/project/lame/lame/${LAME_VERSION}/lame-${LAME_VERSION}.tar.gz"
tar xzvf "lame-${LAME_VERSION}.tar.gz"
cd "lame-${LAME_VERSION}"
./configure --prefix="${FFMPEG_BUILD_DIR}" --bindir="${FFMPEG_BIN_DIR}" --disable-shared --enable-nasm
make
make install
popd

# Finally, Build FFmpeg
pushd ${FFMPEG_SOURCE_DIR}
# Snapshot build
# curl -O -L https://ffmpeg.org/releases/ffmpeg-snapshot.tar.bz2
# tar xjvf ffmpeg-snapshot.tar.bz2
# cd ffmpeg

# Stable build
FFMPEG_VERSION="4.1"
curl -O -L "http://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.bz2"
tar xjvf "ffmpeg-${FFMPEG_VERSION}.tar.bz2"
cd "ffmpeg-${FFMPEG_VERSION}"
PKG_CONFIG_PATH="${FFMPEG_BUILD_DIR}/lib/pkgconfig" ./configure \
  --prefix="${FFMPEG_BUILD_DIR}" \
  --pkg-config-flags="--static" \
  --extra-cflags="-I${FFMPEG_BUILD_DIR}/include" \
  --extra-ldflags="-L${FFMPEG_BUILD_DIR}/lib" \
  --extra-libs=-lpthread \
  --extra-libs=-lm \
  --bindir="${FFMPEG_BIN_DIR}" \
  --disable-ffplay \
  --enable-openssl \
  --enable-libmp3lame \
  --disable-doc
make
make install
hash -r
popd

# Save ffmpeg binary
mkdir -p ${DIST_DIR}
cp ${FFMPEG_BIN_DIR}/ffmpeg-${FFMPEG_VERSION}-amazonlinux-amd64 ${DIST_DIR}
cp ${FFMPEG_BIN_DIR}/ffprobe-${FFMPEG_VERSION}-amazonlinux-amd64 ${DIST_DIR}
