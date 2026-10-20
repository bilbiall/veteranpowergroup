// One-off: load prisma/sqlite-export.json (dumped from the old SQLite DB) into the current Postgres DB.
// Safe to re-run: skips rows when the table already has data.
const { PrismaClient, Prisma } = require("@prisma/client");
const fs = require("node:fs");
require("dotenv").config();
const p = new PrismaClient();
const models = Prisma.dmmf.datamodel.models;
const byName = Object.fromEntries(models.map((m) => [m.name, m]));
const dump = JSON.parse(fs.readFileSync("prisma/sqlite-export.json", "utf8"));

// FK scalar -> target model (only for fields owned by this model)
const fks = (m) => m.fields.filter((f) => f.kind === "object" && f.relationFromFields?.length).map((f) => ({ field: f.relationFromFields[0], target: f.type, required: f.isRequired }));
const order = [];
const seen = new Set();
const visit = (m, stack = new Set()) => {
  if (seen.has(m.name) || stack.has(m.name)) return;
  stack.add(m.name);
  for (const fk of fks(m)) if (fk.target !== m.name && fk.required) visit(byName[fk.target], stack);
  for (const fk of fks(m)) if (fk.target !== m.name && !fk.required) visit(byName[fk.target], stack);
  stack.delete(m.name);
  seen.add(m.name); order.push(m);
};
models.forEach((m) => visit(m));

const revive = (m, row) => {
  const out = { ...row };
  for (const f of m.fields) if (f.type === "DateTime" && out[f.name] != null) out[f.name] = new Date(out[f.name]);
  return out;
};

(async () => {
  for (const m of order) {
    const rows = (dump[m.name] ?? []).map((r) => revive(m, r));
    if (!rows.length) continue;
    const key = m.name[0].toLowerCase() + m.name.slice(1);
    if (await p[key].count()) { console.log(`skip ${m.name} (already has data)`); continue; }
    // null out optional FKs that point at not-yet-inserted rows (self refs / cycles), restore after
    const deferred = fks(m).filter((fk) => !fk.required && order.indexOf(byName[fk.target]) >= order.indexOf(m));
    const pk = m.fields.filter((f) => f.isId).map((f) => f.name);
    const patches = [];
    const clean = rows.map((r) => {
      const c = { ...r };
      for (const d of deferred) if (c[d.field] != null) { patches.push({ r, d }); c[d.field] = null; }
      return c;
    });
    await p[key].createMany({ data: clean });
    for (const { r, d } of patches) {
      const where = pk.length === 1 ? { [pk[0]]: r[pk[0]] } : null;
      if (where) await p[key].update({ where, data: { [d.field]: r[d.field] } });
    }
    console.log(`${m.name}: ${rows.length}`);
  }
})().finally(() => p.$disconnect());
