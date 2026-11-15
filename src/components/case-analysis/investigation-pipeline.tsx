import { Check } from "lucide-react";
import { useCase } from "@/lib/case-store";
import { ENTITIES, SOURCES } from "@/lib/sources";
import { cn } from "@/lib/utils";
import { useWorkspace, type View } from "./context";

interface Step {
  n: string;
  title: string;
  sub: string;
  view: View;
}

export const STEPS: Step[] = [
  { n: "01", title: "Ingest", sub: "Index sources", view: "ingest" },
  { n: "02", title: "Extract", sub: "People, places, dates", view: "entities" },
  { n: "03", title: "Timeline", sub: "Order events", view: "timeline" },
  { n: "04", title: "Flag", sub: "Surface conflicts", view: "findings" },
  { n: "05", title: "Draft", sub: "Prepare for review", view: "drafts" },
];

/** Five equal steps. Done comes from case state; the active step is what the panel shows. */
export function InvestigationPipeline() {
  const { view, setView, items, queue, decisions, setPane } = useWorkspace();
  const { busy } = useCase();

  const done: Record<View, boolean> = {
    ingest: SOURCES.some((s) => s.available),
    entities: ENTITIES.length > 0,
    timeline: items.length > 0,
    findings: items.some((i) => i.flag !== "agrees"),
    drafts: queue.length > 0 && queue.every((i) => decisions[i.id] !== undefined),
    messages: false,
  };

  return (
    <nav
      aria-label="Investigation steps"
      className="lx-scroll shrink-0 overflow-x-auto border-b border-border bg-background print:hidden"
    >
      <ol className="grid min-w-[860px] grid-cols-5">
        {STEPS.map((s, i) => {
          const active = view === s.view;
          const working = busy && (s.view === "ingest" || s.view === "entities");
          return (
            <li key={s.n} className={cn(i > 0 && "border-l border-border")}>
              <button
                type="button"
                onClick={() => {
                  setView(s.view);
                  setPane("panel");
                }}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "relative flex w-full items-start gap-3 overflow-hidden px-5 py-2.5 text-left transition-colors",
                  active ? "bg-white" : "hover:bg-white/70",
                )}
              >
                <span
                  className={cn(
                    "pt-px font-mono text-[12px]",
                    active
                      ? "text-primary"
                      : done[s.view]
                        ? "text-corroborate"
                        : "text-muted-foreground",
                  )}
                >
                  {s.n}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "flex items-center gap-1.5 text-[15px] font-medium",
                      active ? "text-primary" : "text-foreground",
                    )}
                  >
                    {s.title}
                    {done[s.view] && !active && (
                      <Check className="size-3.5 text-corroborate" aria-label="done" />
                    )}
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">{s.sub}</span>
                </span>
                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" aria-hidden />
                )}
                {working && (
                  <span
                    className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-accent"
                    aria-hidden
                  >
                    <span className="lx-progress block h-full w-2/5 bg-primary/70" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
