import { describe, expect, it } from "vitest";
import { checkQuote, inTranscript, normalizeText } from "@/lib/evidence/verify";

const pages = [
  { page: 23, text: "203.  Lewis asked Gracie where they were going.\n204.  She answered." },
  {
    page: 24,
    text: "208.  Officer Terrell responded, “Failure to signal. That’s straight, pure and \nstraight honest answer.”",
  },
  { page: 25, text: "211.  Officer Lewis then walked back to the patrol car and wrote a ticket for fail-\ning to signal." },
];

describe("evidence verification", () => {
  it("normalizes quotes, dashes, hyphenated line breaks and spacing", () => {
    expect(normalizeText("That’s  straight — fail-\ning")).toBe("that's straight - failing");
  });

  it("finds a quote on its cited page despite curly quotes and line breaks", () => {
    expect(checkQuote(pages, "Failure to signal. That's straight, pure and straight honest answer.", 24)).toEqual({
      status: "exact",
      page: 24,
    });
  });

  it("reports the right page when the citation names the wrong one", () => {
    expect(checkQuote(pages, "wrote a ticket for failing to signal", 24)).toEqual({ status: "moved", page: 25 });
  });

  it("rejects a quote that is not in the document", () => {
    expect(checkQuote(pages, "the officer saw no turn signal at all", 24)).toEqual({ status: "missing" });
  });

  it("rejects quotes too short to mean anything", () => {
    expect(checkQuote(pages, "signal", 24)).toEqual({ status: "missing" });
  });

  it("matches transcript quotes after normalization", () => {
    expect(inTranscript("OFFICER: Failure to signal. That's it.", "failure to signal")).toBe(true);
    expect(inTranscript("OFFICER: Have a good day.", "failure to signal")).toBe(false);
  });
});
