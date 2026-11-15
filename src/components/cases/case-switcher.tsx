import { CASE_LIST, selectCase, useCase } from "@/lib/case-store";

/** Switch the case the whole app shows. */
export function CaseSwitcher() {
  const { caseId } = useCase();
  return (
    <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
      <span className="hidden sm:inline">Case</span>
      <select
        value={caseId}
        onChange={(e) => selectCase(e.target.value)}
        aria-label="Case"
        className="max-w-[16rem] rounded-md border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-gold"
      >
        {CASE_LIST.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
