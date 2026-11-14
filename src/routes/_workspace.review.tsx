import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/caselens/shared";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_workspace/review")({
  head: () => seo("Review", "Flagged items waiting for a person to confirm, dismiss, or follow up."),
  component: Page,
});

function Page() {
  return <PageHeader title="Review" desc="Built in Phase 2." />;
}
