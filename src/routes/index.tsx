import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    seo(
      "Evidence timelines for public defenders",
      "Text evidence to one number. Lexora puts every photo, page and voice note on a live timeline, linked to its source.",
    ),
  component: LandingPage,
});
