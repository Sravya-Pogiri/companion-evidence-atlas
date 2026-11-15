#!/usr/bin/env python3
"""Offline ingest for a case: deterministic, no model calls, cached so it runs once.

  python3 scripts/evidence/ingest.py scripts/evidence/rosales.case.json --media DIR [--force]

Needs PyMuPDF (pip install pymupdf) and ffmpeg (on PATH, or FFMPEG=/path/to/ffmpeg).
Writes cache/<caseId>/:
  manifest.json                 sources, hashes, durations, what was produced
  <pdf>/pages.json              text per PDF page, plus numbered paragraphs when the document uses them
  <video>/frames/NNNNN.jpg      one frame every STEP seconds (t = (N-1) * STEP)
  <video>/scenes.json           timestamps of scene changes
  <video>/sheets/SSS.jpg        4x4 contact sheets of the 2 s frames, for batched vision calls
  <video>/sheets.json           which timestamps each sheet cell holds
  <video>/audio/speech.json     1 s energy windows and the speech segments cut from them
  <video>/audio/seg-NNN.mp3     speech segments (<= 60 s) for transcription
"""
import argparse
import array
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

STEP = 2          # seconds between sampled frames
SHEET = 4         # SHEET x SHEET frames per contact sheet
SCENE = 0.30      # scene-change threshold
SPEECH_DB = -42.0  # 1 s windows louder than this (dBFS RMS) count as possible speech
MAX_SEG = 60


def ffmpeg() -> str:
    exe = os.environ.get("FFMPEG") or shutil.which("ffmpeg")
    if not exe:
        sys.exit("ffmpeg not found: put it on PATH or set FFMPEG=/path/to/ffmpeg")
    return exe


def run(args, capture=False):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"{args[0]} failed: {r.stderr[-800:]}")
    return r.stderr if capture else None


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def duration(path: Path) -> float:
    err = subprocess.run([ffmpeg(), "-i", str(path)], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]) if m else 0.0


# ---------- PDF ----------

PARA = re.compile(r"(?m)^\s*(\d{1,3})\.\s{1,}(?=\S)")
# Court page stamps ("Case 1:22-cv-05838 Document 1 Filed ...", "Case: 25-30650 Document: 84-1 ...").
FOOTER = re.compile(r"(?m)^\s*Case:?\s+\S+\s+Document:?\s.*$")


def ingest_pdf(src: dict, path: Path, out: Path) -> dict:
    import fitz  # PyMuPDF

    doc = fitz.open(path)
    pages = []
    for i, page in enumerate(doc, start=1):
        text = FOOTER.sub("", page.get_text())
        entry = {"page": i, "text": text}
        if src.get("numberedParagraphs"):
            paras = []
            marks = list(PARA.finditer(text))
            for j, m in enumerate(marks):
                end = marks[j + 1].start() if j + 1 < len(marks) else len(text)
                body = " ".join(text[m.end():end].split())
                paras.append({"num": int(m[1]), "text": body})
            entry["paragraphs"] = paras
        pages.append(entry)
    (out / "pages.json").write_text(json.dumps(pages, ensure_ascii=False, indent=1))
    return {"pages": len(pages), "chars": sum(len(p["text"]) for p in pages)}


# ---------- Video ----------

def ingest_video(src: dict, path: Path, out: Path) -> dict:
    ff = ffmpeg()
    dur = duration(path)
    frames = out / "frames"
    frames.mkdir(parents=True, exist_ok=True)
    # One frame every STEP s. fps_mode vfr writes only the selected frames (no duplicates).
    run([ff, "-v", "error", "-y", "-i", str(path), "-vf", f"fps=1/{STEP},scale=320:-2",
         "-fps_mode", "vfr", "-q:v", "4", str(frames / "%05d.jpg")])
    n_frames = len(list(frames.glob("*.jpg")))

    # Scene changes, with their times read from showinfo.
    err = run([ff, "-v", "info", "-i", str(path), "-vf", f"select='gt(scene,{SCENE})',showinfo",
               "-fps_mode", "vfr", "-f", "null", "-"], capture=True)
    scenes = [round(float(t), 2) for t in re.findall(r"pts_time:([\d.]+)", err)]
    (out / "scenes.json").write_text(json.dumps(scenes))

    # Contact sheets for batched vision calls.
    sheets = out / "sheets"
    sheets.mkdir(exist_ok=True)
    per = SHEET * SHEET
    run([ff, "-v", "error", "-y", "-i", str(frames / "%05d.jpg"), "-vf",
         f"tile={SHEET}x{SHEET}:padding=4:color=black", "-fps_mode", "vfr", "-q:v", "4",
         str(sheets / "%03d.jpg")])
    sheet_index = []
    for s in sorted(sheets.glob("*.jpg")):
        k = int(s.stem) - 1
        times = [(k * per + c) * STEP for c in range(per) if k * per + c < n_frames]
        sheet_index.append({"file": s.name, "grid": SHEET, "times": times})
    (out / "sheets.json").write_text(json.dumps(sheet_index, indent=1))

    audio = ingest_audio(path, out / "audio", dur)
    return {"duration": round(dur, 2), "frames": n_frames, "step": STEP, "scenes": len(scenes),
            "sheets": len(sheet_index), **audio}


def ingest_audio(path: Path, out: Path, dur: float) -> dict:
    """Energy-gate the audio so silence is never sent for transcription."""
    ff = ffmpeg()
    out.mkdir(parents=True, exist_ok=True)
    raw = subprocess.run([ff, "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", "8000",
                          "-f", "s16le", "-"], capture_output=True)
    if raw.returncode != 0 or not raw.stdout:
        (out / "speech.json").write_text(json.dumps({"hasAudio": False, "segments": []}))
        return {"hasAudio": False, "speechSegments": 0}
    pcm = array.array("h")
    pcm.frombytes(raw.stdout[: len(raw.stdout) // 2 * 2])
    windows = []
    for s in range(0, len(pcm) // 8000):
        w = pcm[s * 8000:(s + 1) * 8000]
        rms = (sum(x * x for x in w) / len(w)) ** 0.5 if len(w) else 0
        db = -120.0 if rms < 1 else 20 * __import__("math").log10(rms / 32768)
        windows.append(round(db, 1))
    loud = [i for i, db in enumerate(windows) if db > SPEECH_DB]
    # Merge loud seconds (gaps < 3 s) into segments, then split anything over MAX_SEG.
    segs = []
    for i in loud:
        if segs and i - segs[-1][1] <= 3:
            segs[-1][1] = i + 1
        else:
            segs.append([i, i + 1])
    pieces = []
    for a, b in segs:
        if b - a < 2:
            continue
        while a < b:
            pieces.append([a, min(b, a + MAX_SEG)])
            a += MAX_SEG
    files = []
    for k, (a, b) in enumerate(pieces, start=1):
        f = out / f"seg-{k:03d}.mp3"
        run([ff, "-v", "error", "-y", "-ss", str(a), "-t", str(b - a), "-i", str(path), "-vn",
             "-ac", "1", "-ar", "16000", "-b:a", "48k", str(f)])
        files.append({"file": f.name, "start": a, "end": b})
    (out / "speech.json").write_text(json.dumps(
        {"hasAudio": True, "thresholdDb": SPEECH_DB, "windowsDb": windows, "segments": files}))
    return {"hasAudio": True, "speechSegments": len(files),
            "speechSeconds": sum(f["end"] - f["start"] for f in files)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("case")
    ap.add_argument("--media", required=True, help="folder holding the files named in the case")
    ap.add_argument("--cache", default="cache")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    case = json.loads(Path(a.case).read_text())
    root = Path(a.cache) / case["caseId"]
    root.mkdir(parents=True, exist_ok=True)
    manifest_path = root / "manifest.json"
    old = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"sources": {}}
    manifest = {"caseId": case["caseId"], "sources": {}, "expected": case.get("expected", [])}
    t0 = time.time()

    for src in case["sources"]:
        path = Path(a.media) / src["file"]
        if not path.exists():
            print(f"  ! {src['id']}: {path} not found, skipped")
            manifest["sources"][src["id"]] = {**src, "status": "missing"}
            continue
        digest = sha256(path)
        prev = old["sources"].get(src["id"], {})
        out = root / src["id"]
        if not a.force and prev.get("sha256") == digest and prev.get("status") == "ok":
            print(f"  = {src['id']}: cached")
            manifest["sources"][src["id"]] = prev
            continue
        if out.exists():
            shutil.rmtree(out)
        out.mkdir(parents=True)
        t = time.time()
        info = ingest_pdf(src, path, out) if src["kind"] == "pdf" else ingest_video(src, path, out)
        manifest["sources"][src["id"]] = {**src, "status": "ok", "sha256": digest,
                                          "bytes": path.stat().st_size, **info,
                                          "seconds": round(time.time() - t, 1)}
        print(f"  + {src['id']}: {info} in {time.time() - t:.1f}s")

    manifest["ingestSeconds"] = round(time.time() - t0, 1)
    manifest_path.write_text(json.dumps(manifest, indent=1))
    print(f"done in {manifest['ingestSeconds']}s -> {manifest_path}")


if __name__ == "__main__":
    main()
