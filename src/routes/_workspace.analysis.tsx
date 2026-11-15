import { createFileRoute } from "@tanstack/react-router";
import { CaseAnalysis } from "@/components/case-analysis/workspace-layout";
import { CaseFile } from "@/components/cases/case-file";
import { useActiveCase } from "@/lib/case-store";
import analysisCss from "@/components/case-analysis/case-analysis.css?url";
import { seo } from "@/lib/seo";

// The Case Analysis tab. Its scoped stylesheet loads here only; it uses the same dark palette as the rest of the app.
export const Route = createFileRoute("/_workspace/analysis")({
  head: () => ({
    ...seo(
      "Case Analysis",
      "Ingest, extract, order, flag and draft: every finding linked back to its source.",
    ),
    links: [{ rel: "stylesheet", href: analysisCss }],
  }),
  component: AnalysisPage,
});

/** Case Analysis is built around the Rosales documents and footage. Other cases get their case file. */
function AnalysisPage() {
  const meta = useActiveCase();
  return meta.kind === "dated" ? <CaseFile caseId={meta.id} /> : <CaseAnalysis />;
}
