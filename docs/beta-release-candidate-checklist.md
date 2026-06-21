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
