import { createFileRoute } from "@tanstack/react-router";
import { CaseAnalysis } from "@/components/case-analysis/workspace-layout";
import analysisCss from "@/components/case-analysis/case-analysis.css?url";
import { seo } from "@/lib/seo";

// The Case Analysis tab. Its light editorial styles and serif font load here only.
export const Route = createFileRoute("/_workspace/analysis")({
  head: () => ({
    ...seo(
      "Case Analysis",
      "Ingest, extract, order, flag and draft: every finding linked back to its source.",
    ),
    links: [
      { rel: "stylesheet", href: analysisCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap",
      },
    ],
  }),
  component: CaseAnalysis,
});
