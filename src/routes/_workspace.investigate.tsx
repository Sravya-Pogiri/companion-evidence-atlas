import { createFileRoute } from "@tanstack/react-router";
import { InvestigationStudio } from "@/components/investigate/studio";
import { ACTIVE_CASE } from "@/lib/active-case";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_workspace/investigate")({
  head: () => seo("Investigate", "Test a claim with a team of evidence agents built on LangChain Deep Agents."),
  component: Investigate,
});

function Investigate() {
  // The studio remounts per case, so a run from one case never shows on the other.
  return ACTIVE_CASE === "btk" ? (
    <InvestigationStudio key="btk" caseId="btk" caseName="State of Kansas v. Rader, 05 CR 498" />
  ) : (
    <InvestigationStudio key="rosales" caseId="rosales" caseName="Rosales v. Terrell, No. 25-30650" />
  );
}
