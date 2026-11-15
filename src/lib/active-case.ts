// Which case the workspace shows. Lexora holds two public cases:
//   rosales  Rosales v. Terrell: traffic stop, public dashcam and bodycam with filings
//   btk      State of Kansas v. Rader (05 CR 498): public digital-forensics evidence packet
// The choice comes from ?case= or is remembered in this browser. Case data is built once when
// the page loads, so switching reloads the page. The workspace renders in the browser only
// (ssr: false on the _workspace route), so it can read the choice; the server and the Photon
// channel always use the Rosales case.

export type CaseId = "rosales" | "btk" | "benitez" | "mcmillian" | "hinton";

export const CASE_OPTIONS: { id: CaseId; name: string; kind: string }[] = [
  { id: "rosales", name: "Rosales v. Terrell", kind: "Traffic stop · dashcam and filings" },
  { id: "btk", name: "State v. Rader (BTK)", kind: "Digital forensics · public record" },
  // Public-record cases from the landing page's case library (src/lib/case-library.ts).
  { id: "benitez", name: "Benitez (public record)", kind: "Dated timeline · summarized from public sources" },
  { id: "mcmillian", name: "McMillian (public record)", kind: "Dated timeline · summarized from public sources" },
  { id: "hinton", name: "Hinton (public record)", kind: "Dated timeline · summarized from public sources" },
];

/** Cases from the landing page's case library: shown with the dated-case views (src/lib/cases.ts). */
export const LIBRARY_CASES: readonly CaseId[] = ["benitez", "mcmillian", "hinton"];

const KEY = "lexora.case";
const isCase = (v: unknown): v is CaseId => CASE_OPTIONS.some((c) => c.id === v);

function read(): CaseId {
  if (typeof window === "undefined") return "rosales";
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("case");
    if (isCase(fromUrl)) {
      window.localStorage.setItem(KEY, fromUrl);
      return fromUrl;
    }
    const saved = window.localStorage.getItem(KEY);
    if (isCase(saved)) return saved;
  } catch {
    // Storage can be blocked; fall back to the default case.
  }
  return "rosales";
}

export const ACTIVE_CASE: CaseId = read();

/** Open the workspace on another case. Reloads, because case data is built at load. */
export function switchCase(id: CaseId): void {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // Without storage the ?case= parameter carries the choice for this page.
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("demo");
  url.searchParams.set("case", id);
  window.location.assign(`${url.pathname}${url.search}`);
}
