# weird-audiobook toolchain directory

## What's this directory?

This directory contains programs which are cross-compiled binary of various software
to encode audio files 


## List of softwares

- SoX
- FFmpeg v4.1
  - with libmp3lame for better MP3 encoding quality
  - with openssl for https resource input/output

## How to build

First, Install Docker.
Just execute below command to build dependencies:  

```bash
$ docker run --rm -v $PROJECT_ROOT/deps:/remote-workspace -it lambci/lambda:build-nodejs8.10 /remote-workspace/build.sh
```

That's it! You'll see built binaries in this directory.

## Thanks

- FFmpeg - https://ffmpeg.org/
- SoX - http://sox.sourceforge.net/
- lambci/docker-lambda - https://github.com/lambci/docker-lambda/

