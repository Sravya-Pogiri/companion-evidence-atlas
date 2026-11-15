# Lexora

**The case file you can text.** Lexora helps a legal case team turn scattered evidence (PDFs, bodycam and dashcam video, photos, voice notes) into one timeline where conflicts and gaps are flagged, with every finding linked back to its source. The team works over iMessage: text it a photo or a note, ask it questions, and confirm what goes on the record.

Built for HackPrinceton. It uses **public records and synthetic data only**. **Findings are suggestions. Confirm before use.** Lexora never states conclusions about guilt, legality, or case strategy.

## What it does

- **Text it evidence.** Send a photo, a page, or a note to the Lexora iMessage line (Photon). It reads the file, suggests where it belongs on the timeline, cross-checks it against the record, and asks you to reply `CONFIRM` or `DISMISS`.
- **Ask it questions.** Answers come only from the stored case files and cite their source inline, like "(Complaint p.24 ¶208)" or "(Bodycam 5:30)". If the files don't say, it answers "I don't see that in the case files." Code checks every model answer before it is sent.
- **Live Case.** The text thread beside a multi-lane timeline (bodycam, dashcam, dispatch, documents), with possible conflicts and gaps flagged and a side-by-side Compare view.
- **Case Analysis.** Ingest, Extract, Timeline, Flag, Draft: five steps, each linked to the exact page, paragraph, or timestamp.
- **Investigate.** Test a claim against a case's stored evidence with a lead investigator and sub-agents (LangChain Deep Agents).
- **Review and Handoff.** A person confirms or dismisses each finding, deadlines surface first, and approved findings become an attorney handoff packet.
- **Cases.** Rosales v. Terrell (public footage and filings) and State v. Rader, plus public-record summaries.

## How the Photon line works

- Only numbers in `TEAM_NUMBERS` get answers. Anyone else gets one "case team members only" reply.
- Messages that arrive within about 5 seconds are answered with one text, and a caption sent just after its photo attaches to it.
- Photos and files are downloaded from Photon and read by Gemini (voice notes and PDFs need Gemini and may not arrive on the Beta line). Everything is shown live in the page's chat panel.

## Run it

```sh
npm i
cp .env.example .env   # then fill in the keys you have
npm run dev            # the app, on http://localhost:8080
npm test               # unit tests
npm run simulate       # drives the whole text line without a phone
```

Without Photon or model keys, the app still runs with a simulated line in the page. For the real line set `CASELENS_CHANNEL=photon` with `PHOTON_API_KEY`, `PHOTON_PROJECT_ID`, `PHOTON_WEBHOOK_SECRET`, `TEAM_NUMBERS`, and a model key (`GEMINI_API_KEY`), and point Photon's webhook at `https://<your-tunnel>/api/photon/webhook`. See `.env.example`. Never commit `.env`.

The server keeps its Photon runtime for the life of the process, so restart the dev server after changing server code.

## Built with

TanStack Start, React 19, Tailwind v4, Vite, Photon (iMessage), Google Gemini, LangChain Deep Agents. Started in [Lovable](https://lovable.dev).

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
