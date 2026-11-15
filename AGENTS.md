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

## Lexora architecture
- Product name is `APP_NAME` in src/lib/config.ts.
- Landing page: `/` redirects to the static site in public/landing (plain HTML, CSS and JS with a 3D casebook, from the teammates' repo gnana35/HackPrincetonSpring26, branch lexora-website). Its buttons lead into the app at `/live`. It is branded CaseLens; the app is branded Lexora. The earlier React landing page (src/components/landing) is no longer routed. `casebook.js` is a built file; its source and build script are in the original repo.
- Workspace pages under the pathless `_workspace` layout (dark theme, top nav): Live Case `/live` (`/live?demo=1` replays the demo), Case Analysis `/analysis`, Review `/review`, Handoff `/handoff`. Every page shows "Findings are suggestions. Confirm before use." (Live Case in its timeline card, Case Analysis in its sidebar and status bar). Do not add pages without asking.
- Case Analysis uses the same dark and gold palette and the same text scale and fonts as the other pages. It lives in src/components/case-analysis with its own stylesheet (case-analysis.css, scoped to `.lx-analysis`, loaded by its route only), which redefines the theme tokens and a few `--lx-*` shades. Use those tokens, not hard-coded colors. Do not move its look into global CSS, the root layout or the shared nav. Its Drafts step uses the same review decisions as Review and Handoff.
- Cases: the app shows one case at a time, chosen by the picker in the header, by `?case=<id>` (the landing page's "Open in the app" buttons use it), or remembered for the browser tab. `rosales` is the footage case (video timeline, Case Analysis, text-to-file demo, Photon). `benitez`, `mcmillian` and `hinton` are public-record cases with a dated timeline, the contradictions their public sources describe, and open prompts. Their data is generated from public/landing/script.js into src/lib/case-library.ts (do not retype it); src/lib/cases.ts builds the app's items and sample conversation from it. The Case Analysis tab keeps the same layout for every case: src/lib/case-sources.ts builds each case's documents, citations and entities from that data (statements summarized from the public sources, not original text), and src/lib/sources.ts swaps them in with the case (`setSourceBundle`). They are read-only: filing new evidence by text goes to Rosales only, and Photon mirroring applies to Rosales only.
- Source text and citations live in src/lib/sources.ts. Document text is copied from the public PDFs; the case summary is a labeled paraphrase. Highlights must match the source text exactly (src/test/sources.test.ts checks this).
- Real stills from the public sample live in public/frames (video frames) and public/pages (rendered PDF pages), mapped to items in src/lib/media.ts.
- Findings are suggestions only. Never state conclusions about guilt, legality, or case strategy.
- Sample case data (Rosales v. Terrell, public footage and filings) lives in src/lib/sample-case.ts (timeline items and seed conversation), with the public source links in src/lib/case-data.ts; keep data separate from presentation.
- Synthetic and public data only. Keep keys in environment variables and never commit secrets (.env is ignored; see .env.example).
