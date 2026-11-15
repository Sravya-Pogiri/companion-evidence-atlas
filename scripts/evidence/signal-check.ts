// Targeted turn-signal check on consecutive full-resolution frames, then a cross-check with the
// documents. Two model requests at most. Adds to src/data/<caseId>/analysis.json.
//
//   npx tsx --env-file=.env scripts/evidence/signal-check.ts --case rosales --source dashcam \
//     --measure DIR/lamps.json --strip DIR/strip-1.jpg [--dry]
//
// The lamp measurement (signal.py, no model) and a blind vision read of the same frames must
// agree before anything is claimed. If they do not, the result is recorded as "not visible
// enough" and no finding is made.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { askJsonParts, providerStats } from "../../src/lib/ai/provider.server";
import type { CaseAnalysis, Claim, Finding } from "../../src/lib/evidence/types";
import { VISION_SYSTEM, XCHECK_SYSTEM } from "./prompts";

const args = process.argv.slice(2);
const opt = (n: string, d = "") => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1]! : d;
};
const DRY = args.includes("--dry");
const caseId = opt("--case", "rosales");
const source = opt("--source", "dashcam");
const measure = JSON.parse(readFileSync(opt("--measure"), "utf8")) as {
  t: number;
  car: number[] | null;
  left_px?: number;
  right_px?: number;
}[];
const stripPath = opt("--strip");
const CACHE = join("cache", caseId, "model");
const OUT = join("src", "data", caseId, "analysis.json");
mkdirSync(CACHE, { recursive: true });
const LIT_PX = 40;

const analysis = JSON.parse(readFileSync(OUT, "utf8")) as CaseAnalysis;
const log = (s: string) => {
  analysis.log.push(s);
  console.log(s);
};

async function cached<T>(key: string, call: () => Promise<unknown>): Promise<T | null> {
  const file = join(CACHE, `${createHash("sha256").update(key).digest("hex").slice(0, 24)}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as T;
  if (DRY) return null;
  const v = await call();
  writeFileSync(file, JSON.stringify(v, null, 1));
  return v as T;
}

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

async function main() {
  const t0 = Date.now();
  const [lo, hi] = opt("--window", "0-99999").split("-").map(Number) as [number, number];
  const rows = measure.filter((r) => r.car && r.t >= lo && r.t <= hi);
  if (rows.length < 8) throw new Error("not enough frames with both lamps found");
  const legend = rows.map((r, i) => `cell ${i + 1}: ${r.t.toFixed(2)}s`).join("; ");
  const strip = readFileSync(stripPath).toString("base64");
  log(`signal check: ${rows.length} consecutive frames ${rows[0]!.t}-${rows.at(-1)!.t}s of ${source}`);

  // 1. Blind vision read of each frame (the model is not told the measurement).
  type Cell = { t: number; left: string; right: string };
  const read = await cached<{ cells?: Cell[] }>(`signal-read:${source}:${createHash("sha256").update(strip).digest("hex")}`, () =>
    askJsonParts(
      VISION_SYSTEM,
      [
        {
          type: "input_text",
          text: `These are ${rows.length} consecutive enlarged frames of the same red car seen from behind, in a grid read left to right, top to bottom (${legend}).
For each cell, say whether the car's left rear lamp (on the viewer's left) and right rear lamp (viewer's right) appear lit, unlit, or unclear.
Brake lamps may be on in some frames. Judge each cell on its own.
Return {"cells":[{"t": seconds, "left": "lit|unlit|unclear", "right": "lit|unlit|unclear"}]}.`,
        },
        { type: "input_image", image_url: `data:image/jpeg;base64,${strip}` },
      ],
      { timeoutMs: 90_000 },
    ),
  );
  const cells = read?.cells ?? [];

  // 2. Compare the vision read with the pixel measurement.
  const measuredLeft = rows.map((r) => (r.left_px ?? 0) >= LIT_PX);
  const measuredRight = rows.map((r) => (r.right_px ?? 0) >= LIT_PX);
  const seenLeft = rows.map((r) => cells.find((c) => Math.abs(Number(c.t) - r.t) < 0.05)?.left ?? "unclear");
  const seenRight = rows.map((r) => cells.find((c) => Math.abs(Number(c.t) - r.t) < 0.05)?.right ?? "unclear");
  const agreeLeft = seenLeft.filter((s, i) => (s === "lit") === measuredLeft[i] && s !== "unclear").length;
  const agreeRight = seenRight.filter((s, i) => (s === "lit") === measuredRight[i] && s !== "unclear").length;
  const transitions = measuredLeft.filter((v, i) => i > 0 && v !== measuredLeft[i - 1]).length;
  const rightSteady = measuredRight.filter(Boolean).length >= rows.length - 1;
  const lits = measuredLeft.map((v, i) => (v && !measuredLeft[i - 1] ? rows[i]!.t : null)).filter((v): v is number => v !== null);
  const period = lits.length >= 2 ? (lits.at(-1)! - lits[0]!) / (lits.length - 1) : null;
  log(
    `  measured left: ${measuredLeft.map((v) => (v ? "on" : "off")).join(" ")} | right steady: ${rightSteady} | left transitions: ${transitions}${period ? ` | period ~${period.toFixed(2)}s` : ""}`,
  );
  log(`  vision left:   ${seenLeft.join(" ")}`);
  log(`  agreement with measurement: left ${agreeLeft}/${rows.length}, right ${agreeRight}/${rows.length}`);

  const passed = agreeLeft >= rows.length - 2 && agreeRight >= rows.length - 2 && transitions >= 3 && rightSteady;
  const start = rows[0]!.t;
  const end = rows.at(-1)!.t;
  const frameName = `${source}-signal-${String(Math.round(start)).padStart(4, "0")}.jpg`;
  const claim: Claim = {
    id: `${source}-signal-001`,
    origin: "video",
    claim: passed
      ? `From about ${mmss(start)} to ${mmss(end)} the red car's left rear lamp appears to switch on and off about every ${period ? period.toFixed(1) : "0.7"} s while the right rear lamp stays lit, a pattern consistent with a flashing left turn signal.`
      : `The red car's rear lamps from about ${mmss(start)} to ${mmss(end)} could not be read reliably enough to say whether a turn signal is flashing.`,
    at: { source, t: Math.round(start) },
    verification: passed
      ? {
          status: "passed",
          method: "frame-sequence-check",
          note: `${rows.length} consecutive frames at 6 fps: pixel measurement and a blind vision read agree (left ${agreeLeft}/${rows.length}, right ${agreeRight}/${rows.length}); left lamp changes state ${transitions} times, right stays lit.`,
        }
      : {
          status: "failed",
          method: "frame-sequence-check",
          note: `Not visible enough: measurement and vision read agree on only left ${agreeLeft}/${rows.length}, right ${agreeRight}/${rows.length} (or no regular on/off pattern).`,
        },
  };
  if (passed) {
    const dest = join("public", "frames", "analysis", frameName);
    if (!DRY) copyFileSync(stripPath, dest);
    claim.frameRef = `/frames/analysis/${frameName}`;
  }
  analysis.claims = analysis.claims.filter((c) => c.id !== claim.id).concat(claim);

  // 3. Cross-check the new claim with the verified document claims (one request).
  if (passed) {
    const pool = analysis.claims.filter(
      (c) => (c.verification.status === "passed" || c.verification.status === "fixed") && (c.id === claim.id || c.at.source !== source),
    );
    const list = pool
      .map((c) => {
        const where = "page" in c.at ? `p.${c.at.page}${c.at.paragraph ? ` ¶${c.at.paragraph}` : ""}` : mmss(c.at.t);
        return `${c.id} | ${c.at.source} ${where} | ${c.claim}${c.exactQuote ? ` | "${c.exactQuote}"` : ""}`;
      })
      .join("\n");
    const xr = await cached<{ findings?: { kind: string; title: string; explanation: string; claimIds: string[] }[] }>(
      `signal-xcheck:${createHash("sha256").update(list).digest("hex")}`,
      () =>
        askJsonParts(
          XCHECK_SYSTEM,
          [
            {
              type: "input_text",
              text: `CLAIMS (id | source and location | claim | quote):\n${list}\n
Only report findings that involve claim ${claim.id}. Return {"findings":[{"kind":"conflict|agrees|missing","title":"short","explanation":"one or two hedged sentences","claimIds":["..."]}]}. At most 3.`,
            },
          ],
          { timeoutMs: 120_000, effort: "medium" },
        ),
    );
    const byId = new Map(analysis.claims.map((c) => [c.id, c]));
    const CONCLUSIVE = /\b(guilty|innocent|illegal(ly)?|unlawful(ly)?|lied|lying|fabricat\w*|proves?|violat\w*|unconstitutional)\b/i;
    let n = analysis.findings.length;
    for (const f of xr?.findings ?? []) {
      if (!["conflict", "agrees"].includes(f.kind) || !Array.isArray(f.claimIds) || !f.claimIds.includes(claim.id)) continue;
      const cited = f.claimIds.map((id) => byId.get(id));
      const finding: Finding = {
        id: `finding-${++n}`,
        kind: f.kind as Finding["kind"],
        title: String(f.title).trim(),
        explanation: String(f.explanation ?? "").trim(),
        claimIds: f.claimIds,
        status: "verified",
      };
      const bad = cited.some((c) => !c || !["passed", "fixed"].includes(c.verification.status));
      const sources = new Set(cited.map((c) => c?.at.source));
      if (bad) Object.assign(finding, { status: "dropped", droppedBecause: "cites an unknown or unverified claim" });
      else if (sources.size < 2) Object.assign(finding, { status: "dropped", droppedBecause: "needs two different sources" });
      else if (CONCLUSIVE.test(`${finding.title} ${finding.explanation}`))
        Object.assign(finding, { status: "dropped", droppedBecause: "uses conclusive language" });
      // Replace an earlier finding from this check with the same citations.
      analysis.findings = analysis.findings.filter((x) => x.claimIds.slice().sort().join() !== f.claimIds.slice().sort().join());
      analysis.findings.push(finding);
      log(`  finding [${finding.status}] ${finding.kind}: ${finding.title}${finding.droppedBecause ? ` (${finding.droppedBecause})` : ""}`);
    }
  } else {
    log("  no finding: lamps not visible enough to tell");
  }

  analysis.timings["signal check"] = Math.round((Date.now() - t0) / 100) / 10;
  if (!DRY) writeFileSync(OUT, JSON.stringify(analysis, null, 1));
  log(`provider: ${JSON.stringify(providerStats())}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
