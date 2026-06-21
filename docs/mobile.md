# EventFilm Mobile App

EventFilm now has a workspace shape that supports the existing web app and a new Expo native app without moving production roots.

```text
client/              Vercel web app
server/              Express API and Prisma service
apps/mobile/         Expo React Native app, currently pinned to Expo SDK 54 for Expo Go compatibility
packages/shared/     Shared TypeScript types, constants, and challenge helpers
packages/api-client/ Shared fetch and multipart upload client
```

## Run Locally

Install from the repo root:

```bash
npm install
```

Start the API:

```bash
npm run dev:api
```

Start the web app:

```bash
npm run dev:web
```

Start the Expo app:

```bash
copy apps\mobile\.env.example apps\mobile\.env
npm run dev:mobile
```

`apps/mobile/.env` uses:

```env
EXPO_PUBLIC_API_URL="http://localhost:4000"
EXPO_PUBLIC_RELEASE_CHANNEL="development"
```

For a physical phone, `localhost` points at the phone, not your computer. Use your computer LAN address instead, for example:

```env
EXPO_PUBLIC_API_URL="http://192.168.1.25:4000"
```

For preview or production builds, set `EXPO_PUBLIC_API_URL` to the deployed API base URL, not a path under `/api`.
Set `EXPO_PUBLIC_RELEASE_CHANNEL` to `preview` or `production` only when the API URL points at deployed infrastructure. The app blocks release-like builds that still use localhost.

## Current Beta Configuration

- App name: `EventFilm`
- Slug: `eventfilm`
- Scheme: `eventfilm`
- iOS bundle identifier: `com.eventfilm.app`
- Android package identifier: `com.eventfilm.app`
- Version: `1.0.0`
- iOS build number: `1`
- Android version code: `1`
- Icon, splash, and adaptive icon assets live in `apps/mobile/assets/` and are placeholders that can be replaced before public store submission.
- Camera and photo-library permission copy is configured for event photo uploads.

The app is currently pinned to Expo SDK 54 for Expo Go compatibility. Do not upgrade Expo only for beta polish unless a real blocker requires it.

## EAS Builds

The Expo app has `apps/mobile/eas.json` with development, preview, and production profiles.

Development build:

```bash
cd apps/mobile
npx eas-cli@latest build --profile development --platform all
```

Preview/internal build:

```bash
cd apps/mobile
npx eas-cli@latest build --profile preview --platform all
```

Production build:

```bash
cd apps/mobile
npx eas-cli@latest build --profile production --platform all
```

Use EAS Build for native changes: new native dependencies, permission changes, Expo SDK upgrades, icons/splash changes, bundle identifier/package changes, or native config changes.

Use EAS Update only for compatible JavaScript and asset changes that do not require native project changes.

Before running preview or production builds, replace the placeholder API URL in `eas.json` or configure the same env values through EAS:

```env
EXPO_PUBLIC_API_URL="https://your-deployed-api-domain"
EXPO_PUBLIC_RELEASE_CHANNEL="preview"
```

## App Store Metadata Placeholders

These are planning placeholders for internal/beta review notes, not public launch claims:

- Short description: `Host private event photo albums from a mobile command center.`
- Long description: `EventFilm lets hosts create QR-based private photo albums, share guest upload links, open a Live Wall, review photos, and share a recap after the event. Guests upload from the web and do not need accounts.`
- Beta review note: `This build is for internal host testing. Use the provided beta API environment and create a test event before inviting guests.`
- Known beta limitations: no in-app payments, no guest accounts, no public app-store availability claim, and manual production environment review required before real events.

## Checks

From the repo root:

```bash
npm run check:shared
npm run check:api-client
npm run check:web
npm run check:api
npm run check:mobile
npm run check
```

Mobile lint is available with:

```bash
npm run lint:mobile
```

Before a real-host beta, also run the checklist in `docs/real-event-qa.md`.

## Feature Workflow

Future cross-platform features should follow this order:

1. Define or update the backend/API contract.
2. Update `packages/shared` types and constants.
3. Update `packages/api-client`.
4. Update the web UI and keep the QR/link guest upload flow working.
5. Update the mobile UI with native screens/components.
6. Add or update checks.
7. Use Vercel previews for web validation.
8. Use EAS preview/internal builds for mobile validation.
9. Use EAS Update only for compatible JS-only changes.

## Privacy Notes

Do not put secrets in `EXPO_PUBLIC_` variables. They are bundled into the app. Supabase service role keys, JWT secrets, and database URLs must stay server-side only.

The mobile app uploads through the existing API. It does not expose private Supabase object keys or direct storage credentials.
