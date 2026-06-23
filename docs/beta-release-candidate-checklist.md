# EventFilm Beta Release Candidate Checklist

Use this as the final go/no-go list before inviting the first beta host. Do not mark deployed checks complete until they pass against real deployed URLs.

1. Deploy API from `server/`.
2. Apply deployed DB migrations with `npm run prisma:deploy -w server`.
3. Configure API env: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `ANALYTICS_SALT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `WEB_PUBLIC_URL`, `API_PUBLIC_URL`, and `CLIENT_ORIGIN` or `CLIENT_ORIGINS`.
4. Confirm Supabase private bucket exists and the project is active.
5. Deploy web from `client/` with `VITE_API_URL` set to the deployed API base URL.
6. Configure CORS to allow the deployed web origin.
7. Create a dedicated deployed smoke host and revealed smoke event.
8. Run `npm run smoke:deployed:api`.
9. Run `npm run smoke:deployed:browser`.
10. Run `npm run smoke:deployed:storage`.
11. Run `npm run smoke:deployed:all`.
12. Create an EAS preview build with `EXPO_PUBLIC_API_URL` set to the deployed API URL.
13. Test mobile host login, event creation, and launch links.
14. Test guest upload from a phone browser.
15. Test Live Wall on a laptop or display.
16. Test Recap sharing.
17. Test feature, unfeature, report, hide, restore, and cleanup behavior.
18. Invite the first beta host.

Fernando still needs to provide the real deployed API URL, deployed smoke event slug, deployed smoke host credentials, API provider/project identity, and Supabase bucket/project confirmation before full deployed smoke can pass.

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

1. Confirm the Vercel web deploy is green.
2. Confirm the API host has required env vars, including `ANALYTICS_SALT` and `FOUNDER_EMAILS` if founder dashboard access is needed.
3. Apply production migrations only when needed with `npm run prisma:deploy -w server`.
4. Create one clearly named real test event on `https://eventfilm.vercel.app/`.
5. Open the guest link on a phone while signed out.
6. Upload a real test photo.
7. Confirm the host Uploads tab shows it.
8. Confirm the Live Wall shows it.
9. Confirm the Recap shows it when reveal rules allow.
10. Test feature, hide, report, and restore if the target event is safe.
11. Delete the cleanup event or clearly mark it as test data.
