import { createFileRoute, redirect } from "@tanstack/react-router";
// The synthetic comparison was retired; the real-case comparison lives in the Rosales walkthrough.
export const Route = createFileRoute("/_workspace/contradictions")({
  validateSearch: (search: Record<string, unknown>): { finding?: string } => typeof search["finding"] === "string" ? { finding: search["finding"] } : {},
  beforeLoad: () => { throw redirect({ to: "/rosales" }); },
});
