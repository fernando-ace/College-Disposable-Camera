# First-Host Beta Handoff

Use this for the first real EventFilm host tests. Keep the first event small, friendly, and easy to recover if something goes wrong.

## Who Should Test First

- A host Fernando can reach quickly by text or phone.
- A casual event with 10 to 40 guests.
- A host who is comfortable using a QR poster or guest link.
- Avoid weddings, paid client events, or anything where photos are mission-critical until deployed smoke has passed.

## Best First Event

- Birthday dinner, graduation hangout, club social, tailgate, house party, or family gathering.
- Strong Wi-Fi or reliable cell coverage.
- A printed QR poster or display device for the guest link.
- A host who can remind guests to scan the QR code early.

## Before The Event

- Confirm deployed API, web, and storage smoke readiness.
- Create the host account and event.
- Choose the event mode.
- If the event name, description, date, or reveal time changes, update it from the host event Settings tab before sharing links.
- Open the guest link in a logged-out phone browser.
- Upload one test photo and clean it up or hide it.
- Open Recap and confirm reveal timing.
- Save the guest link, QR code, and Recap link where the host can find them.

## During The Event

- Share the QR code and guest link early.
- Keep the QR poster visible on a laptop, TV, projector, iPad, or printout.
- Ask guests to upload one photo in the first 15 minutes.
- Keep the host dashboard available for hide/restore if needed.
- If upload fails, try phone browser refresh, then check connection, then have Fernando run API/storage smoke.

## After The Event

- Open Recap.
- Hide or delete any test/problem photos.
- Feature a few favorites.
- Download the visible ZIP.
- Share the Recap link with the host.
- Record what worked, what confused the host, and whether guests uploaded without help.

## Links To Share

- Guest upload link: for guests and QR code.
- Recap link: for after reveal.
- Host dashboard link: only for the host or Fernando.

## First Host Invite Template

Use this as a text or email draft. Replace the bracketed parts before sending.

```text
I'm testing EventFilm with a small number of real events. It gives you one QR link where guests can upload photos without making an account, then you get a recap to share after the event.

For your event, I would help you create the page, give you the guest link and QR code, and stay available if anything feels off. During the event, guests just scan the QR code and add photos from their phones.

What I would love feedback on:

- whether guests understand the upload page
- whether the QR/link is easy to share
- whether the QR/link and Recap feel useful
- anything confusing or stressful for you as the host

If anything breaks, text me and I will help right away. This is still a beta, so we should use it for a casual event where a backup plan is okay.

Guest link: [guest upload link]
QR poster: [QR poster link or attachment]
```

## Feedback To Collect

- Did guests understand what to do from the QR page?
- Did anyone fail to upload from a phone?
- Did the host know where to find the guest link, QR poster, and Recap?
- Were challenge modes clear enough?
- Did moderation feel easy?
- Would the host use this again for another event?

## Metrics Fernando Should Record

- Event type and approximate guest count.
- Number of guest joins.
- Number of successful uploads.
- Number of Recap opens.
- Number of hidden, reported, and featured photos.
- Time from link sharing to first upload.
- Any upload failures and device/browser details.
