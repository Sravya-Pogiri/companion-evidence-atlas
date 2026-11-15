// Runs a TypeScript file from this app with Vite's module loader, so "@/..." imports and
// import.meta.glob work like they do in the app. Usage: node scripts/run-ts.mjs <file.ts>
import { createServer } from "vite";
import { resolve } from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/run-ts.mjs <file.ts>");
  process.exit(1);
}
const root = resolve(import.meta.dirname, "..");
const server = await createServer({
  root,
  configFile: false,
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, ws: false },
  resolve: { alias: { "@": resolve(root, "src") } },
  optimizeDeps: { noDiscovery: true, include: [] },
});
let code = 0;
try {
  await server.ssrLoadModule(resolve(file));
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  await server.close();
}
process.exit(code);
