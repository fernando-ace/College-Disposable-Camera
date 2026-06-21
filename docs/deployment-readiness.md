# EventFilm Deployed Beta Release Candidate

Use this runbook before Fernando gives EventFilm to first beta hosts. Do not commit secrets, do not publish app-store builds from this workflow, and do not record deployed smoke success until the deployed commands pass against real deployed URLs.

## Deployment Targets

EventFilm is provider-flexible:

- Web: Vercel or similar, rooted at `client/`.
- API: Railway, Render, Fly.io, or similar, rooted at `server/`.
- Database: the current configured PostgreSQL provider.
- Photo storage: Supabase Storage private bucket.
- Mobile preview: EAS internal/preview build from `apps/mobile/`.

## Environment Values

Local development:

```env
CLIENT_URL="http://localhost:5173"
SERVER_URL="http://localhost:4000"
WEB_PUBLIC_URL="http://localhost:5173"
API_PUBLIC_URL="http://localhost:4000"
CLIENT_ORIGINS=""
VITE_API_URL="http://localhost:4000"
EXPO_PUBLIC_API_URL="http://localhost:4000"
EXPO_PUBLIC_RELEASE_CHANNEL="development"
```

Preview deployment:

```env
NODE_ENV="production"
WEB_PUBLIC_URL="https://preview.your-eventfilm-domain.com"
API_PUBLIC_URL="https://api-preview.your-eventfilm-domain.com"
CLIENT_ORIGINS="https://preview.your-eventfilm-domain.com"
VITE_API_URL="https://api-preview.your-eventfilm-domain.com"
EXPO_PUBLIC_API_URL="https://api-preview.your-eventfilm-domain.com"
EXPO_PUBLIC_RELEASE_CHANNEL="preview"
```

Production candidate:

```env
NODE_ENV="production"
WEB_PUBLIC_URL="https://your-eventfilm-domain.com"
API_PUBLIC_URL="https://api.your-eventfilm-domain.com"
CLIENT_ORIGINS="https://your-eventfilm-domain.com"
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

`CLIENT_URL` and `SERVER_URL` still work for existing hosts. `WEB_PUBLIC_URL` and `API_PUBLIC_URL` are aliases for the same public values. `CLIENT_ORIGIN` or comma-separated `CLIENT_ORIGINS` can add allowed CORS origins for preview domains.

Production startup fails if required database/storage config is missing, if production public URLs point at localhost or non-HTTPS, if wildcard CORS is configured, if `JWT_SECRET` uses the dev fallback, or if production secrets are too short.

## Deploy Sequence

1. Deploy the API service from `server/`.
2. Set server env values, keeping all secrets server-side.
3. Run migrations against the target database:

```bash
npm run prisma:deploy -w server
```

4. Confirm the Supabase private bucket named by `SUPABASE_STORAGE_BUCKET` exists and the project is active.
5. Deploy the web client from `client/` with `VITE_API_URL` pointing at the deployed API base URL, no `/api` suffix.
6. Create or seed a safe smoke host and event in the target environment.
7. Run deployed smoke commands from the repo root.

## Deployed Smoke

Required URL env:

```powershell
$env:DEPLOYED_API_URL="https://api.your-eventfilm-domain.com"
$env:DEPLOYED_WEB_URL="https://your-eventfilm-domain.com"
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

`smoke:deployed:api` verifies API health, analytics write, optional host-auth database route, guest event route, guest upload route shell, Live Wall, and Recap. If the event slug or host credentials are missing, it prints documented skips rather than pretending full coverage passed.

`smoke:deployed:browser` runs the Playwright browser smoke against `DEPLOYED_WEB_URL` or `BROWSER_SMOKE_BASE_URL`, using `DEPLOYED_API_URL` for API checks.

`smoke:deployed:storage` reuses the real storage smoke. It uploads a tiny PNG through the deployed guest API, verifies DB record, file/preview routes, guest album, Live Wall, Recap, feature/unfeature, report, hide/restore, analytics summary, and cleanup. Run it only against a safe target event.

If no deployed URLs are configured, deployed smoke commands must fail with clear missing-env output. That is expected during local validation.

## Safe Target Data

For local development, `npm run demo:seed` creates dev-only demo events and `npm run demo:cleanup` removes them. For deployed preview/production candidates, do not run the dev-only seed blindly unless the target environment is intended for smoke data. Preferred options:

- Create a dedicated smoke host in the deployed app.
- Create one revealed event named clearly for smoke testing.
- Set `DEPLOYED_SMOKE_EVENT_SLUG` to that event.
- Run storage smoke, then confirm cleanup removed the uploaded test photo.

## Mobile Preview Build

Keep `EXPO_PUBLIC_API_URL` as the Expo public API base URL. It is bundled into the app and must never contain secrets.

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
npm run test:shared
npm run check:shared
npm run check:api-client
npm run test -w @eventfilm/api-client
npm run check:web
npm run check:api
npm run check:mobile
npm run lint:mobile
npm run build:web
npm run check
npm exec -w server -- prisma migrate status --schema prisma/schema.prisma
npm run demo:seed
npm run smoke:browser
npm run smoke:storage
npm run demo:cleanup
npm run preflight
git diff --check
git diff --cached --check
```

For local storage smoke on Windows:

```powershell
$env:STORAGE_SMOKE_API_URL="http://localhost:4000"
npm run smoke:storage
```

## Rollback Notes

- Web: redeploy the last known-good web deployment.
- API: redeploy the last known-good server build and re-run API health.
- Database: prefer forward fixes; do not hand-edit production data as rollback.
- Storage: hide problematic photos first; reserve permanent delete for cleanup or abuse.
- Mobile: stop distributing the bad internal build and create a new preview build with corrected env values.
