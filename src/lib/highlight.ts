// Splits a paragraph into plain runs and marked runs. Finding marks match an exact phrase once;
// entity mentions match whole words everywhere. Where they overlap, the finding wins.

export interface Mark {
  phrase: string;
  kind: "finding" | "entity";
  id: string;
}

export interface Run {
  text: string;
  mark?: Mark;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function segment(text: string, marks: Mark[]): Run[] {
  const ranges: { start: number; end: number; mark: Mark; rank: number }[] = [];
  for (const mark of marks) {
    if (!mark.phrase) continue;
    if (mark.kind === "finding") {
      const at = text.indexOf(mark.phrase);
      if (at >= 0) ranges.push({ start: at, end: at + mark.phrase.length, mark, rank: 0 });
    } else {
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${escape(mark.phrase)}(?![\\p{L}\\p{N}])`, "gu");
      for (const m of text.matchAll(re)) {
        ranges.push({ start: m.index, end: m.index + m[0].length, mark, rank: 1 });
      }
    }
  }
  // Findings first, then longer phrases, so "Mario Rosales" beats "Mario".
  ranges.sort(
    (a, b) => a.rank - b.rank || b.end - b.start - (a.end - a.start) || a.start - b.start,
  );
  const kept: typeof ranges = [];
  for (const r of ranges) {
    if (!kept.some((k) => r.start < k.end && k.start < r.end)) kept.push(r);
  }
  kept.sort((a, b) => a.start - b.start);

  const runs: Run[] = [];
  let at = 0;
  for (const r of kept) {
    if (r.start > at) runs.push({ text: text.slice(at, r.start) });
    runs.push({ text: text.slice(r.start, r.end), mark: r.mark });
    at = r.end;
  }
  if (at < text.length) runs.push({ text: text.slice(at) });
  return runs;
}
