# EventFilm Usability Gauntlet

Date: 2026-06-23

Commit audited: `e86bdf8` (`Polish EventFilm web elegance and comprehension`)

UX source of truth: `docs/eventfilm-ux-principles.md`

## Scenarios

### Scenario A: Friday pregame

- Flow tested: homepage -> login -> create Simple Album event named `Friday Pregame` -> inspect host handoff -> open signed-out guest page.
- Passed: homepage explains the core story quickly; create flow works; guest page makes accountless uploading clear.
- Confusion found: after creation, the event detail page can put Photo Wall in the spotlight because the default event time is "happening now," even when the first useful action is still sharing the guest link.

### Scenario B: Club picnic

- Flow tested: create `Club Picnic` -> choose Simple Album as easiest mode -> find QR poster and Photo Wall actions -> open Photo Wall.
- Passed: QR poster and Photo Wall are available from the host flow; Photo Wall clearly says "scan to add photos" and keeps extra display modes behind More.
- Confusion found: the Club Picnic template initially starts with Photo Prompts, which can feel like setup work for a host who just wants the easiest collection mode.

### Scenario C: Birthday recap

- Flow tested: opened revealed demo recap, added one local throwaway QA photo, featured it, reopened recap as a public guest.
- Passed: with a real photo, recap feels like a shared album and highlights a favorite.
- Confusion found: recap share copy was still too formal ("shared recap is ready") for a casual after-event text.

## Top Confusion Points

1. Hosts need a plain explanation of Guest link vs QR poster vs Photo Wall vs Recap.
2. Photo Wall can sound like the default thing to manage, even for small hangouts.
3. Shared Recap copy was warmer on the page than in the actual share message.
4. Simple Album needed stronger "safe default" positioning in the create flow.
5. Mobile guest upload was clear, but the first upload controls sat lower than ideal.

## Fixes Made

- Added a collapsed "Which link should I use?" helper in the host Share tab.
- Reframed Photo Wall as optional for small hangouts: use it during the event, or just share the guest link.
- Warmed recap share copy to sound like a group text after the event.
- Strengthened Simple Album copy as "Best for most hangouts."
- Tightened the guest page hero so Add photos appears sooner on phone-sized screens.
- Updated smoke/shared tests for the changed user-facing copy.

## Known Remaining Issues

- Locally generated absolute links pointed at `192.168.68.63:5173`, which the in-app browser could not reach while `localhost:5173` worked. This was treated as local environment/link-host configuration and not changed in this usability pass.
- The default event date can make a just-created event count as "happening now," so the host detail page may still default to Photo Wall. The creation success panel and Share tab now compensate, but a future pass could revisit default timing.
- Seeded demo data is intentionally photo-light; recap testing needs either storage smoke or a temporary local upload to feel realistic.

## Test With A Real Human Next

- Ask one college student to create a Friday pregame event and send the right thing to a friend without coaching.
- Ask one club officer to decide whether they would use guest link, QR poster, or Photo Wall for a small event.
- Ask one guest to open a recap link and say what they think they are looking at.
