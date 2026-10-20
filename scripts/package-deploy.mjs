// Builds each surface and assembles an upload-ready folder + zip for cPanel (Node.js App).
// Usage: node scripts/package-deploy.mjs [website|portal]   (default: both)
import { spawnSync } from "node:child_process";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDirs = { website: ".next-website", portal: ".next-portal" };
const requested = process.argv[2];
const surfaces = requested ? [requested] : ["website", "portal"];

for (const surface of surfaces) {
  if (!(surface in distDirs)) {
    console.error("Usage: node scripts/package-deploy.mjs [website|portal]");
    process.exit(1);
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
}

for (const surface of surfaces) {
  const distDir = distDirs[surface];
  const out = join(root, "deploy", surface);
  console.log(`\n=== Building ${surface} ===`);

  await rm(join(root, distDir), { recursive: true, force: true });
  await rm(out, { recursive: true, force: true });
  run(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "build"], {
    env: { ...process.env, APP_SURFACE: surface, NODE_ENV: "production" },
  });

  const standalone = join(root, distDir, "standalone");
  if (!existsSync(join(standalone, "server.js"))) {
    throw new Error(`No standalone server.js in ${standalone}; is output: "standalone" set?`);
  }

  await mkdir(out, { recursive: true });
  // Standalone output without its Windows node_modules: the server installs its own (Linux) ones.
  for (const entry of await readdir(standalone)) {
    if (entry === "node_modules" || entry === "package.json" || entry.endsWith(".db") || entry.startsWith(".env")) continue;
    await cp(join(standalone, entry), join(out, entry), {
      recursive: true,
      // Next links externals here to the local node_modules by absolute path; copied as real folders below.
      filter: (source) => resolve(source) !== resolve(standalone, distDir, "node_modules"),
    });
  }
  const externals = join(standalone, distDir, "node_modules");
  if (existsSync(externals)) {
    await cp(externals, join(out, distDir, "node_modules"), { recursive: true, dereference: true });
  }
  await cp(join(root, distDir, "static"), join(out, distDir, "static"), { recursive: true });
  await cp(join(root, "public"), join(out, "public"), { recursive: true });
  await cp(join(root, "prisma"), join(out, "prisma"), {
    recursive: true,
    filter: (source) => !/\.db(-journal)?$/.test(source),
  });
  await cp(join(root, "prisma.config.ts"), join(out, "prisma.config.ts"));
  await cp(join(root, "package.json"), join(out, "package.json"));
  await cp(join(root, "package-lock.json"), join(out, "package-lock.json"));

  const zip = join(root, "deploy", `${surface}.zip`);
  await rm(zip, { force: true });
  run(process.platform === "win32" ? join(process.env.SystemRoot, "System32", "tar.exe") : "tar", ["-a", "-c", "-f", zip, "-C", out, "."]);
  console.log(`Packaged ${surface}: ${zip}`);
}
