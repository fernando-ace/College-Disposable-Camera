# EventFilm Web UI Rebuild

## What was wrong

The old web UI worked, but it often looked like host operations software instead of a casual shared-album product. Normal hosts saw too many stats, badges, internal labels, dense cards, and advanced controls before the simple story was clear: create an event, share one link, collect photos, send the recap.

## Visual target

Use the approved generated mockups as the strict visual reference:

- Landing: `C:\Users\Ferna\.codex\generated_images\019ef370-6bf7-7820-b20a-8e2de3b50fc3\ig_02b19c15a27517b3016a3a3a090b3c8190bad963b934934625.png`
- Host app shell/create/dashboard/detail: `C:\Users\Ferna\.codex\generated_images\019ef370-6bf7-7820-b20a-8e2de3b50fc3\ig_02b19c15a27517b3016a3a3aa555d48190a0736e088e2a7d07.png`
- Public guest surfaces: `C:\Users\Ferna\.codex\generated_images\019ef370-6bf7-7820-b20a-8e2de3b50fc3\ig_02b19c15a27517b3016a3a3bbd0a24819080afff4a9fe6a966.png`

## Design principles

- Make the first action obvious on every page.
- Use editorial serif display type for the landing/public album moments and calm sans-serif UI type for controls.
- Use coral for primary actions, neutral surfaces, subtle borders, and status colors only for real state.
- Keep cards/panels soft and purposeful: small radius, light border, minimal shadow, no nested card stacks.
- Prefer real event photos, QR codes, and album previews over decorative UI chrome.
- Keep advanced tools behind More options.

## Page hierarchy

- Landing: hero, how it works, use cases, event styles, FAQ, final CTA.
- Create event: event type, photo style, details, then ready-to-share handoff.
- Dashboard: sidebar shell, welcome, tiny summary pills, event list with one next action.
- Event detail: Share, Photos, Photo Wall, Recap, Settings.
- Guest upload: event name, No account needed, Add photos, optional name, prompt hint, My Uploads.
- Photo Wall: event name, centered title, QR/add-photo area, photo grid, quiet More controls.
- Shared Recap: album hero, Add photos, Copy recap link, Favorite moments, Photos, People who added photos.
- QR poster: event name, large QR, Scan to add photos, No account needed, short hint.

## Visible by default

- Guest link, QR code, event poster, group chat message.
- Add photos, Photo Wall, Shared Recap, Review photos.
- Event date/status, photo count, and one lifecycle action.

## Hidden behind More options

- Advanced Photo Wall modes.
- Prompt/category editing.
- Analytics/activity details.
- Repeat event tools.
- Issue reporting.
- Founder and beta-readiness links.
- Destructive actions and download variants.

## Intentionally trimmed

- Admin-dashboard language such as command center, launch, signal, ops, presenter, moderation, prompt pack, and handoff.
- Repeated CTAs and redundant share variants.
- Dense stat grids, feature showcases inside app flows, noisy badges, and challenge progress as a default surface.

## CleanUI application

- No `font-extrabold` or `font-black`; use regular, semibold, and bold only.
- No heavy custom letter spacing or decorative uppercase labels.
- Use consistent radii: small controls around 8px, cards around 12px, poster/phone frames only where visually intentional.
- Avoid heavy shadows; rely on white panels, borders, spacing, and real images.
- Split reusable UI primitives out of the monolithic app file.
- Match layout to content: photo-heavy surfaces use image grids; host management uses lists; public album pages prioritize photos and actions.

## Visual QA checklist

- Landing has editorial serif hero type, minimal nav, premium photo/phone imagery, coral CTA, whitespace, and no SaaS/admin clutter.
- Host app uses a clean sidebar shell, white panels, soft borders, subtle shadows, calm spacing, and one clear action per view.
- Create flow matches the 3-step card/accordion layout.
- Dashboard is a sidebar plus event list, not analytics-first.
- Event Share tab shows Guest link, QR code, Event poster, group chat message, and collapsed link helper.
- Guest upload mobile puts event name, No account needed, Add photos, optional name, compact prompt, and My Uploads above clutter.
- Photo Wall is elegant and centered with QR/add-photo area, photo grid, quiet controls, and More for advanced modes.
- Shared Recap is album-first with large title, Add photos, Copy recap link, Favorite moments, Photos, and People who added photos.
- QR poster is warm and minimal.
- The app does not drift back into card-heavy/admin-dashboard styling.
