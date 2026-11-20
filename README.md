# Japan 2026 family trip app

A phone app for our family, 10 to 24 December 2026. It installs from a link onto
iPhones (Safari, then **Share > Add to Home Screen**) and works with no internet once opened.

## What's in it (stage 1)

- **Home**: countdown before the trip. During the trip it shows today, the next journey and tonight's hotel.
- **Getting around**: every journey with its picture, colour, bag badge and booking status.
  Tap one for the step-by-step travel day and the "Book it" helper cards.
- **Our bags**: where the big suitcases are each day, including the 17 Dec send-ahead.
- **Hotels**, **Places and big days**, **Tickets** (what's booked and what's still to book).

Coming next: tickets wallet with QR codes and booking numbers, parent PIN and morning plans,
then family messages, reminders and the photo diary.

## Privacy

The repository and website are public, so all family details (names, dates, hotels, bookings) are
stored locked in `data/trip.enc.json`. The family code unlocks them on each phone. Booking numbers,
QR codes and the unlocked `trip.json` must never be committed. Search engines are asked not to list the site.

## Updating the trip

1. Edit the unlocked `trip.json` (kept outside this repo).
2. `node tools/encrypt.mjs path/to/trip.json <family code>` writes `data/trip.enc.json`.
3. `node tools/release.mjs` refreshes the offline file list so every phone picks up the change.
4. Commit and push. Phones show "The trip has been updated" next time they're online.

To preview a trip day, add `?today=2026-12-18` to the address.

## Hosting

GitHub Pages: **Settings > Pages > Deploy from a branch > main / (root)**. No build step.
Fonts (Nunito, Inter) are self-hosted under the SIL Open Font License.
