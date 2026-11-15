#!/usr/bin/env python3
"""Build src/data/rosales/evidence-store.json: the stored records the claim investigation reads.

  python3 scripts/evidence/rosales-store.py

From the ingest and analysis outputs (no model calls):
  COMPLAINT pN, OPINION pN   the text of every PDF page (cache/rosales/<source>/pages.json)
  BODYCAM mNN               the bodycam transcript, one record per minute (machine transcript)
  DASHCAM/BODYCAM tNNNN     frame descriptions that passed a second check of the frame
plus the dated moments and the records expected but not in the case.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "cache" / "rosales"
a = json.loads((ROOT / "src/data/rosales/analysis.json").read_text())
case = json.loads((ROOT / "scripts/evidence/rosales.case.json").read_text())
src = {s["id"]: s for s in case["sources"]}

def mmss(t):
    t = int(round(t))
    return f"{t // 60}:{t % 60:02d}"

records = []
for sid, key in (("complaint", "COMPLAINT"), ("opinion", "OPINION")):
    for p in json.loads((CACHE / sid / "pages.json").read_text()):
        records.append({
            "evidenceId": f"rosales:{key}:p{p['page']}", "sourceId": key, "sourceTitle": src[sid]["label"],
            "page": p["page"], "location": f"PDF p.{p['page']}", "method": "pdf text layer",
            "text": p["text"], "url": f"{src[sid]['url'].split('#')[0]}#page={p['page']}",
        })

lines = json.loads((CACHE / "bodycam" / "transcript.json").read_text())
by_min = {}
for l in lines:
    by_min.setdefault(int(l["t"] // 60), []).append(f"[{mmss(l['t'])}] {l['speaker']}: {l['text']}")
for m, ls in sorted(by_min.items()):
    records.append({
        "evidenceId": f"rosales:BODYCAM:m{m:02d}", "sourceId": "BODYCAM", "sourceTitle": src["bodycam"]["label"] + ", transcript",
        "page": m, "location": f"bodycam {m}:00–{m + 1}:00", "method": "machine transcript (1-minute pieces; times of cited lines re-checked)",
        "text": "\n".join(ls), "url": f"{src['bodycam']['url']}&t={m * 60}s",
    })

for c in a["claims"]:
    if c["origin"] != "video" or c["verification"]["status"] != "passed":
        continue
    sid, t = c["at"]["source"], c["at"]["t"]
    key = sid.upper()
    records.append({
        "evidenceId": f"rosales:{key}:t{int(round(t)):04d}", "sourceId": key, "sourceTitle": src[sid]["label"] + ", frame",
        "page": int(round(t)), "location": f"{sid} {mmss(t)}", "method": "frame description (AI-generated, confirmed by a second look at the frame)",
        "text": f"Frame at {sid} {mmss(t)}: {c['claim']}", "url": f"{src[sid]['url']}&t={int(t)}s", "frame": c.get("frameRef"),
    })

dated = []
for c in a["claims"]:
    if c["verification"]["status"] not in ("passed", "fixed") or "t" not in c["at"]:
        continue
    sid, t = c["at"]["source"], c["at"]["t"]
    rid = f"rosales:BODYCAM:m{int(t // 60):02d}" if c["origin"] == "transcript" else f"rosales:{sid.upper()}:t{int(round(t)):04d}"
    dated.append({"evidence_id": rid, "time": f"{sid} {mmss(t)}", "clock": f"{sid} video clock (not synced with the other camera)",
                  "kind": "spoken on the recording" if c["origin"] == "transcript" else "seen in a frame", "event": c["claim"]})

store = {
    "caseId": "rosales",
    "title": "Rosales v. Terrell, No. 25-30650 (5th Cir.), public sample",
    "question": "What do the filings and the public videos show about the stop and its stated reason?",
    "records": records,
    "dated": sorted(dated, key=lambda d: (d["time"].split()[0], d["time"])),
    "missing": [{"artifact": e["label"], "why": e["why"]} for e in case["expected"]] + [
        {"artifact": "A shared clock between the dashcam and the bodycam", "why": "The bodycam starts after the stop; nothing in the record gives the offset between the two videos."},
    ],
    "note": "Built by scripts/evidence/rosales-store.py from the ingest and analysis outputs. Transcript and frame records are machine-generated; PDF pages are the filings' text layers.",
}
out = ROOT / "src/data/rosales/evidence-store.json"
out.write_text(json.dumps(store, indent=1))
print(f"{len(records)} records ({sum(1 for r in records if r['sourceId'] in ('COMPLAINT','OPINION'))} pages, {len(by_min)} transcript minutes, {sum(1 for r in records if ':t' in r['evidenceId'])} frames), {len(dated)} dated moments -> {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")
