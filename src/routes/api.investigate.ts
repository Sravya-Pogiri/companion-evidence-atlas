import { createFileRoute } from "@tanstack/react-router";

// "Test this claim": forwards the request to the Deep Agents investigator service
// (services/investigator, POST /investigate-claim) and streams its NDJSON events back. The
// service token stays on the server. Not a page.
const CASES = new Set(["btk"]);

export const Route = createFileRoute("/api/investigate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { caseId?: unknown; claim?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Send JSON: {caseId, claim}." }, { status: 400 });
        }
        const claim = typeof body.claim === "string" ? body.claim.trim() : "";
        if (typeof body.caseId !== "string" || !CASES.has(body.caseId))
          return Response.json({ error: "Claim investigations run on the State v. Rader case." }, { status: 400 });
        if (claim.length < 8 || claim.length > 400)
          return Response.json({ error: "Write the claim as a full sentence (8 to 400 characters)." }, { status: 400 });

        const base = process.env["INVESTIGATOR_URL"] ?? "http://localhost:8787";
        const token = process.env["INVESTIGATOR_TOKEN"];
        if (!token)
          return Response.json({ error: "Setup required: set INVESTIGATOR_TOKEN for the app and the investigator service." }, { status: 503 });
        let upstream: Response;
        try {
          upstream = await fetch(`${base}/investigate-claim`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ caseId: body.caseId, claim }),
            signal: request.signal,
          });
        } catch {
          return Response.json(
            { error: "The investigator service is not running. Start it: cd services/investigator && npm run start:local" },
            { status: 503 },
          );
        }
        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          let message = `The investigator service returned ${upstream.status}.`;
          try {
            message = (JSON.parse(detail) as { error?: string }).error ?? message;
          } catch {
            // keep the generic message
          }
          return Response.json({ error: message }, { status: upstream.status === 401 ? 502 : upstream.status });
        }
        return new Response(upstream.body, {
          headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
