// Server only. The handler behind POST /api/photon/webhook.
import { verifyWebhook } from "@/lib/channel/photon-events";
import { getPhotonRuntime } from "./channel.server";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function handlePhotonWebhook(request: Request): Promise<Response> {
  const runtime = getPhotonRuntime();
  if (!runtime) return json(404, { error: "The Photon channel is not enabled." });

  // Verify the exact raw text Photon signed, before reading anything in it.
  const raw = await request.text();
  const id = request.headers.get("webhook-id");
  const ok = await verifyWebhook(
    raw,
    {
      id,
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    },
    runtime.webhookSecret,
  );
  if (!ok || !id) return json(400, { error: "Bad signature." });

  // Photon retries on timeouts and 5xx, and webhook-id does not change on retries.
  if (runtime.seenWebhookIds.has(id)) return json(200, { duplicate: true });
  runtime.seenWebhookIds.add(id);
  if (runtime.seenWebhookIds.size > 1000) {
    runtime.seenWebhookIds.delete(runtime.seenWebhookIds.values().next().value as string);
  }

  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return json(400, { error: "Body is not JSON." });
  }

  try {
    const { skipped } = await runtime.channel.handleInbound(event);
    if (skipped) {
      // Log the event type only, never message content.
      const type = (event as { type?: unknown })?.type;
      console.info(
        `photon: skipped an event (${skipped}); type=${typeof type === "string" ? type : "unknown"}`,
      );
      return json(200, { ignored: skipped });
    }
    return json(200, { ok: true });
  } catch {
    runtime.seenWebhookIds.delete(id); // let Photon's retry run again
    return json(500, { error: "Could not process the event." });
  }
}
