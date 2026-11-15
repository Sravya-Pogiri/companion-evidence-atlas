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

  it("has buttons into the app in the hero", () => {
    // "Explore Real Cases" opens Investigate; "Try the live case" replays the Live Case demo.
    expect(html.match(/href="\/investigate"/g)?.length).toBeGreaterThanOrEqual(1);
    expect(html).toContain('href="/live?demo=1"');
    expect(html).toContain("Try the live case");
  });

  it("opens each case in the app: on its card and in its popup", () => {
    const script = readFileSync(`${dir}/script.js`, "utf8");
    // Case 1 and case 2 open the Live Case page on Rosales v. Terrell and State v. Rader.
    expect(script).toContain('rosales: "/live?case=rosales"');
    expect(script).toContain('btk: "/live?case=btk"');
    expect(script).toContain('href="${appLink(c)}"');
    expect(script).toContain("modalOpenApp\").href = appLink(c)");
    expect(html).toContain('id="modalOpenApp"');
    expect(script).toContain("modalOpenApp");
  });

  it("only links to cases the app knows", () => {
    const script = readFileSync(`${dir}/script.js`, "utf8");
    for (const id of ["benitez", "mcmillian", "hinton"]) {
      expect(script).toContain(`id: "${id}"`);
    }
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
