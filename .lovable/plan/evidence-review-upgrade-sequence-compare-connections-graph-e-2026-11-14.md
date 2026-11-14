# Evidence Review upgrade: Sequence Compare, Connections graph, editor timeline, live clip search

Build order per the brief: synchronized comparison + live clip search first, 3D view last. All three views share one events model, citations, and selection state per finding.

## 1. Shared finding-events model (`src/lib/finding-events.ts`)
- One typed event list per investigation case (conflicting / matching / incomplete): id, label, source (report | video | transcript | dispatch), citation, order in report vs order in recording.
- Derived helpers: matched pairs, reversed pairs (crossing lines), coverage gaps with exact intervals only where sources establish boundaries, and a shared-clock anchor flag (dispatch aligns to video only when a cited anchor exists).
- Selection state (selected event/citation + video seek time) lives in the contradictions route and is passed to all three views.

## 2. Sequence Compare (first view, above the timeline)
- New `src/components/caselens/sequence-compare.tsx`: two compact rows — **Reported order** and **Recorded order** — with short event chips and SVG connectors between matched events; reversed pairs get crossing lines and the **Possible discrepancy** label.
- Click a report event → open cited PDF page (existing overlay viewer). Click a recording event → cue the original clip and move the playhead.
- Incomplete coverage → **Lead-up unavailable** + **Draft evidence request** (links to Court Prep request draft). Missing interval shown only when boundaries are established.

## 3. Connections graph + optional 3D layers
- New `src/components/caselens/finding-connections.tsx` using `@xyflow/react` (already installed), rendered inside `<ClientOnly>`.
- Graph starts at the selected finding with only directly related sources/events. Nodes carry readable labels + citations (Report · p. 3, Video · 02:14); edges carry labels (reported before, observed before, anchors recording time).
- Clicking a node shows its excerpt or video frame in a side panel with an **Open source** action.
- **3D layers** toggle: CSS 3D transform (gentle user-triggered tilt separating written claims / recording events / dispatch records into layers) — no WebGL dependency, so it degrades cleanly. Instant return to 2D, honors `prefers-reduced-motion`, and the toggle is hidden on small screens.

## 4. Video-editor timeline
- Rework the investigation timeline into `src/components/caselens/finding-timeline.tsx`: Video / Audio / Dispatch lanes with real frame thumbnails (sampled JPEGs from the synthetic clips, generated once with FFmpeg into assets), a playhead bound to the actual `<video>` element, click-to-scrub on events, **Zoom to finding** framing lead-up + events, elapsed video time by default, dispatch aligned only when the cited shared-clock anchor exists, and coverage gaps visually distinct with plain-language labels.

## 5. "Find in footage" — TwelveLabs live search
- Server function `src/lib/footage-search.functions.ts`: index the selected staged clip asynchronously, poll/display actual processing state, run a Marengo search restricted to the authorized video for the current case, return start/end as **candidate matches**.
- Candidates render on the timeline; clicking seeks the original MP4; reviewer verifies each candidate; no hits leaves the question unresolved.
- `TWELVELABS_API_KEY` as a server-side secret (user must supply it — without it the UI shows a clear setup message, same pattern as the investigator service).
- Expose the search to the Deep Agent as a read-only tool in `services/investigator` (gated on the same secret).

## 6. Fresh-upload proof
- Generate two new staged clips with FFmpeg (trunk opens at a different time; a truncated variant), upload as assets, add as a fourth scenario.
- Verify: search result, graph node, and timeline marker all jump to the new clip at the returned time; truncated clip shows the evidence gap.
- Report which tests ran live vs. which setup steps remain (TwelveLabs key, investigator deployment).

## Verification
- Vitest: event-model rules (reversal detection, gap intervals, anchor gating).
- Playwright: sequence compare clicks open PDF page / seek video, graph node side panel, 3D toggle + reduced motion, timeline scrub + zoom to finding, candidate match seek, fresh-clip scenario, responsive widths.
- Update `AGENTS.md` (new modules) and roadmap.
