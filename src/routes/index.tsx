import { createFileRoute, redirect } from "@tanstack/react-router";

// The landing page is a static site in public/landing (plain HTML, CSS and JS, with a 3D
// casebook). Its buttons lead into the app at /live. The React landing page in
// src/components/landing is no longer routed.
//
// The page is not a route of this app, so it has to be a full page load. A server visit gets a
// redirect; a link clicked inside the app is told to load the page for real.
export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      window.location.assign("/landing/index.html");
      await new Promise<never>(() => {}); // stay put while the browser leaves
    }
    throw redirect({ href: "/landing/index.html" });
  },
});
