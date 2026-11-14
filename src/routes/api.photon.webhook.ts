import { createFileRoute } from "@tanstack/react-router";

// Photon's webhook target. Not a page: it only accepts signed POSTs and is a no-op (404)
// unless CASELENS_CHANNEL=photon and the Photon env vars are set.
export const Route = createFileRoute("/api/photon/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handlePhotonWebhook } = await import("@/lib/server/photon-webhook.server");
        return handlePhotonWebhook(request);
      },
    },
  },
});
