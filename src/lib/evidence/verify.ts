// Pure checks used by the analysis to verify citations. No I/O, so they are easy to test.

/** Normalize text so a quote matches its source despite PDF line breaks and typography. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/(\w)-\s*\n\s*(\w)/g, "$1$2") // words split across lines
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export interface PageText {
  page: number;
  text: string;
}

export type QuoteCheck =
  | { status: "exact"; page: number }
  | { status: "moved"; page: number }
  | { status: "missing" };

/** Does `quote` appear on `page`? If not, does it appear on some other page? */
export function checkQuote(pages: PageText[], quote: string, page: number): QuoteCheck {
  const q = normalizeText(quote).replace(/^["']|["']$/g, "");
  if (q.length < 8) return { status: "missing" };
  const on = pages.find((p) => p.page === page);
  if (on && normalizeText(on.text).includes(q)) return { status: "exact", page };
  const norm = pages.map((p) => ({ page: p.page, text: normalizeText(p.text) }));
  const whole = norm.find((p) => p.text.includes(q));
  if (whole) return { status: "moved", page: whole.page };
  // Only now: a quote that straddles a page break (in neither page alone).
  for (let i = 0; i + 1 < pages.length; i++) {
    const joined = normalizeText(`${pages[i]!.text}\n${pages[i + 1]!.text}`);
    if (joined.includes(q)) {
      const first = pages[i]!.page;
      const second = pages[i + 1]!.page;
      return first === page || second === page
        ? { status: "exact", page }
        : { status: "moved", page: first };
    }
  }
  return { status: "missing" };
}

/** Is `quote` in a transcript, after the same normalization? */
export function inTranscript(transcript: string, quote: string): boolean {
  const q = normalizeText(quote).replace(/^["']|["']$/g, "");
  return q.length >= 6 && normalizeText(transcript).includes(q);
}

/** Court-transcript line numbers (1 to 25 at the start of each line) are layout, not text. */
function stripLineNumbers(s: string): string {
  return s.replace(/^[ \t]*\d{1,2}[ \t]+(?=\S)/gm, "");
}

const squeeze = (s: string) => normalizeText(s).replace(/\s+/g, "");

/**
 * Like checkQuote, for scanned or transcribed pages: when the quote is not on the cited page
 * as is, it may still match once transcript line numbers are removed and spacing is ignored
 * (OCR splits and joins words: "unlaw fully", "custody ofthe"). Every letter must still match
 * in order; a reworded or invented quote does not pass. Only the cited page is searched.
 */
export function checkScannedQuote(
  pages: PageText[],
  quote: string,
  page: number,
): QuoteCheck & { loose?: boolean } {
  const strict = checkQuote(pages, quote, page);
  if (strict.status === "exact") return strict;
  const on = pages.find((p) => p.page === page);
  const q = squeeze(quote).replace(/^["']|["']$/g, "");
  if (on && q.length >= 20 && squeeze(stripLineNumbers(on.text)).includes(q)) {
    return { status: "exact", page, loose: true };
  }
  return strict;
}
