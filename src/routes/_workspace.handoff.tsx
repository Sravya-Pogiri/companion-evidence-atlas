import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/caselens/shared";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_workspace/handoff")({
  head: () => seo("Handoff", "One-page summary of confirmed items with sources, ready for an attorney."),
  component: Page,
});

function Page() {
  return <PageHeader title="Handoff" desc="Built in Phase 2." />;
}
