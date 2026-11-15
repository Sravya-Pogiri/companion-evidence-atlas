#!/usr/bin/env python3
"""Measure the lead car's rear lamps across consecutive frames (no model calls).

  python3 scripts/evidence/signal.py FRAMES_DIR --start 40 --fps 6 --out DIR

FRAMES_DIR holds consecutive full-resolution frames (ffmpeg -ss START -vf fps=FPS). For each frame
the red car nearest the camera's lane is found by colour, and the mean brightness of lit red
pixels is measured in its left and right lamp regions. A turn signal shows as a regular on/off
rhythm on one side (about 1-2 Hz); brake lamps stay steady on both sides. Writes:
  DIR/lamps.json            per-frame measurements
  DIR/crops/NNNN.jpg        2x crops of the car, for review and for a batched vision check
  DIR/strip-K.jpg           crops tiled with their timestamps written above them
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def lamp_mask(a: np.ndarray) -> np.ndarray:
    """Lit red lamp pixels: bright and strongly red."""
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (r > 170) & (r > g * 1.7) & (r > b * 1.7)


REGION = (0.30, 0.75, 0.45, 0.98)  # x0, x1, y0, y1 as fractions: the lane ahead


def find_lamps(a: np.ndarray):
    """The lead car's two rear lamp clusters: [(x0, y0, x1, y1) left, ... right] or None."""
    h, w, _ = a.shape
    X0, X1, Y0, Y1 = int(w * REGION[0]), int(w * REGION[1]), int(h * REGION[2]), int(h * REGION[3])
    m = lamp_mask(a[Y0:Y1, X0:X1])
    cols = np.where(m.sum(axis=0) > 0)[0]
    if len(cols) < 4:
        return None
    gaps = np.diff(cols)
    # Lamps on one car are 40-200 px apart at this resolution; split at the widest gap in range.
    order = np.argsort(gaps)[::-1]
    split = next((i for i in order if 25 <= gaps[i] <= 220), None)
    if split is None:
        return None
    boxes = []
    for cs in (cols[: split + 1], cols[split + 1:]):
        sub = m[:, cs[0]:cs[-1] + 1]
        rs = np.where(sub.sum(axis=1) > 0)[0]
        boxes.append((X0 + int(cs[0]), Y0 + int(rs[0]), X0 + int(cs[-1]), Y0 + int(rs[-1])))
    return boxes


def lamp_level(a: np.ndarray, box) -> dict:
    """How lit a lamp is: count of lit pixels and their mean red value, in a padded box."""
    x0, y0, x1, y1 = box
    pad = 6
    reg = a[max(0, y0 - pad):y1 + pad + 1, max(0, x0 - pad):x1 + pad + 1]
    m = lamp_mask(reg)
    return {"px": int(m.sum()), "red": round(float(reg[..., 0][m].mean()), 1) if m.any() else 0.0}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("frames")
    ap.add_argument("--start", type=float, required=True)
    ap.add_argument("--fps", type=float, required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--per-strip", type=int, default=12)
    ap.add_argument("--window", default="", help="only frames in this time range for strips, e.g. 44.1-46.1")
    a = ap.parse_args()
    out = Path(a.out)
    (out / "crops").mkdir(parents=True, exist_ok=True)

    rows = []
    for i, f in enumerate(sorted(Path(a.frames).glob("*.jpg"))):
        t = round(a.start + i / a.fps, 2)
        img = Image.open(f).convert("RGB")
        arr = np.asarray(img)
        lamps = find_lamps(arr)
        if not lamps:
            rows.append({"t": t, "frame": f.name, "car": None})
            continue
        (lx0, ly0, lx1, ly1), (rx0, ry0, rx1, ry1) = lamps
        box = (lx0, min(ly0, ry0), rx1, max(ly1, ry1))
        x0, y0, x1, y1 = box
        padx, pady = int((x1 - x0) * 0.35), int((x1 - x0) * 0.45)
        crop = img.crop((max(0, x0 - padx), max(0, y0 - pady), min(img.width, x1 + padx), min(img.height, y1 + pady)))
        crop = crop.resize((crop.width * 3, crop.height * 3), Image.LANCZOS)
        crop.save(out / "crops" / f.name, quality=92)
        L, R = lamp_level(arr, lamps[0]), lamp_level(arr, lamps[1])
        rows.append({"t": t, "frame": f.name, "car": [int(v) for v in box],
                     "left": L["red"], "left_px": L["px"], "right": R["red"], "right_px": R["px"]})

    # Strips of consecutive crops, each labelled with its timestamp.
    found = [r for r in rows if r.get("car")]
    if a.window:
        lo, hi = (float(v) for v in a.window.split("-"))
        found = [r for r in found if lo <= r["t"] <= hi]
    for k in range(0, len(found), a.per_strip):
        group = found[k:k + a.per_strip]
        crops = [Image.open(out / "crops" / r["frame"]) for r in group]
        cw, ch = max(c.width for c in crops), max(c.height for c in crops)
        cols = 4
        nrows = (len(crops) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cw, nrows * (ch + 22)), "black")
        d = ImageDraw.Draw(sheet)
        for j, (c, r) in enumerate(zip(crops, group)):
            x, y = (j % cols) * cw, (j // cols) * (ch + 22)
            d.text((x + 4, y + 4), f"{r['t']:.2f}s", fill="white")
            sheet.paste(c, (x, y + 22))
        sheet.save(out / f"strip-{k // a.per_strip + 1}.jpg", quality=90)

    (out / "lamps.json").write_text(json.dumps(rows, indent=1))
    print(f"{len(found)}/{len(rows)} frames with the car; strips: {(len(found) + a.per_strip - 1) // a.per_strip}")


if __name__ == "__main__":
    main()
