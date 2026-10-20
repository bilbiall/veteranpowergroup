// Starts a real local PostgreSQL (no install needed) on port 5433 with data kept in .local-pg/
// Usage: npm run db:local   (leave it running while you develop; Ctrl+C to stop)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const dataDir = resolve(process.cwd(), ".local-pg");
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: "postgres", password: "postgres", port: 5433, persistent: true });

if (!existsSync(resolve(dataDir, "PG_VERSION"))) {
  await pg.initialise();
}
await pg.start();
try { await pg.createDatabase("sitesite"); } catch { /* already exists */ }
console.log("Local Postgres ready: postgresql://postgres:postgres@localhost:5433/sitesite");

const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
