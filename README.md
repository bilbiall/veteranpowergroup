This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## App conventions

- Environment variables are parsed in `src/lib/env.ts`; keep local values in `.env` and update `.env.example` when adding configuration.
- Import the singleton Prisma client from `src/lib/prisma.ts`. Do not construct `PrismaClient` inside route handlers or server actions.
- Use `AppError` for expected failures and `runServerAction` for typed server-action results.
- Wrap route handlers with `withApiErrorHandling`, return data with `apiSuccess`, and let `apiFailure` normalize unexpected errors.
- Use `logger` for structured JSON logs. Never log passwords, connection strings, tokens, or full request bodies.

## Local prototype

The staff area uses temporary prototype authentication. The configured administrator can create individual staff accounts in **Settings → Staff accounts**, reset their passwords, and disable or re-enable access. Additional staff passwords are stored as salted scrypt hashes; the bootstrap administrator credential stays in the ignored `.env` file. The prototype does not include account recovery or fine-grained permissions: all active staff can use the same workspace modules. Do not expose this prototype publicly or use real customer data.

1. Copy `.env.example` to `.env` and set a private administrator email, a password with at least 8 characters, and a unique session secret with at least 32 characters. The app has no built-in staff credentials or session secret; startup fails if any are missing or invalid. Use a strong administrator password and keep this prototype local.
2. Initialize the local SQLite database with `npm run db:migrate`.
3. Add fictional starter data with `npm run db:seed`. The seed command is idempotent and uses the configured prototype email.
4. Start both services with `npm run dev:both`. The public website runs at `http://localhost:3002`; the separate staff portal runs at `http://localhost:3001`.

For production, build and start the services independently with `npm run build:website` / `npm run start:website` and `npm run build:portal` / `npm run start:portal`. Set `PUBLIC_SITE_URL` and `STAFF_PORTAL_URL` in `.env` to their deployed addresses. Each service only serves its own website or portal routes and redirects cross-surface requests to the other address.

The administrator configured in `.env` is bootstrapped by `npm run db:seed`. Sign in with that account to manage staff accounts in the settings page. Give each staff member their temporary password through a secure channel; they should use an agreed password manager or your organization’s process to store it.

Local database files are ignored by Git. Currency, tax, document numbering, company details, roles, and statuses are placeholders until business requirements are confirmed. PostgreSQL and production identity integration are not configured.

Open a saved quotation, invoice, or receipt with **View & download**. Its detail page offers Word (`.docx`), Excel (`.xlsx`), and PDF downloads generated from the saved record. Export endpoints require a signed-in prototype session.

Useful checks:

```bash
npm run lint
npm run typecheck
npm run db:format
npm run db:validate
npm run db:generate
npm run db:migrate
```

The health check is available at `/api/health` and verifies the database connection.

The public site has separate Power, Solar, and Borehole solution pages, an enquiry form that creates staff follow-ups in **Prospects**, and a live portfolio populated from published staff entries. Website analytics record page paths and referrer host names; they do not store visitor IP addresses. In the staff portal, **Reports → Download all** (also available in the sidebar) exports Reports, Findings, Analytics, Prospects, Receipts, Quotations, and Invoices into one authenticated Excel workbook.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3002](http://localhost:3002) for the public website, or [http://localhost:3001](http://localhost:3001) for the staff portal.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
