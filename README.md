# Companion Evidence Atlas

Build the app described in the attached file.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/df9b4ee0-96d9-40c6-be46-ef3fafe186ff).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Deadlines and reminders

The Review page puts the items that need a person soonest at the top.

- **Deadlines from a calendar.** Set `CASE_CALENDAR_ICS_URLS` (comma-separated) to one or more calendar
  feed links. Only events that mention the case by name or number (for example "Rosales" or
  "5CIR-25-30650") in the title or notes count. The soonest upcoming one becomes the case deadline, and
  items without their own deadline use it.
  - **Google Calendar:** Settings, pick the calendar, Integrate calendar, copy the *Secret address in iCal
    format*. Treat the link like a password: keep it in `.env`, never commit it.
  - **A public court calendar:** only if the court publishes an `.ics` or `webcal://` link. You can read a
    court's calendar this way, but no one outside the court can add to it. Many courts publish dockets,
    not calendar feeds.
  - Repeating events are read as their first occurrence only. Calendar links are read by the server and
    are never sent to the page.
- **Deadlines set by a person.** If no calendar is connected, or it has nothing for the case, set a deadline
  on any flagged item with the buttons on its Review card (Today, Tomorrow, In 3 days, or a date).
- **Text reminders (Photon channel).** With `CASELENS_CHANNEL=photon`, the server texts everyone who has
  texted the line once when a flagged item that is still waiting on a person is due within a day or is
  overdue. "Text reminders now" on Review sends it on demand. Texting "What's due?" asks for the list.
  A shared Photon line can only message people who have texted it first, and who they are is kept only
  while the server runs.
