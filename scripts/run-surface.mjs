import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [surface, action] = process.argv.slice(2);

if (!["website", "portal"].includes(surface) || !["dev", "build", "start"].includes(action)) {
  console.error("Usage: node scripts/run-surface.mjs <website|portal> <dev|build|start>");
  process.exit(1);
}

const nextCli = resolve(root, "node_modules/next/dist/bin/next");
const port = process.env[surface === "website" ? "WEBSITE_PORT" : "PORTAL_PORT"]
  ?? (surface === "website" ? "3002" : "3001");
const args = action === "dev"
  ? [nextCli, "dev", "--hostname", "127.0.0.1", "--port", port]
  : action === "start"
    ? [nextCli, "start", "--hostname", "127.0.0.1", "--port", port]
    : [nextCli, "build"];

const child = spawn(process.execPath, args, {
  cwd: root,
  env: { ...process.env, APP_SURFACE: surface },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
