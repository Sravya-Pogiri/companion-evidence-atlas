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
- Landing page at `/` (src/routes/index.tsx, component in src/components/landing, outside the workspace layout).
- Workspace pages under the pathless `_workspace` layout (dark theme, top nav): Live Case `/live` (`/live?demo=1` replays the demo), Case Analysis `/analysis`, Review `/review`, Handoff `/handoff`. Every page shows "Findings are suggestions. Confirm before use." (Live Case in its timeline card, Case Analysis in its sidebar and status bar). Do not add pages without asking. Investigate `/investigate` was added with the team's approval.
- Investigate ("Test this claim", both cases): src/routes/_workspace.investigate.tsx and src/components/investigate/studio.tsx. The browser posts to /api/investigate (src/routes/api.investigate.ts), which forwards to the Deep Agents service (services/investigator, POST /investigate-claim, INVESTIGATOR_URL and INVESTIGATOR_TOKEN in .env) and streams its NDJSON events back. The service (src/claim.ts) runs a lead investigator that plans (write_todos) and delegates through the Deep Agents task tool to a timeline-researcher and an evidence-reviewer; their tools are read-only and case-scoped over the case's stored records: src/data/btk (packet, analysis, and pages.json, the stored text of every cited page plus each source's recorded metadata as `btk:<SOURCE>:meta`) or src/data/rosales/evidence-store.json (every complaint and opinion page, the bodycam transcript per minute, and the checked frame descriptions; built by scripts/evidence/rosales-store.py). Each subagent has a tool budget per run, repeated calls are not rerun, and a refused or failed tool call is returned to the agent instead of ending the run. After the run every quote is checked against the stored page in code; unverified decisive citations make the finding insufficient_evidence. Run it with `cd services/investigator && npm run start:local`.
- Two public cases, chosen with the Case dropdown in the top nav (src/lib/active-case.ts, `?case=rosales|btk`, remembered in the browser; switching reloads). The `_workspace` route renders client-only (`ssr: false`) so it can read the choice. The server and the Photon channel always use the Rosales case.
- Case Analysis is the only light-mode screen. It lives in src/components/case-analysis with its own stylesheet (case-analysis.css, scoped to `.lx-analysis`, loaded by its route only). Do not move its look into global CSS, the root layout or the shared nav. Its Drafts step uses the same review decisions as Review and Handoff.
- Model calls go through src/lib/ai/provider.server.ts: Google Gemini when GEMINI_API_KEY is set (the team has no Lovable gateway credentials), Lovable gateway as an optional fallback. Keys stay server-side. Prompts live in src/lib/agent/gateway.server.ts (app) and scripts/evidence/prompts.ts (offline analysis). Free-tier Gemini allows about 20 requests a day per model: batch, cache (cache/), and never run a full dataset.
- Evidence analysis is offline: scripts/evidence/ingest.py (no model) then scripts/evidence/analyze.ts (model + verification) write src/data/<case>/analysis.json. Only verified findings reach the app.
- BTK case (State of Kansas v. Rader, 05 CR 498): the public evidence packet lives outside the repo (CaseLens_BTK_Case_Packet.json plus documents/, media/, ocr/). scripts/evidence/ocr-vision.swift (macOS Vision OCR for scans without text), scripts/evidence/btk-ingest.py (hash check, cited-page text, page images; no model) and scripts/evidence/btk-analyze.ts (Gemini quotes the cited pages; quotes are kept only when found on the cited page in code) write src/data/btk/packet-analysis.json. src/lib/cases/btk.ts turns it into timeline items, conversation, sources and citations. Its dates (1974 to 2005) sit on the 0-90 axis in date order, not to scale. Pages describing the crimes are not rendered as images.
- Source text and citations live in src/lib/sources.ts. Document text is copied from the public PDFs; the case summary is a labeled paraphrase. Highlights must match the source text exactly (src/test/sources.test.ts checks this).
- Local copies of case videos live in public/media/ (git-ignored: the Rosales bodycam is over GitHub's 100 MB limit, and the KXAS clip in the BTK packet is held by NBC5/KXAS). Players use them when present (LOCAL_VIDEO in src/lib/media.ts, LOCAL_CLIPS in src/lib/cases/btk.ts) and fall back to YouTube or the archive link, so the deployed app works without them. Never commit them.
- Real stills from the public sample live in public/frames (video frames) and public/pages (rendered PDF pages), mapped to items in src/lib/media.ts.
- Findings are suggestions only. Never state conclusions about guilt, legality, or case strategy.
- Case data for the open case is chosen in src/lib/sample-case.ts and src/lib/sources.ts. Rosales v. Terrell (public footage and filings) lives in src/lib/sample-case.ts (timeline items and seed conversation), with the public source links in src/lib/case-data.ts; keep data separate from presentation.
- Synthetic and public data only. Keep keys in environment variables and never commit secrets (.env is ignored; see .env.example).
