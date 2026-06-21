# EventFilm Deployment Readiness

Use this checklist before handing EventFilm to beta hosts. Do not commit real secrets and do not submit mobile builds to app stores from this workflow.

## Production Configuration

Replace placeholders before deployment:

```env
CLIENT_URL="https://your-eventfilm-domain.com"
SERVER_URL="https://api.your-eventfilm-domain.com"
VITE_API_URL="https://api.your-eventfilm-domain.com"
EXPO_PUBLIC_API_URL="https://api.your-eventfilm-domain.com"
```

Backend required values:

- `DATABASE_URL`
- `NODE_ENV=production`
- `JWT_SECRET`
- `ANALYTICS_SALT`
- `CLIENT_URL`
- `SERVER_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `MAX_FILE_SIZE_MB`
- `PORT`

Frontend required value:

- `VITE_API_URL`

Mobile required values:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_RELEASE_CHANNEL`

`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `JWT_SECRET`, and `ANALYTICS_SALT` must stay server-side only.

## Deployment Checklist

- Web client: deploy `client/`, run `npm run build`, and set `VITE_API_URL` to the deployed API base URL with no `/api` suffix.
- API server: deploy `server/`, run `npm run build`, and start with `npm start`.
- Prisma client: confirm the server build or `prestart` ran `prisma generate`.
- Database migrations: run `npm run prisma:deploy -w server` against the production database.
- Supabase storage: create a private bucket named by `SUPABASE_STORAGE_BUCKET`; do not make the bucket public.
- Supabase project: confirm the project is active/unpaused before treating upload `fetch failed` errors as app bugs.
- CORS: set `CLIENT_URL` to the exact deployed web origin. Localhost variants are allowed only outside production.
- Auth/session: create a beta host, sign in on web and mobile, then refresh to confirm the token-backed session survives reload.
- Public routes: verify `/e/:slug`, `/wall/:slug`, and `/recap/:slug` load from deployed web and call the deployed API.
- Analytics: confirm `host_dashboard_opened`, `guest_joined_event`, `photo_upload_succeeded`, `live_wall_opened`, and `recap_opened` write without blocking the user flow.
- EAS env: replace the `https://api.your-eventfilm-domain.com` placeholder with the actual deployed API URL before sharing preview/production builds.

## Post-Deploy Smoke

Run the checks from the repo root:

```bash
npm run preflight
```

When local or deployed web/API URLs are reachable:

```bash
npm run demo:seed
$env:EVENTFILM_WEB_URL="http://localhost:5173"
$env:EVENTFILM_API_URL="http://localhost:4000"
npm run smoke:browser
npm run demo:cleanup
```

For real Supabase storage smoke:

```bash
npm run demo:seed
$env:STORAGE_SMOKE_API_URL="http://localhost:4000"
npm run smoke:storage
npm run demo:cleanup
```

Use the deployed API URL for `STORAGE_SMOKE_API_URL` when testing deployed infrastructure. The smoke script signs in as the demo host, uploads a tiny PNG through the public guest API, verifies the database photo record, file and preview routes, guest album, Live Wall, Recap, feature/unfeature, guest report, hide/restore moderation, event analytics summary, and cleanup. It prints whether required env vars are present, but never prints service keys, tokens, or secrets.

The default smoke event is `eventfilm-beta-demo-storage-smoke`, created by `npm run demo:seed`. It is intentionally revealed so public album and Recap routes should include the uploaded test photo. If upload fails with `fetch failed`, first confirm the API URL is reachable and the Supabase project is unpaused.

## Mobile Beta Rehearsal

Local simulator or Expo Go against local API:

```env
EXPO_PUBLIC_API_URL="http://localhost:4000"
EXPO_PUBLIC_RELEASE_CHANNEL="development"
```

Physical phone against local API:

```env
EXPO_PUBLIC_API_URL="http://192.168.1.25:4000"
EXPO_PUBLIC_RELEASE_CHANNEL="development"
```

Preview or production candidate:

```env
EXPO_PUBLIC_API_URL="https://api.your-eventfilm-domain.com"
EXPO_PUBLIC_RELEASE_CHANNEL="preview"
```

Build rehearsal only:

```bash
cd apps/mobile
npx eas-cli@latest build --profile preview --platform all
npx eas-cli@latest build --profile production --platform all
```

Do not run EAS submit or app-store submission commands. Before public store submission, replace the app icon, splash, screenshots, privacy URL, support URL, and final app name if needed.

Verify the build can sign in, create an event, copy/share the guest link, open the Live Wall link, open the Recap link, view analytics summary, and moderate photos.

## Beta Metrics

- Active host: a signed-in host who opens the host dashboard in the last 30 days.
- Guest join: a guest upload route visit that records `guest_joined_event`.
- Photo upload: a successfully stored event photo that has not been deleted.
- Live Wall open: a Live Wall route visit that records `live_wall_opened`.
- Recap open: a Recap route visit that records `recap_opened`.
- Beta MAU: count distinct active hosts plus distinct anonymous guest hashes in the last 30 days. Use this as directional beta signal, not a public usage claim.

## Rollback Notes

- Web rollback: redeploy the last known-good Vercel deployment for `client/`.
- API rollback: redeploy the last known-good server build and confirm `SERVER_URL` still points at it.
- Database rollback: prefer forward fixes. Do not manually reverse production migrations unless a tested rollback migration exists.
- Storage rollback: hide problematic photos first; permanent deletion should be limited to cleanup or clear abuse.
- Mobile rollback: stop distributing the bad internal build and create a new preview build with the previous working commit or EAS env values.
