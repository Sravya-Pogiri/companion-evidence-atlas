#!/usr/bin/env python3
"""Ingest the BTK public evidence packet (no model calls).

  python3 scripts/evidence/btk-ingest.py ~/Desktop/evidence

Reads CaseLens_BTK_Case_Packet.json from the evidence folder and:
  1. checks every included file against the packet's SHA-256,
  2. collects the text of every cited PDF page: the PDF's own text layer, else the OCR rows
     shipped with the packet, else Apple Vision OCR (scripts/evidence/ocr-vision.swift, run first
     into cache/btk/ocr/<SOURCE>/p<N>.txt),
  3. renders small images of the cited investigative and court pages into public/pages/btk/.
     Pages cited only for the homicide incidents are not rendered (they describe the crimes),
  4. writes cache/btk/pages.json and cache/btk/packet.json (a copy of the packet).
"""
import hashlib
import json
import shutil
import sys
from pathlib import Path

import fitz  # PyMuPDF

EVIDENCE = Path(sys.argv[1]).expanduser()
ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "cache" / "btk"
PAGES_OUT = ROOT / "public" / "pages" / "btk"
CACHE.mkdir(parents=True, exist_ok=True)
PAGES_OUT.mkdir(parents=True, exist_ok=True)

packet = json.loads((EVIDENCE / "CaseLens_BTK_Case_Packet.json").read_text())
case = packet["cases"][0]
sources = {s["id"]: s for s in case["sources"]}

# 1. Hashes.
bad = []
for s in case["sources"]:
    if s.get("availability") != "included":
        continue
    h = hashlib.sha256((EVIDENCE / s["path"]).read_bytes()).hexdigest()
    if h != s["sha256"]:
        bad.append(s["id"])
if bad:
    sys.exit(f"hash mismatch: {bad}")
print(f"hashes ok for {sum(1 for s in case['sources'] if s.get('availability') == 'included')} files")

# 2. Cited pages.
def cites(rows):
    for r in rows:
        for c in r.get("citations", []):
            if "pdf_page" in c:
                for p in range(c["pdf_page"], c.get("pdf_page_end", c["pdf_page"]) + 1):
                    yield c["source_id"], p

evidence_pages = set(cites(case["evidence"]))
court_timeline = [t for t in case["timeline"] if t["id"] >= "T09"]
# Pages that describe the crimes or the seized material in detail: text is used for checks, no image.
NO_IMAGE = {("STATE", p) for p in (15, 40, 47, 87, 88, 89, 90, 91)}
render_pages = (evidence_pages | set(cites(court_timeline))) - NO_IMAGE
all_pages = render_pages | set(cites(case["timeline"]))

ocr = {}
for d in case.get("text_derivatives", []):
    for line in (EVIDENCE / d["path"]).read_text().splitlines():
        row = json.loads(line)
        ocr[(row["source_id"], row["pdf_page"])] = row["text"]

pages, methods = {}, {}
for sid, p in sorted(all_pages):
    src = sources[sid]
    if not src.get("path", "").endswith(".pdf"):
        continue
    doc = fitz.open(EVIDENCE / src["path"])
    if p > len(doc):
        print(f"  {sid} p.{p}: beyond the last page ({len(doc)})")
        continue
    text, method = doc[p - 1].get_text().strip(), "text-layer"
    if len(text) < 50 and (sid, p) in ocr:
        text, method = ocr[(sid, p)].strip(), "packet-ocr"
    if len(text) < 50:
        f = CACHE / "ocr" / sid / f"p{p}.txt"
        if f.exists():
            text, method = f.read_text().strip(), "vision-ocr"
    pages.setdefault(sid, {})[str(p)] = text
    methods[f"{sid}:{p}"] = method
    if (sid, p) in render_pages:
        out = PAGES_OUT / f"{sid.lower()}-p{p}.jpg"
        if not out.exists():
            pix = doc[p - 1].get_pixmap(matrix=fitz.Matrix(1.25, 1.25))
            pix.save(out, jpg_quality=80)

# The archived church page is HTML source; keep its text as the one "page" of that source.
church = (EVIDENCE / sources["CHURCH"]["path"]).read_text(errors="replace")
pages["CHURCH"] = {"1": church}
methods["CHURCH:1"] = "archived-html"
pages["CAPTIONS_UNT"] = {"1": (EVIDENCE / sources["CAPTIONS_UNT"]["path"]).read_text()}
methods["CAPTIONS_UNT:1"] = "automated-captions"

(CACHE / "pages.json").write_text(json.dumps({"pages": pages, "methods": methods}, indent=1))
shutil.copy(EVIDENCE / "CaseLens_BTK_Case_Packet.json", CACHE / "packet.json")
empty = [k for k, v in methods.items() if len(pages[k.split(":")[0]][k.split(":")[1]]) < 50]
by = {}
for m in methods.values():
    by[m] = by.get(m, 0) + 1
print(f"{len(methods)} cited pages: {by}; rendered {len(list(PAGES_OUT.glob('*.jpg')))} images; near-empty: {empty}")
