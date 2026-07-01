# EventFilm Real-Event QA Checklist

Use this before a real host or guest group tests EventFilm.

## Environment

- API `NODE_ENV` is `production` for deployed testing.
- `WEB_PUBLIC_URL` or `CLIENT_URL` points at the deployed web app.
- `API_PUBLIC_URL` or `SERVER_URL` points at the deployed API and uses HTTPS.
- `CLIENT_ORIGIN` or `CLIENT_ORIGINS` includes the deployed web origin and does not use `*`.
- `VITE_API_URL` points at the deployed API base URL with no `/api` suffix.
- Mobile `EXPO_PUBLIC_API_URL` points at the deployed API.
- Mobile `EXPO_PUBLIC_RELEASE_CHANNEL` is `preview` or `production` for EAS builds.
- Supabase bucket exists and the service role key is only configured on the server.
- Prisma migrations are current:

```bash
npm exec -w server -- prisma migrate status --schema prisma/schema.prisma
```

For full deployment readiness, also follow `docs/deployment-readiness.md`.

## Deployed Smoke Commands

Use these after web/API deployment and after creating a safe target-environment smoke event:

```powershell
$env:DEPLOYED_API_URL="https://api.your-eventfilm-domain.com"
$env:DEPLOYED_WEB_URL="https://your-eventfilm-domain.com"
$env:DEPLOYED_SMOKE_EVENT_SLUG="eventfilm-beta-demo-storage-smoke"
npm run smoke:deployed:api
npm run smoke:deployed:browser
npm run smoke:deployed:storage
```

Add `DEPLOYED_SMOKE_HOST_EMAIL` and `DEPLOYED_SMOKE_HOST_PASSWORD` only for a dedicated smoke host. The commands must report missing env or documented skips instead of claiming full deployed success.

## Dev Demo Setup

Create demo events only in development:

```bash
npm run seed:beta-demo -w server
```

The script creates one event for each flagship mode: Color Hunt, Photo Scavenger Hunt, Event Awards, and Memory Capsule. It also creates `eventfilm-beta-demo-storage-smoke`, a revealed dev-only event used by the Supabase storage smoke so album and Recap visibility can be checked with a real upload. It does not create fake guest testimonials or fake production photos.

For visual QA, keep the default seed photo-free and use one of these temporary paths:

- Run `npm run smoke:storage` against a safe local or deployed smoke event.
- Upload a tiny throwaway image through a demo guest link, verify guest upload, Recap, moderation, and cleanup.
- Do not commit real uploaded images, fake production photos, or fake testimonials.

Cleanup:

```bash
npm run seed:beta-demo -w server -- --cleanup
```

Root aliases are available:

```bash
npm run demo:seed
npm run demo:cleanup
```

## Browser Smoke

With the API and web app running, run:

```bash
npm run smoke:browser
```

Optional overrides:

```bash
$env:EVENTFILM_WEB_URL="http://localhost:5173"
$env:EVENTFILM_API_URL="http://localhost:4000"
$env:EVENTFILM_SMOKE_EVENT_SLUG="eventfilm-beta-demo-memory-capsule"
```

The smoke covers the landing page, primary CTA, unauthenticated host routes,
guest upload route, Recap, privacy, terms, support, and obvious
console errors on public pages.

## Supabase Storage Smoke

Run this only when the API is configured with real Supabase Storage values:

```bash
npm run demo:seed
$env:STORAGE_SMOKE_API_URL="http://localhost:4000"
npm run smoke:storage
npm run demo:cleanup
```

The script uploads a tiny PNG through the actual guest upload API, verifies the
photo record, public file/preview routes, guest album, Recap,
feature/unfeature, guest hearts, host moderation state, hide/restore behavior,
event analytics summary, and cleanup. It prints whether required environment
variables are present, but it does not require or print Supabase secrets. If the
previous failure was `Could not upload photo: fetch failed`, confirm the API is
reachable and the Supabase project is active/unpaused before changing app code.

## First-Host Beta Checklist

- Create one test event from web.
- Create one test event from mobile.
- Use Color Hunt, Photo Scavenger Hunt, Event Awards, and Memory Capsule at least once.
- Upload one real photo from a guest phone.
- Keep the QR poster visible on a laptop, display device, or printout.
- Share the Recap link and confirm reveal behavior.
- Hide and restore one photo.
- Feature one photo.
- Open one photo as a guest and confirm hearts work.
- Confirm host metrics update after guest, upload, Recap, moderation, feature, and heart activity.
- Confirm analytics records event activity.
- Run `npm run demo:cleanup` or otherwise remove test data before real beta use.

## Real-Device First Event Checklist

- iPhone Safari: scan the QR poster, open the guest upload page, enter an optional display name, upload from camera/library, and confirm My Uploads.
- Android Chrome: repeat guest upload, including anonymous continuation.
- Expo Go host app: open the event, share kit, Recap, metrics, moderation, and beta issue report.
- Desktop Recap: confirm locked state before reveal and full recap after reveal.
- QR poster scan: scan from printed paper or a second display, not just a copied link.
- Wi-Fi versus cellular: try at least one upload on each when practical.
- Large photo upload: try one high-resolution phone photo and confirm friendly behavior if it is too large or slow.
- Slow network behavior: confirm upload errors/retry copy are understandable and do not trap the guest.
- Hidden photo behavior: hide one photo and confirm it disappears from guest album, Recap, and public image routes.
- Beta issue path: submit one non-sensitive test issue from the host event page and confirm founder ops can see it.

## Host Flow

- Sign up or log in as a host.
- Create an event with the intended challenge mode.
- Open the event detail screen on web and mobile.
- Confirm the guest upload and Recap links render.
- Confirm link verification does not warn about localhost for real testing.
- Copy/share the guest upload link.
- Keep the QR poster open or printed for guests.
- Confirm mobile dashboard analytics loads without blocking event management.

## Guest Flow

- Open the guest upload link in a browser while logged out.
- Upload from a phone camera or library.
- Upload more than once from the same device and confirm both photos save.
- Confirm invalid files and oversized files show friendly errors.
- Confirm no guest account is required.
- Confirm the album lock message appears before reveal.
- After reveal, confirm album/Recap photos load and hidden photos stay out of public views.

## Moderation Flow

- Upload at least two test photos.
- Hide one photo as host.
- Confirm hidden photo is absent from guest album, Recap, and public image routes.
- Restore the photo.
- Feature one visible photo.
- Confirm featured photos sort ahead of non-featured photos.
- Open a public photo and confirm the full image, details overlay, and hearts render cleanly.
- Prefer hide/restore during beta. Permanent deletion should be reserved for clear cleanup.

## Analytics Smoke

- Open dashboard, Recap, and guest upload link.
- Upload one photo successfully.
- Trigger one upload validation failure if practical.
- Confirm host analytics summary changes after events are recorded.
- Open the host event detail page and confirm event-level beta metrics show guest joins, uploads, Recap opens, hidden photos, hearts, and featured photos.
- If checking directly in the database, filter `AnalyticsEvent` by the test event id or slug and confirm event names such as `guest_joined_event`, `photo_upload_succeeded`, and `recap_opened`.

Metric definitions:

- Active host: signed-in host dashboard open in the last 30 days.
- Guest join: guest upload route visit that records `guest_joined_event`.
- Photo upload: successfully stored event photo that has not been deleted.
- Recap open: route visit that records `recap_opened`.
- Beta MAU: distinct active hosts plus distinct anonymous guest hashes in the last 30 days. Keep this internal during beta.

## Known Beta Limitations

- Payments are not implemented.
- Guests do not have accounts.
- Password reset and email verification are not implemented.
- Mobile app store publication has not been attempted.
- Placeholder mobile icon/splash assets should be replaced before public submission.
- Real-event readiness still requires a manual link, upload, moderation, and analytics check before each beta event.
