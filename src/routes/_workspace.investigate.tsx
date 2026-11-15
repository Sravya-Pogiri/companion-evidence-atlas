import { createFileRoute } from "@tanstack/react-router";
import { InvestigationStudio } from "@/components/investigate/studio";
import { ACTIVE_CASE, switchCase } from "@/lib/active-case";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_workspace/investigate")({
  head: () => seo("Investigate", "Test a Claim with a team of evidence agents built on LangChain Deep Agents."),
  component: Investigate,
});

function Investigate() {
  // Investigations read a case's stored evidence, which Rosales and State v. Rader have. The
  // public-record cases from the landing page's library are summaries, so they are not offered.
  if (ACTIVE_CASE !== "btk" && ACTIVE_CASE !== "rosales")
    return (
      <div className="mx-auto max-w-2xl rounded-xl border bg-card p-6">
        <h1 className="font-serif text-2xl font-medium">Test a Claim</h1>
        <p className="mt-2 text-muted-foreground">
          Claim investigations read a case&apos;s stored evidence: the filings, transcripts and records of Rosales v. Terrell
          and State v. Rader. This case is summarized from public sources, so it is not available here.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => switchCase("rosales")} className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-[#14120d] hover:bg-[#d6b77c]">
            Investigate Rosales v. Terrell
          </button>
          <button type="button" onClick={() => switchCase("btk")} className="rounded-md border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/5">
            Investigate State v. Rader
          </button>
        </div>
      </div>
    );
  // The studio remounts per case, so a run from one case never shows on the other.
  return ACTIVE_CASE === "btk" ? (
    <InvestigationStudio key="btk" caseId="btk" caseName="State of Kansas v. Rader, 05 CR 498" />
  ) : (
    <InvestigationStudio key="rosales" caseId="rosales" caseName="Rosales v. Terrell, No. 25-30650" />
  );
}
