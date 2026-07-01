# EventFilm Beta Release Candidate Checklist

Use this as the final go/no-go list before inviting the first beta host. Do not mark deployed checks complete until they pass against real deployed URLs.

## Production Beta Launch Gate

1. Confirm Vercel is green for `https://eventfilm.vercel.app/`, rooted at `client/`, using Node.js `22.x`, and deployed at the latest intended commit.
2. Confirm Vercel install settings do not use `--omit=optional` or `--no-optional`; clear the Vercel Build Cache after native optional dependency changes.
3. Confirm Railway API deploy is green, rooted at `server/`, and has production env values including `ANALYTICS_SALT` and `FOUNDER_EMAILS` if founder dashboard access is needed.
4. Generate `ANALYTICS_SALT` locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and add it in Railway, not in git.
5. Confirm `WEB_PUBLIC_URL=https://eventfilm.vercel.app`, `API_PUBLIC_URL=https://<railway-api-url>`, `CLIENT_ORIGIN` or `CLIENT_ORIGINS`, and Vercel `VITE_API_URL=https://<railway-api-url>` are aligned.
6. Confirm Supabase private bucket exists, the project is active/unpaused, and storage env vars are set only on the API host.
7. Run `npm exec -w server -- prisma migrate status --schema prisma/schema.prisma` against the intended target database.
8. Apply `npm run prisma:deploy -w server` only if migration status reports pending migrations and `DATABASE_URL` is confirmed for the target database.
9. Create a dedicated deployed smoke host and clearly named revealed smoke event.
10. Run `npm run smoke:deployed:api`.
11. Run `npm run smoke:deployed:browser` with `BROWSER_SMOKE_HOST_EMAIL` and `BROWSER_SMOKE_HOST_PASSWORD` set in the shell; never commit the smoke password.
12. Run `npm run smoke:deployed:storage` only when the event is safe for upload and cleanup.
13. Create an EAS preview build with `EXPO_PUBLIC_API_URL` set to the deployed API URL.
14. Invite the first beta host only after the hosted smoke test and evidence checklist below are complete.

Fernando still needs to provide the real deployed HTTPS API URL, deployed smoke event slug, production smoke host credentials, API provider/project identity, and Supabase bucket/project confirmation before full deployed smoke can pass. The production web password can differ from local demo or mobile Expo test credentials.

## First beta event rehearsal

Use this short rehearsal before inviting the first real host.

Local rehearsal:

1. Start the API with `npm run dev:api`.
2. Start the web app with `npm run dev:web`, or from `client/` run `npm run dev -- --host 127.0.0.1` when the root wrapper does not pass host flags cleanly.
3. Reset the local dev host with `npm run dev-host:reset` when testing Fernando's dev credentials.
4. Seed the demo beta host and events with `npm run demo:seed`.
5. Run `npm run smoke:browser`.
6. Optional real upload smoke: `ENABLE_GUEST_UPLOAD_BROWSER_SMOKE=1 npm run smoke:browser`.
7. Run `npm run smoke:storage` only when local storage env is configured and the target event is safe for cleanup. On Windows, prefer `STORAGE_SMOKE_API_URL=http://localhost:4000`.

Deployed rehearsal:

1. Sign in as host on `https://eventfilm.vercel.app/`.
2. Create a Custom test event named `EventFilm Beta Smoke Test - [date]`.
3. Confirm `Your event is ready.` appears.
4. Copy the guest upload link.
5. Open the QR poster.
6. Open the guest link on a phone without signing in.
7. Confirm the phone page says `No account needed.`
8. Upload one harmless test photo.
9. Confirm the host Uploads tab shows the photo.
10. Confirm the host Uploads tab and public album show the photo.
11. Confirm Recap shows the photo when reveal rules allow.
12. Confirm the public album works.
13. Confirm My Uploads works on the phone browser.
14. Feature the photo.
15. Delete the test photo.
16. Confirm the deleted photo disappears from public album and Recap.
17. Upload a second test photo if the remaining checks need one.
18. Open the photo from a public surface and confirm the full image, overlay details, and hearts render cleanly.
19. Confirm founder dashboard metrics if `FOUNDER_EMAILS` is configured.
20. Delete the test event or clearly mark it as test data after verification.

## Launch Evidence

Capture this before inviting the first host:

1. Screenshot of host created handoff.
2. Screenshot of QR poster.
3. Phone screenshot of guest upload page showing `No account needed.`
4. Screenshot after upload success.
5. Screenshot of host Uploads tab.
6. Screenshot of host photo review.
7. Screenshot of Recap.
8. Screenshot of founder overview if configured.
9. Commit hash deployed to Vercel.
10. Notes for any issues found and whether they block first-host invite.
