import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runner = resolve(root, "scripts/run-surface.mjs");
const children = ["website", "portal"].map((surface) =>
  spawn(process.execPath, [runner, surface, "dev"], { cwd: root, stdio: "inherit" }),
);

let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGINT");
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) {
  child.on("error", (error) => {
    console.error(error);
    stop();
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    if (code && !stopping) {
      process.exitCode = code;
      stop();
    }
  });
}
