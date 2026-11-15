# Lexora Investigate finding

## Architecture
`src/investigate.ts` instantiates the actual `deepagents` TypeScript `createDeepAgent`. Node 22 is used because original PDF parsing and FFmpeg frame sampling need a conventional server runtime. The Lovable app calls the service through `src/lib/investigation.functions.ts`, keeping service credentials server-side. Only three immutable synthetic case IDs are accepted. No uploaded/private discovery is processed or exposed by this demo.

## Deploy
From repository root:
```sh
docker build -t caselens-investigator services/investigator
```
Deploy this container on a Node/container host with HTTPS, port 8787, a persistent volume mounted at `/app/runs`, and streaming HTTP enabled. Do not impose short response timeouts: tool/model investigations may take several minutes.

Configure service environment securely:
- `LOVABLE_API_KEY`: project gateway credential, provisioned through Lovable; never commit or expose it.
- `INVESTIGATOR_TOKEN`: a shared secret, entered securely in both the service and Lovable project secrets.
- `PORT=8787`
- Optional, enables the read-only `search_footage` tool: `TWELVELABS_API_KEY`, `TWELVELABS_INDEX_ID`, and `TWELVELABS_VIDEO_ID_<CASE>` per case (e.g. `TWELVELABS_VIDEO_ID_CONFLICTING`). Without them the tool fails closed with a setup error and the agent proceeds without it. Searches are filtered to the single authorized indexed video for the case; returned windows are candidate matches, and no hits leaves the question unresolved.

Configure Lovable project secrets:
- `INVESTIGATOR_URL`: deployed HTTPS origin (not the `/investigate` suffix).
- `INVESTIGATOR_TOKEN`: same shared secret as service.

`GET /health` returns 200 and `{"status":"ready","sdk":"deepagents","model":"openai/gpt-6-astra"}` only when both service credentials exist. This checks configuration presence, not model availability. `POST /investigate` requires `Authorization: Bearer <service-token>` and `{"caseId":"conflicting"}` (or matching/incomplete). Returns NDJSON completed-check, result, or error events. The app’s typed server call consumes those events and displays completed checks with its final result. Intermediate progress is not streamed into the browser in this version.

Local development: `bun install` then `bun run start` from this directory. FFmpeg must be installed. Fixture regeneration needs Python Pillow and reportlab: `bun run fixtures`. Existing original fixtures are already included. Backend tests: `bun run test`. Actual three-case acceptance: `npx tsx src/acceptance.ts` with the gateway credential available.

## Real acceptance results
Saved real runs in `runs/` and public synthetic recorded-run copies in `src/lib/investigation-runs/` (app). “Recorded run” is an explicit separate action, never substituted for a live run or a setup error.

- Conflicting: **Possible discrepancy**. Called recording coverage; PDF page 3; transcript search (twice); dispatch; video window; video lead-up. Original frames show trunk closed in lead-up then open before the recorded request at 18 seconds.
- Matching: **Records agree on this claim**. Called recording coverage; PDF page 3; transcript search; dispatch; video windows (twice); lead-up. Earlier request at 6 seconds supports the written account despite the later request at 18 seconds.
- Incomplete: **Insufficient evidence**. Called recording coverage (twice); PDF page 3; transcript search (twice); dispatch; video window. Clip starts at absolute 10 seconds with trunk already open. No discrepancy is confirmed; draft requests the earlier footage.

The service saves actual tool names, completion states, results, and references. Structured citations are validated against completed tool results. Missing lead-up cannot validate agreement or discrepancy. Filesystem and shell tools are denied; the model has no arbitrary source URL, path, or case ID inputs. Final output is an attorney-review draft, not a factual conclusion.

## Remaining deployment
No external service has been deployed automatically. Live investigation in the app intentionally shows Setup required until its HTTPS URL and shared token are configured. The gateway credential was available for actual server-side acceptance runs, not installed on an external host. The three recorded runs are available immediately for UI/citation/draft review. Authentication and persistent user drafts are not part of this synthetic-only flow. Court Prep drafts are editable and exportable in the open session.

## Limitations
Synthetic body-camera videos are visual clips with a separately authored timestamped transcript, not automatic speech transcriptions. The original synthetic files, not the earlier market still, are sampled for vision. No pre-existing vision/upload processing pipeline existed: the original Evidence Vault simulated processing. This feature does not turn that vault into a production processing pipeline. No AWS Bedrock integration or challenge eligibility is claimed.

Terminal gateway credit/access/resource failures pause further runs in `/app/runs/gateway-paused.json`; resolve the reported issue, then remove that pause file as an explicit operator action before starting a new run. No automatic retry, model substitution, or credential rotation is performed. Transient failures may be retried by the reviewer. No timers silently abort billed model work.
