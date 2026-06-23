# EventFilm Deployed Beta Release Candidate

Use this runbook before Fernando gives EventFilm to first beta hosts. Do not commit secrets, do not publish app-store builds from this workflow, and do not record deployed smoke success until the deployed commands pass against real deployed URLs.

## Deployment Targets

Current beta inventory:

- Web: Vercel, rooted at `client/`. The current public beta frontend is `https://eventfilm.vercel.app`.
- API: confirm the real host before smoke. Railway is the default documented target, rooted at `server/`; Render or Fly.io can also work if they use the same build/start/env contract.
- Database: hosted PostgreSQL through `DATABASE_URL`.
- Photo storage: Supabase Storage private bucket named by `SUPABASE_STORAGE_BUCKET`.
- Mobile preview: EAS internal/preview build from `apps/mobile/`.

No real deployed API URL is committed in this repo. Do not claim deployed smoke success until Fernando provides or configures the real API URL in the shell/provider environment.

## Production Beta Launch Gate

Use this as the single release gate before inviting the first beta host. Keep secrets in provider environments only; do not commit host credentials, Supabase keys, salts, database URLs, or private provider URLs.

Vercel web:

- Web URL: `https://eventfilm.vercel.app/`.
- Project root remains `client/`.
- Node.js Version is `22.x`.
- Install command must not include `--omit=optional` or `--no-optional`; if a custom install command is needed, use optional dependencies explicitly.
- Clear Build Cache after any native optional dependency change.
- Confirm the latest intended commit is deployed.
- Confirm the web build is green.
- Confirm `VITE_API_URL` points at the deployed Railway API base URL with no `/api` suffix.

Railway API:

- Confirm the API deploy is green and rooted at `server/`.
- Confirm production env includes `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `ANALYTICS_SALT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `WEB_PUBLIC_URL`, `API_PUBLIC_URL`, and `CLIENT_ORIGIN` or `CLIENT_ORIGINS`.
- Add `FOUNDER_EMAILS` only if founder dashboard access is needed; leave it empty to deny founder access safely.
- Generate `ANALYTICS_SALT` locally, then paste it into Railway without committing it:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- Confirm API health after deploy:

```powershell
$env:DEPLOYED_API_URL="https://<railway-api-url>"
npm run smoke:deployed:api
```

Supabase:

- Confirm the project is active/unpaused.
- Confirm the private bucket named by `SUPABASE_STORAGE_BUCKET` exists.
- Confirm the API has the Supabase URL, service role key, and bucket name in Railway only.
- Run upload smoke before inviting a host only when the target event is safe for test data and cleanup.
- If production cleanup is not safe, do a manual phone upload test and manually hide/delete or clearly mark the test event afterward.

Database:

- Check migration status before applying anything:

```bash
npm exec -w server -- prisma migrate status --schema prisma/schema.prisma
```

- Apply migrations only when the command reports pending migrations and `DATABASE_URL` is confirmed to target the intended production database:

```bash
npm run prisma:deploy -w server
```

- Do not run production migrations from Codex unless the target is explicitly configured and intentionally requested.

## Values Fernando Must Provide

Before real beta smoke can pass, Fernando needs to confirm these target-environment values:

- `API_PUBLIC_URL`: deployed HTTPS API base URL, no `/api` suffix.
- `WEB_PUBLIC_URL`: deployed HTTPS web URL, expected to be `https://eventfilm.vercel.app` unless a custom domain is active.
- `CLIENT_ORIGIN` or `CLIENT_ORIGINS`: deployed web origin plus any preview origins that should pass CORS.
- `VITE_API_URL`: same deployed API base URL for the web deployment.
- `EXPO_PUBLIC_API_URL`: same deployed API base URL for EAS preview builds.
- API provider/project identity: Railway project/service or the equivalent Render/Fly service.
- Supabase project and private bucket name, expected `event-photos` unless changed.
- Dedicated deployed smoke event slug.
- Dedicated deployed smoke host email/password, stored only in local shell or provider env while running smoke.

## Environment Values

Local development:

```env
CLIENT_URL="http://localhost:5173"
SERVER_URL="http://localhost:4000"
WEB_PUBLIC_URL="http://localhost:5173"
API_PUBLIC_URL="http://localhost:4000"
CLIENT_ORIGINS=""
FOUNDER_EMAILS="you@example.com"
VITE_API_URL="http://localhost:4000"
EXPO_PUBLIC_API_URL="http://localhost:4000"
EXPO_PUBLIC_RELEASE_CHANNEL="development"
```

LAN mobile development:

```env
CLIENT_URL="http://localhost:5173"
SERVER_URL="http://192.168.1.25:4000"
WEB_PUBLIC_URL="http://localhost:5173"
API_PUBLIC_URL="http://192.168.1.25:4000"
CLIENT_ORIGINS="http://localhost:5173"
FOUNDER_EMAILS="you@example.com"
VITE_API_URL="http://localhost:4000"
EXPO_PUBLIC_API_URL="http://192.168.1.25:4000"
EXPO_PUBLIC_RELEASE_CHANNEL="development"
```

Replace `192.168.1.25` with the machine's current LAN IP. Keep release channel as `development` for LAN testing.

Preview deployment:

```env
NODE_ENV="production"
WEB_PUBLIC_URL="https://preview.your-eventfilm-domain.com"
API_PUBLIC_URL="https://api-preview.your-eventfilm-domain.com"
CLIENT_ORIGINS="https://preview.your-eventfilm-domain.com"
FOUNDER_EMAILS="you@example.com"
VITE_API_URL="https://api-preview.your-eventfilm-domain.com"
EXPO_PUBLIC_API_URL="https://api-preview.your-eventfilm-domain.com"
EXPO_PUBLIC_RELEASE_CHANNEL="preview"
```

Production candidate:

```env
NODE_ENV="production"
WEB_PUBLIC_URL="https://eventfilm.vercel.app"
API_PUBLIC_URL="https://api.your-eventfilm-domain.com"
CLIENT_ORIGINS="https://eventfilm.vercel.app"
FOUNDER_EMAILS="you@example.com"
VITE_API_URL="https://api.your-eventfilm-domain.com"
EXPO_PUBLIC_API_URL="https://api.your-eventfilm-domain.com"
EXPO_PUBLIC_RELEASE_CHANNEL="production"
```

Backend secrets, server-only:

- `DATABASE_URL`
- `JWT_SECRET`
- `ANALYTICS_SALT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `MAX_FILE_SIZE_MB`
- `PORT`

Frontend public values:

- `VITE_API_URL`
- `VITE_BOOKING_SMS_URL`, optional

Mobile preview public values:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_RELEASE_CHANNEL`

`CLIENT_URL` and `SERVER_URL` still work for existing hosts. `WEB_PUBLIC_URL` and `API_PUBLIC_URL` are aliases for the same public values. `CLIENT_ORIGIN` or comma-separated `CLIENT_ORIGINS` can add allowed CORS origins for preview domains.

Production startup fails if required database/storage config is missing, if production public URLs point at localhost or non-HTTPS, if wildcard CORS is configured, if `JWT_SECRET` uses the dev fallback, or if production secrets are too short.

`FOUNDER_EMAILS` is a server-only comma-separated allowlist for `/dashboard/founder`. Only authenticated host accounts with a listed email can load the founder beta ops dashboard. Missing or empty values deny access safely. Do not commit real private founder emails; use examples such as `you@example.com` in docs and env templates.

## Founder Beta Ops Dashboard

After signing in with an allowlisted host account, open `/dashboard/founder`.

Use it to check:

- overview metrics: hosts, active hosts in the last 30 days, events, guest joins, uploads, contributors, Recap opens, Live Wall opens, feedback submissions, reports, and hidden photos.
- recent activity: event creation, guest joins, uploads, Live Wall/Recap opens, host feedback, reported photos, duplicate events, and Event Awards votes when tracked.
- founder inboxes: recent host feedback and read-only reported photo review.
- product usage: event modes, event templates, prompt packs, Event Awards votes, Color Hunt usage, and Memory Capsule usage.
- Unlock Alabama reporting: export the summarized CSV from the dashboard and report the metric definitions shown on the page.

The founder reported-photo section is intentionally read-only. Host-owned moderation remains in the existing event dashboard, and hidden photos are still not exposed through public photo routes.

## Provider Readiness

Use these commands only for inspection or deployment after the target project is known. Do not create paid resources, delete resources, rotate secrets, or print secret values from this workflow.

Vercel web from `client/`:

```bash
npx vercel@latest link
npx vercel@latest env pull
npx vercel@latest deploy
```

Vercel build settings:

- Use Node.js 22.x for the web deployment.
- Do not omit optional dependencies during install. Avoid install commands that use `--omit=optional` or `--no-optional`.
- If a custom install command is needed, make optional dependencies explicit, for example `npm install --include=optional`.
- The client package intentionally pins Linux native optional dependencies for Vercel: `@rolldown/binding-linux-x64-gnu` and `@tailwindcss/oxide-linux-x64-gnu`.
- After changing native optional dependencies, redeploy from Vercel with Clear Build Cache.

Railway API from `server/`:

```bash
npx @railway/cli@latest login
npx @railway/cli@latest link
npx @railway/cli@latest status
npx @railway/cli@latest up --service <api-service-name>
```

After deploy, confirm the Railway dashboard reports a green deploy and the API health route responds before running broader smoke. Keep `ANALYTICS_SALT`, `JWT_SECRET`, `DATABASE_URL`, and Supabase secrets in Railway variables only.

If the API host is Render or Fly.io instead, use the provider dashboard or CLI to set the same backend env values and confirm the service root is `server/`.

Supabase storage:

```bash
npx supabase@latest projects list
npx supabase@latest storage ls
```

The dashboard is safer for final confirmation: verify the project is active, the bucket named by `SUPABASE_STORAGE_BUCKET` exists, and the service role key is configured only on the API host.

EAS preview readiness:

```bash
cd apps/mobile
npx eas-cli@latest whoami
npx eas-cli@latest build:configure
npx eas-cli@latest build --profile preview --platform android
```

Run an iOS preview build only when Apple credentials are already available and the deployed API URL is real:

```bash
npx eas-cli@latest build --profile preview --platform ios
```

## Deploy Sequence

1. Deploy the API service from `server/`.
2. Set server env values, keeping all secrets server-side.
3. Check migration status against the target database:

```bash
npm exec -w server -- prisma migrate status --schema prisma/schema.prisma
```

4. Apply migrations only when pending migrations exist and `DATABASE_URL` is confirmed to target the intended deployed database:

```bash
npm run prisma:deploy -w server
```

5. Confirm the Supabase private bucket named by `SUPABASE_STORAGE_BUCKET` exists and the project is active.
6. Deploy the web client from `client/` with `VITE_API_URL` pointing at the deployed API base URL, no `/api` suffix.
7. Create or seed a safe smoke host and event in the target environment.
8. Run deployed smoke commands from the repo root.

## Deployed Smoke

Required URL env:

```powershell
$env:DEPLOYED_API_URL="https://api.your-eventfilm-domain.com"
$env:DEPLOYED_WEB_URL="https://eventfilm.vercel.app"
$env:DEPLOYED_SMOKE_EVENT_SLUG="eventfilm-beta-demo-storage-smoke"
```

Optional target-environment smoke credentials:

```powershell
$env:DEPLOYED_SMOKE_HOST_EMAIL="smoke-host@example.com"
$env:DEPLOYED_SMOKE_HOST_PASSWORD="target-environment-password"
```

Commands:

```bash
npm run smoke:deployed:api
npm run smoke:deployed:browser
npm run smoke:deployed:storage
npm run smoke:deployed:all
```

For the env-configured browser smoke path:

```powershell
$env:BROWSER_SMOKE_BASE_URL="https://eventfilm.vercel.app"
$env:BROWSER_SMOKE_API_URL="https://<railway-api-url>"
npm run smoke:browser
```

For local browser smoke:

```bash
npm run demo:seed
npm run smoke:browser
```

For local real upload browser smoke, run it only when the local API has safe storage config and cleanup:

```bash
ENABLE_GUEST_UPLOAD_BROWSER_SMOKE=1 npm run smoke:browser
```

For local storage smoke:

```powershell
$env:STORAGE_SMOKE_API_URL="http://localhost:4000"
npm run smoke:storage
```

For deployed storage smoke, run it only against a dedicated deployed smoke host and event:

```powershell
$env:DEPLOYED_API_URL="https://<railway-api-url>"
$env:DEPLOYED_SMOKE_EVENT_SLUG="<safe-deployed-smoke-event-slug>"
$env:DEPLOYED_SMOKE_HOST_EMAIL="smoke-host@example.com"
$env:DEPLOYED_SMOKE_HOST_PASSWORD="target-environment-password"
npm run smoke:deployed:storage
```

`smoke:deployed:api` verifies API health, analytics write, optional host-auth database route, guest event route, guest upload route shell, Live Wall, and Recap. If the event slug or host credentials are missing, it prints documented skips rather than pretending full coverage passed.

`smoke:deployed:browser` runs the Playwright browser smoke against `DEPLOYED_WEB_URL` or `BROWSER_SMOKE_BASE_URL`, using `DEPLOYED_API_URL` or `BROWSER_SMOKE_API_URL` for API checks.

Raw `npm run smoke:browser` also accepts `BROWSER_SMOKE_BASE_URL` and `BROWSER_SMOKE_API_URL` for deployed-style browser checks.

`smoke:deployed:storage` reuses the real storage smoke. It uploads a tiny PNG through the deployed guest API, verifies DB record, file/preview routes, guest album, Live Wall, Recap, feature/unfeature, report, hide/restore, analytics summary, and cleanup. Run it only against a safe target event.

If no deployed URLs are configured, deployed smoke commands must fail with clear missing-env output. That is expected during local validation.

Failure triage:

- Missing env: set the required `DEPLOYED_*` values in the shell and rerun.
- Wrong CORS: add the deployed web origin to `CLIENT_ORIGIN` or `CLIENT_ORIGINS` on the API host.
- API cannot reach DB: verify `DATABASE_URL`, database allowlist/networking, and migration status.
- API cannot reach Supabase: verify `SUPABASE_URL`, service role key, bucket name, and project pause status.
- Storage bucket issue: create or correct the private bucket named by `SUPABASE_STORAGE_BUCKET`.
- Migration not applied: run `npm run prisma:deploy -w server` against the target database.
- Web points to wrong API: update `VITE_API_URL` on Vercel and redeploy.
- Mobile points to wrong API: update `EXPO_PUBLIC_API_URL` in EAS env or `apps/mobile/eas.json` before the preview build.
- Auth/session issue: use a dedicated smoke host created in the deployed environment.
- Route mismatch: confirm the event slug is from the same deployed database as the API under test.

## Safe Target Data

For local development, `npm run demo:seed` creates dev-only demo events and `npm run demo:cleanup` removes them. For deployed preview/production candidates, do not run the dev-only seed blindly unless the target environment is intended for smoke data. Preferred options:

- Create a dedicated smoke host in the deployed app.
- Create one revealed event named clearly for smoke testing.
- Set `DEPLOYED_SMOKE_EVENT_SLUG` to that event.
- Run storage smoke, then confirm cleanup removed the uploaded test photo.

## Mobile Preview Build

Keep `EXPO_PUBLIC_API_URL` as the Expo public API base URL. It is bundled into the app and must never contain secrets.

Config validation:

```bash
cd apps/mobile
npx eas-cli@latest whoami
```

Preview build:

```bash
cd apps/mobile
npx eas-cli@latest build --profile preview --platform all
```

Production-candidate build rehearsal:

```bash
cd apps/mobile
npx eas-cli@latest build --profile production --platform all
```

Do not run `eas submit`, TestFlight submission, or Play Store submission from this beta readiness workflow.

Before giving the preview build to a beta host:

- Install the preview build on a phone.
- Sign in.
- Create an event.
- Share the guest link.
- Open the guest link in the phone browser.
- Upload a photo.
- Open Live Wall on a laptop.
- Open Recap.
- Hide, restore, feature, unfeature, and report a test photo.
- Verify analytics summary changes.
- Replace icon, splash, privacy URL, support URL, screenshots, and final app metadata before any public submission.

## Final Local Gate

Before deployment handoff:

```bash
git status --short
npm run test:shared
npm run test:server
npm run test -w @eventfilm/api-client
npm run check:web
npm run build:web
npm run check:mobile
npm run check
npm run smoke:browser
npm run smoke:storage
git diff --check
git diff --cached --check
```

Run `npm run smoke:storage` only when local storage env is configured and the target event is safe for cleanup. If not, skip it and run the deployed/manual storage smoke commands after the target environment is ready.

For local storage smoke on Windows:

```powershell
$env:STORAGE_SMOKE_API_URL="http://localhost:4000"
npm run smoke:storage
```

## Rollback Notes

- Web: redeploy the last known-good web deployment.
- API: redeploy the last known-good server build and re-run API health.
- Database: prefer forward fixes; do not hand-edit production data as rollback. Before any migration, check target status with `npm exec -w server -- prisma migrate status --schema prisma/schema.prisma`; apply with `npm run prisma:deploy -w server` only after confirming `DATABASE_URL` targets the intended deployed database.
- Storage: hide problematic photos first; reserve permanent delete for cleanup or abuse.
- Mobile: stop distributing the bad internal build and create a new preview build with corrected env values.
