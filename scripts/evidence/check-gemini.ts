// Connection check for the model provider: list models, then one text and one image request.
//   npx tsx --env-file=.env scripts/evidence/check-gemini.ts
import { readFileSync } from "node:fs";
import { askJson, askJsonParts, currentGeminiModel, providerStats } from "../../src/lib/ai/provider.server";

async function main() {
  console.log("provider:", providerStats().provider ?? "none (set GEMINI_API_KEY)");
  console.log("first model to try:", await currentGeminiModel());

  let t = Date.now();
  const text = await askJson(
    'Answer with one JSON object: {"ok": true, "word": "<one word>"}.',
    "Give one word that means 'evidence'.",
  );
  console.log(`text  (${Date.now() - t} ms):`, JSON.stringify(text));

  t = Date.now();
  const frame = readFileSync("public/frames/dashcam-0045.jpg").toString("base64");
  const image = await askJsonParts(
    "Describe only what is visible. Answer with one JSON object.",
    [
      { type: "input_text", text: 'Return {"vehicles": <count of vehicles you can see>, "scene": "<short description>"}.' },
      { type: "input_image", image_url: `data:image/jpeg;base64,${frame}` },
    ],
  );
  console.log(`image (${Date.now() - t} ms):`, JSON.stringify(image));
  console.log("stats:", JSON.stringify(providerStats()));
}

main().catch((e) => {
  console.error("FAILED:", (e as Error).message);
  console.log("stats:", JSON.stringify(providerStats()));
  process.exit(1);
});
