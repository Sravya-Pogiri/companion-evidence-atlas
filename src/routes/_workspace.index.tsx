import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/caselens/shared";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_workspace/")({
  head: () => seo("Live Case", "Text evidence to one number and watch it land on a live case timeline."),
  component: Page,
});

function Page() {
  return <PageHeader title="Live Case" desc="Built in Phase 2." />;
}
