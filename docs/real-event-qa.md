# EventFilm Real-Event QA Checklist

Use this before a real host or guest group tests EventFilm.

## Environment

- API `NODE_ENV` is `production` for deployed testing.
- `CLIENT_URL` points at the deployed web app.
- `SERVER_URL` points at the deployed API and uses HTTPS.
- `VITE_API_URL` points at the deployed API base URL with no `/api` suffix.
- Mobile `EXPO_PUBLIC_API_URL` points at the deployed API.
- Mobile `EXPO_PUBLIC_RELEASE_CHANNEL` is `preview` or `production` for EAS builds.
- Supabase bucket exists and the service role key is only configured on the server.
- Prisma migrations are current:

```bash
npm exec -w server -- prisma migrate status --schema prisma/schema.prisma
```

## Dev Demo Setup

Create demo events only in development:

```bash
npm run seed:beta-demo -w server
```

The script creates one event for each flagship mode: Color Hunt, Photo Scavenger Hunt, Event Awards, and Memory Capsule. It does not create fake guest testimonials or fake production photos.

Cleanup:

```bash
npm run seed:beta-demo -w server -- --cleanup
```

## Host Flow

- Sign up or log in as a host.
- Create an event with the intended challenge mode.
- Open the event detail screen on web and mobile.
- Confirm the guest upload, Live Wall, and Recap links render.
- Confirm link verification does not warn about localhost for real testing.
- Copy/share the guest upload link.
- Open the Live Wall on the display device.
- Confirm mobile dashboard analytics loads without blocking event management.

## Guest Flow

- Open the guest upload link in a browser while logged out.
- Upload from a phone camera or library.
- Confirm remaining upload count updates.
- Confirm invalid files and oversized files show friendly errors.
- Confirm no guest account is required.
- Confirm the album lock message appears before reveal.
- After reveal, confirm album/Recap photos load and hidden photos stay out of public views.

## Moderation Flow

- Upload at least two test photos.
- Hide one photo as host.
- Confirm hidden photo is absent from guest album, Live Wall, Recap, and public image routes.
- Restore the photo.
- Feature one visible photo.
- Confirm featured photos sort ahead of non-featured photos.
- Report a public photo and confirm the host sees the reported status.
- Prefer hide/restore during beta. Permanent deletion should be reserved for clear cleanup.

## Analytics Smoke

- Open dashboard, Live Wall, Recap, and guest upload link.
- Upload one photo successfully.
- Trigger one upload validation failure if practical.
- Confirm host analytics summary changes after events are recorded.
- If checking directly in the database, filter `AnalyticsEvent` by the test event id or slug and confirm event names such as `guest_joined_event`, `photo_upload_succeeded`, `live_wall_opened`, and `recap_opened`.

## Known Beta Limitations

- Payments are not implemented.
- Guests do not have accounts.
- Password reset and email verification are not implemented.
- Mobile app store publication has not been attempted.
- Placeholder mobile icon/splash assets should be replaced before public submission.
- Real-event readiness still requires a manual link, upload, moderation, and analytics check before each beta event.
