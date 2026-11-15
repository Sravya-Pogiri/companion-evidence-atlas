import { createFileRoute } from "@tanstack/react-router";
import { InvestigationStudio } from "@/components/investigate/studio";
import { ACTIVE_CASE } from "@/lib/active-case";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_workspace/investigate")({
  head: () => seo("Investigate", "Test a claim with a team of evidence agents built on LangChain Deep Agents."),
  component: Investigate,
});

function Investigate() {
  if (ACTIVE_CASE !== "btk")
    return (
      <div className="mx-auto max-w-2xl rounded-xl border bg-card p-6">
        <h1 className="font-serif text-2xl font-medium">Test a claim</h1>
        <p className="mt-2 text-muted-foreground">
          Claim investigations run on the State v. Rader case, whose records carry many dated entries. Switch the case in the
          top bar to State v. Rader (BTK) to use it.
        </p>
      </div>
    );
  return <InvestigationStudio caseId="btk" caseName="State of Kansas v. Rader, 05 CR 498" />;
}
