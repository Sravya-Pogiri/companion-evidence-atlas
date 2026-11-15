import { describe, expect, it } from "vitest";
import { checkScannedQuote } from "@/lib/evidence/verify";

const transcript = {
  page: 74,
  text: "        2     there are factual bases for each of these pleas of\n \n        3     guilty.  I will accept these pleas of guilty and\n \n        4     adjudge you, guilty of Count One",
};
const scan = { page: 2, text: "one\nDENNISL. RADER did then and there unlaw fully, kill" };
const other = { page: 3, text: "I will accept these pleas of guilty and adjudge you, guilty of Count One" };

describe("quotes on scanned and transcribed pages", () => {
  it("ignores transcript line numbers", () => {
    const r = checkScannedQuote([transcript], "I will accept these pleas of guilty and adjudge you, guilty of Count One", 74);
    expect(r).toMatchObject({ status: "exact", loose: true });
  });

  it("ignores OCR word splits but not changed letters", () => {
    expect(checkScannedQuote([scan], "DENNISL. RADER did then and there unlawfully, kill", 2).status).toBe("exact");
    expect(checkScannedQuote([scan], "DENNIS L. RADER did then and there lawfully kill", 2).status).toBe("missing");
  });

  it("only accepts the loose match on the cited page", () => {
    const r = checkScannedQuote([transcript, other], "I will accept these pleas of guilty and adjudge you, guilty of Count One", 74);
    expect(r.status).toBe("exact");
    expect(checkScannedQuote([scan, other], "I will accept these pleas of guilty and adjudge you", 2).status).toBe("moved");
  });

  it("rejects a date the page does not have", () => {
    const notary = { page: 5, text: "SUBSCRIBED AND SWORN to before me\nday of\n- 2005.\nMarch" };
    expect(checkScannedQuote([notary], "SUBSCRIBED AND SWORN to before me this 1st day of March, 2005.", 5).status).toBe("missing");
  });
});
