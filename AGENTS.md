<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## CaseLens architecture
- Workspace demo data lives in src/lib/case-data.ts and src/lib/graph-data.ts; starting-page synthetic evidence lives in src/lib/landing-mockData.ts — keep data separate from presentation so APIs can replace it later.
- Workspace pages are children of the pathless `_workspace` layout (sidebar + top bar); the landing page `/` sits outside it.
- React Flow renders only inside `<ClientOnly>` to avoid SSR issues.
- Scope the starting-page theme to `.landing-noir` and keep its reusable board and sections under components/caselens/landing so starting-page and workspace styling remain independent; portal dialogs carry the same theme class.
- Pre-optimize `framer-motion` alongside the template's React dependencies in Vite so lazy route discovery cannot trigger a second dependency pass that mixes React hook dispatchers in an open preview.

- Keep Overview-only visual treatment under `.overview-page`; shared dark tokens and shell styling may be inherited by other workspace pages without rewriting them.
- Keep Overview preview data and discrepancy cues in `src/lib/overview-data.ts`; measure evidence-board connections from DOM bounds with ResizeObserver so source data remains unchanged and strings survive resizing.
- Keep evidence-review presentation notes and concentric graph positions separate from original case data; scope neutral review styling to the two review routes so other workspace pages remain unchanged.
- Treat recording previews and report forms as labeled synthetic reconstructions, not playable original evidence; measure comparison connectors on scroll and resize, and carry finding IDs in typed route search for cross-page review.
- Run Deep Agents only in the isolated Node investigator service; the app's server function sends allowlisted synthetic case IDs with server-held service credentials because PDF parsing and original video sampling require Node and FFmpeg.
- Validate investigation citations against completed tool references and reject definitive sequence outcomes when lead-up is missing; recorded playback must use saved real runs and remain explicitly labeled.
- Calculate case triage scores in the pure UTC-date utility `src/utils/priority.ts` from centralized case schedules so thresholds can be tested independently of presentation.
- Keep trial-notebook draft questions and request references in `src/lib/notebook-data.ts`; retain source excerpts unchanged, and export every section plus current edits and citations rather than only the visible document.
- Sequence Compare, the Connections graph, and the editor timeline share one event model in `src/lib/finding-events.ts` (events, citations, orders, gaps, clock anchor); selection and video seek state live in the contradictions route so the three views never diverge.
- Show an exact missing interval only when sources establish both boundaries, and align dispatch to video time only with a cited shared-clock anchor; the 3D layers view is a CSS tilt that must stay optional, instant to exit, and off under reduced motion or small screens.
- "Find in footage" uses TwelveLabs v1.3 Marengo 3.0 and multipart uploads/search; reuse dedicated per-case indexes/tasks and validate index names plus video case/source metadata before search so callers cannot substitute private account recordings. Keep the key inside handlers, offset clip-relative hits to case time, and retain unverified candidates/no-hits-as-unresolved. The isolated agent uses the same multipart search contract with service-configured clip IDs.
- Case list entries live in `cases` (CaseRecord) in src/lib/case-data.ts and hold only real public-record cases so walkthroughs never claim live analysis of linked footage.
- The synthetic Contradiction Engine route now redirects to the Rosales walkthrough; its components remain unused until real video files can be analyzed, so no fake evidence is shown.
