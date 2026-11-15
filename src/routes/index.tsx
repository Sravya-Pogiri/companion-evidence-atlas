import { createFileRoute, redirect } from "@tanstack/react-router";

// The landing page is a static site in public/landing (plain HTML, CSS and JS, with a 3D
// casebook). Its buttons lead into the app at /live. The React landing page in
// src/components/landing is no longer routed.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ href: "/landing/index.html" });
  },
});
