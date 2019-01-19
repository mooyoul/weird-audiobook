import * as mkdirp from "mkdirp";
import * as rimraf from "rimraf";

export async function setup(workspaceDir: string) {
  // cleanup workspace
  await new Promise<void>((resolve, reject) => {
    rimraf(workspaceDir, (e) => {
      if (e) { return reject(e); }
      resolve();
    });
  });

  // create workspace
  await new Promise<void>((resolve, reject) => {
    mkdirp(workspaceDir, (e) => {
      if (e) { return reject(e); }

      resolve();
    });
  });
}
