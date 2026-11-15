import { useEffect, useState } from "react";
import { selectCase, useCase } from "@/lib/case-store";
import { DEFAULT_CASE_ID, isCaseId } from "@/lib/cases";

const KEY = "caselens-case-v1";

/** The case named in a URL's ?case= parameter, if it names a case other than the default. */
export function requestedCase(searchStr: string): string | null {
  const id = new URLSearchParams(searchStr).get("case");
  return isCaseId(id) && id !== DEFAULT_CASE_ID ? id : null;
}

/**
 * Picks the case to show. The landing page opens the app with ?case=<id>. After that the choice
 * is kept in the address bar and in session storage, so a reload keeps the case.
 * Returns true once the right case is on screen, so the page can wait for it.
 */
export function useCaseFromUrl(): boolean {
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("case");
    // A link that names a case wins over the one remembered for this tab, the default included.
    let id = isCaseId(asked) ? asked : null;
    if (!id) {
      try {
        const saved = window.sessionStorage.getItem(KEY);
        if (isCaseId(saved)) id = saved;
      } catch {
        // Storage can be blocked; the case still works for this visit.
      }
    }
    if (id) selectCase(id);
    setResolved(true);
  }, []);

  const { caseId } = useCase();
  useEffect(() => {
    if (!resolved) return;
    try {
      window.sessionStorage.setItem(KEY, caseId);
    } catch {
      // Ignore.
    }
    // Keep the address bar in step, without adding a history entry.
    const url = new URL(window.location.href);
    const current = url.searchParams.get("case");
    const want = caseId === DEFAULT_CASE_ID ? null : caseId;
    if (current === want) return;
    if (want) url.searchParams.set("case", want);
    else url.searchParams.delete("case");
    window.history.replaceState(window.history.state, "", url);
  }, [caseId, resolved]);

  return resolved;
}
