# CLAUDE.md — dvla_idp_backend

DVLA IDP/ICMV issuance system — backend API. Node 20 + Express 5 + Prisma (PostgreSQL),
TypeScript. Compiles `src/` → `dist/`, entry `dist/index.js`, listens on `PORT` (default 5000),
all routes mounted under `/api`. Serves uploaded files from `/uploads`.

## Database — migrations only

- **Never use `prisma db push` and never run raw DDL/DML against the database.** Schema changes
  go through Prisma **migrations**.
- Create a migration locally: `npm run db:migrate` (`prisma migrate dev --name <change>`),
  then commit `prisma/migrations/**`.
- Apply in deployment: `npm run db:deploy` (`prisma migrate deploy`). The Docker `entrypoint.sh`
  runs this automatically on container start.
- Initial/demo data is created by `prisma/seed.ts` (run via `npm run db:seed`). This goes through
  the Prisma client (not raw SQL) and is the sanctioned data-init path. It is idempotent (upsert)
  and seeds offices, roles/permissions, default users, and demo records.

## Environment variables

The app loads `dotenv` only when `NODE_ENV !== production`; in production all variables come from
the container environment. Required: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`,
`AUDIT_ENCRYPTION_KEY` (**exactly 32 chars in prod**), `PORT`, `FRONTEND_URL` (single CORS origin),
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. See `deploy/.env.example`.
Email (login OTPs, notifications) is sent via nodemailer; in pre-live it points at Mailpit.

## Deployment (pre-live)

Containerised stack lives in `deploy/` and is documented in the deploy plan. Images are **built on
the server** (no CI/registry). See `deploy/docker-compose.yml` and `deploy/Caddyfile`.

- `Dockerfile` builds the API image (`npm ci` → `prisma generate` → `tsc`); `entrypoint.sh` runs
  `prisma migrate deploy` then starts the server.
- URLs: API → `https://api.dvla.3dt.com.gh`. Postgres + Mailpit are internal-only (not exposed).

## CI/CD (pre-live)

Push to `master` auto-deploys via `.github/workflows/deploy-prelive.yml`, which runs on a
**self-hosted GitHub Actions runner on the Hetzner box** (GitHub-hosted runners are over quota;
self-hosted minutes are free). The workflow rsyncs the checkout into `/opt/dvla/backend`, copies
`deploy/docker-compose.yml` to `/opt/dvla`, runs `docker compose up -d --build backend` (image
built on the box), and health-checks `https://api.dvla.3dt.com.gh/health`. Migrations apply
automatically via `entrypoint.sh`. Manual run: the workflow's "Run workflow" (workflow_dispatch).
The Caddyfile on the box is never overwritten by CI (it holds the Mailpit basic-auth hash).

## Tooling

- `npm run lint` (ESLint flat config), `npm run format` (Prettier).
- Husky pre-commit runs `lint-staged` (eslint --fix + prettier on staged files). Husky is skipped
  in Docker builds via `HUSKY=0` / `prepare: "husky || true"`.

## Conventions

- Keep commit messages clean and human-authored — no AI/assistant attribution or co-author trailers.
- Do not commit secrets. `.env` is gitignored; only `deploy/.env.example` is tracked.
