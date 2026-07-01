# EventFilm Web + Mobile Implementation Note

This pass keeps the current production deployment roots intact:

- `client/` remains the Vercel web app root.
- `server/` remains the API/Railway service root.
- `apps/mobile/` is added for the Expo native app.
- `packages/shared/` and `packages/api-client/` are added as workspace packages.

The web guest upload route at `/e/:slug` stays browser-based and continues to use the existing backend upload endpoint. The mobile app is an optional native host/repeat-user experience and points at the same API via `EXPO_PUBLIC_API_URL`.

## Mobile Beta Readiness Pass

This pass prepares EventFilm for controlled real-host testing without changing the guest model.

- Guests still use web links and QR codes. They do not need accounts or an app install.
- Mobile is the host command center: create events, inspect event detail, share guest and Recap links, view beta analytics, and moderate photos with delete plus feature/unfeature.
- The API validates production environment values and keeps development fallbacks out of production.
- EAS profiles exist for development, preview, and production. Preview/production builds must use a deployed API URL.
- Dev-only demo seeding creates challenge-configured beta events without fake photos or production testimonials.

## Beta Guardrails

- Do not add payments before the current beta flow is reliable.
- Do not add new challenge packs during this hardening phase.
- Do not move production roots: Vercel still points at `client/`, Railway still points at `server/`.
- Do not store secrets in `EXPO_PUBLIC_` variables.
- Use `docs/real-event-qa.md` before inviting a real host or guest group.
