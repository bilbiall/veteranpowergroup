# How to host this site (step by step)

Setup: two free Vercel projects from one repo (public website + staff portal), one shared Neon Postgres database, and your cPanel domains pointed at Vercel through DNS only.

All commands are PowerShell, run from `C:\xampp\htdocs\sitesite`.

What was verified: `tsc --noEmit` passes and `npm run build:website` completes. Not verified: the portal build, login, the WhatsApp button in a browser, and the live database connection. Do Step 0 before anything else.

## Step 0: Check it runs locally (5 min)

If `npm run dev:both` is already running, stop it with Ctrl+C first, then:

```powershell
npx prisma generate
npx prisma migrate deploy
npm run db:local
```
`npm run db:local` must stay open in its own terminal. In a second terminal:
```powershell
npm run dev:both
```
- Open http://127.0.0.1:3001/login (portal) and log in with the `PROTOTYPE_ADMIN_EMAIL` and `PROTOTYPE_ADMIN_PASSWORD` from your `.env`.
- Go to Settings, find **WhatsApp button**, enter the number (for example `0707 734 670`), edit the preset message if you want, and save.
- Open http://127.0.0.1:3002 (website). A green WhatsApp button should float at the bottom-right. Click it to check that WhatsApp opens with your message.

If any of this fails, stop and fix it before going further.

## Step 1: Create the free database (Neon)

1. Go to https://neon.tech and sign up.
2. Click **Create project**. Pick a region such as Frankfurt, and keep Postgres at its default version.
3. On the project dashboard, click **Connect**.
4. With **Connection pooling ON**, copy the string. It contains `-pooler` in the host. This is your pooled string.
5. Turn pooling **OFF** and copy the string again. This is your direct string.

Both strings look like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`. For the pooled one, add the extra parameters:
```
DATABASE_URL = <pooled string>&pgbouncer=true&connection_limit=1
DIRECT_URL   = <direct string>
```

## Step 2: Create the tables and admin user in Neon

Use temporary environment variables in the terminal so your local `.env` stays unchanged. Replace the placeholders:

```powershell
$env:DATABASE_URL = "<pooled string>&pgbouncer=true&connection_limit=1"
$env:DIRECT_URL = "<direct string>"
$env:PROTOTYPE_ADMIN_EMAIL = "you@yourdomain.com"
$env:PROTOTYPE_ADMIN_PASSWORD = "a-strong-password"
npx prisma migrate deploy
npm run db:seed
```

- `migrate deploy` applies both migrations: the baseline and `add_whatsapp_settings`.
- Seeding only works on an empty database. To load your existing prototype data instead, use `node scripts/import-sqlite-export.cjs` (check it works first; it is meant to load `prisma/sqlite-export.json`).
- **Every time you add a migration later, run `npx prisma migrate deploy` against Neon again.** Vercel does not do this for you.
- Close the terminal afterward so the variables are cleared.

## Step 3: Push the code to GitHub

1. Go to https://github.com/new, name it something like `sitesite`, set it to **Private**, and leave "Add README" unchecked. Click **Create**.
2. Run:

```powershell
git add -A
git status --short | Select-String "\.env$|\.db$"
```
The second command must print nothing. If it prints a `.env` or `.db` file, stop.

```powershell
git commit -m "Prepare for deployment"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/sitesite.git
git push -u origin main
```
The push may take a while because the repo is about 80MB of images. GitHub may ask you to log in.

## Step 4: Deploy the website on Vercel

1. Go to https://vercel.com and sign up with GitHub.
2. Click **Add New → Project** and import `sitesite`.
3. Leave **Framework Preset** as Next.js, and leave the build and install commands at their defaults.
4. Open **Environment Variables** and add these:

| Name | Value |
|---|---|
| `APP_SURFACE` | `website` |
| `DATABASE_URL` | pooled string with the extra parameters |
| `DIRECT_URL` | direct string |
| `PROTOTYPE_ADMIN_EMAIL` | same as Step 2 |
| `PROTOTYPE_ADMIN_PASSWORD` | same as Step 2 |
| `PROTOTYPE_SESSION_SECRET` | a random 32+ character string |
| `PUBLIC_SITE_URL` | `https://veteranpowergroup.com` |
| `STAFF_PORTAL_URL` | `https://portal.veteranpowergroup.com` |

To generate the session secret, run:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

5. Click **Deploy**.
6. When it finishes you get a link like `sitesite-xxx.vercel.app`. **You can share that link now**, even before the domain is connected.

## Step 5: Deploy the portal

1. Click **Add New → Project** and import the same repo again.
2. Give it a different project name, such as `sitesite-portal`.
3. Use the same environment variables as Step 4, but set `APP_SURFACE` to `portal`.
4. **Use the same `PROTOTYPE_SESSION_SECRET`** as the website.
5. Click **Deploy**.

## Step 6: Set the WhatsApp number on the live site

The seed does not set a WhatsApp number, so the button stays hidden until you do this.

1. Open the live portal (`sitesite-portal-xxx.vercel.app/login`, or `portal.veteranpowergroup.com/login` once DNS is done) and log in with the admin email and password.
2. Go to Settings → **WhatsApp button**, enter the number and preset message, and save.
3. Reload the live website. The green button should appear bottom-right.

## Step 7: Connect your domains

1. In the website project, go to **Settings → Domains**, add `veteranpowergroup.com`, and note the records Vercel shows.
2. In the portal project, add `portal.veteranpowergroup.com`.
3. Log in to cPanel and open **Zone Editor**, then click **Manage** on the domain.
4. Delete any existing `A` record for the bare domain, and any `CNAME` or `A` record for `portal`. Leave `MX` and mail records alone so email keeps working.
5. Add these records, using the exact values Vercel displays if they differ:
   - Type `A`, name `veteranpowergroup.com.`, address `76.76.21.21`
   - Type `CNAME`, name `portal.veteranpowergroup.com.`, record `cname.vercel-dns.com`
6. Wait 5 to 60 minutes. Vercel shows a green check when each record is valid, and SSL is issued automatically.
7. Open https://veteranpowergroup.com and https://portal.veteranpowergroup.com to confirm.

## Things to know

- **Hobby plan:** Vercel's free plan is for non-commercial use. A company site technically needs Pro at $20/mo (or use Cloudflare Pages, Netlify, or the cPanel Node.js app).
- **Changes after the first deploy:** run `git add -A`, `git commit -m "msg"`, then `git push`. Vercel redeploys on its own.
- **Database changes:** if you change the Prisma schema, create a migration, then run `npx prisma migrate deploy` against Neon (as in Step 2) **before** the deploy goes live.
- **Health check:** visit `yoursite/api/health` after deploying to see whether the database connects.
- **Limits:** request bodies are capped at about 4.5MB, and Neon's free tier gives 0.5GB of storage.
