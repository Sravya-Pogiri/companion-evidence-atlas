import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The landing page is a static site in public/landing, served as-is. These checks catch the two
// ways it can quietly break: a missing file, or buttons that no longer lead into the app.
const dir = "public/landing";
const html = readFileSync(`${dir}/index.html`, "utf8");

describe("static landing page", () => {
  it("has every file the page loads", () => {
    for (const f of ["index.html", "style.css", "script.js", "casebook.js"]) {
      expect(existsSync(`${dir}/${f}`), f).toBe(true);
    }
    expect(html).toContain('href="style.css"');
    expect(html).toContain('src="script.js"');
    expect(html).toContain('src="casebook.js"');
  });

  it("has buttons into the app: nav, mobile menu and hero", () => {
    expect(html.match(/href="\/live"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(html).toContain("Open the app");
    expect(html).toContain("Try the live case");
  });

  it("loads no outside scripts, only its own", () => {
    const scripts = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
    expect(scripts.every((s) => !/^https?:/.test(s ?? ""))).toBe(true);
  });

  it("is what / sends visitors to", () => {
    const route = readFileSync("src/routes/index.tsx", "utf8");
    expect(route).toContain("/landing/index.html");
  });
});
