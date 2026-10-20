# Deploying for free: Vercel + Neon Postgres + your cPanel domains

Two Vercel projects from this one repo (both free), one shared Neon database:

| Project | Domain | `APP_SURFACE` |
|---|---|---|
| Public website | `veteranpowergroup.com` | `website` |
| Staff portal | `portal.veteranpowergroup.com` | `portal` |

## Run it on your PC first

```powershell
npm install
npm run db:local        # terminal 1: real local Postgres on port 5433 (leave running)
npx prisma migrate deploy   # first time only
npm run db:seed             # first time only, on an empty DB (or: node scripts/import-sqlite-export.cjs to load old data)
npm run dev:both        # terminal 2: website http://127.0.0.1:3002, portal http://127.0.0.1:3001
```

## 1. Free database (Neon)

1. Sign up at neon.tech, create a project (region closest to Nairobi, e.g. Frankfurt).
2. Copy **two** connection strings from the dashboard:
   - *Pooled* (host contains `-pooler`) → `DATABASE_URL` (append `&pgbouncer=true&connection_limit=1`)
   - *Direct* (toggle pooling off) → `DIRECT_URL`
3. Create the tables and copy your local data up (run on your PC with those two values in `.env`):
   ```powershell
   npx prisma migrate deploy
   node scripts/import-sqlite-export.cjs   # only if you want the current sample/prototype data
   ```
   For a clean start use `npm run db:seed` instead.

## 2. Push the code to GitHub

Create a **private** repo and push this folder (`.env`, `*.db`, and `All pics/` are already excluded).

## 3. Two Vercel projects

For each of the two surfaces: Vercel → Add New Project → import the repo, then set Environment Variables:

| Variable | Website | Portal |
|---|---|---|
| `APP_SURFACE` | `website` | `portal` |
| `DATABASE_URL`, `DIRECT_URL` | Neon strings | same |
| `PROTOTYPE_ADMIN_EMAIL`, `PROTOTYPE_ADMIN_PASSWORD`, `PROTOTYPE_SESSION_SECRET` | same values | same values |
| `STAFF_PORTAL_URL` | `https://portal.veteranpowergroup.com` | |
| `PUBLIC_SITE_URL` | `https://veteranpowergroup.com` | `https://veteranpowergroup.com` |

Use a fresh random `PROTOTYPE_SESSION_SECRET` (32+ chars) and a strong admin password for production.

## 4. Point your cPanel domains at Vercel (DNS only, nothing is uploaded to cPanel)

In each Vercel project: Settings → Domains → add the domain; Vercel shows the records. In cPanel → **Zone Editor**:

- `veteranpowergroup.com`: `A` record → `76.76.21.21`
- `portal` subdomain: `CNAME` → `cname.vercel-dns.com`

(Use the exact values Vercel displays.) Remove any conflicting existing `A`/`CNAME` for those names. SSL is automatic. **Email on the domain keeps working**: leave `MX`/mail records untouched.

## Limits to know

- Vercel's free (Hobby) plan is officially for non-commercial use. A company site is commercial, so for strict compliance use Vercel Pro ($20/mo), or host on Cloudflare Pages/Netlify/your cPanel Node.js app instead.
- Request bodies are capped at ~4.5MB (logo uploads are resized and fine). Neon free = 0.5GB storage.
- Old cPanel Node.js packaging (`npm run package:deploy`) still works for self-hosting, but needs the Postgres `DATABASE_URL` too.
