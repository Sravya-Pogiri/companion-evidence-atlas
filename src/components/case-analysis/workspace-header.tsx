import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useCase } from "@/lib/case-store";
import { SAMPLE_CASE } from "@/lib/sample-case";
import { cn } from "@/lib/utils";

/** Slim breadcrumb bar at the top of the Case Analysis tab. */
export function WorkspaceHeader({
  awaiting,
  onMenu,
  actions,
}: {
  /** Findings not yet reviewed, when there are findings. */
  awaiting?: number;
  onMenu?: () => void;
  /** Extra controls on the right, after the case info (the demo controls). */
  actions?: ReactNode;
}) {
  const { mode } = useCase();
  return (
    <header className="flex h-[50px] shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4 sm:px-5 print:hidden">
      <div className="flex min-w-0 items-center gap-2">
        {onMenu && (
          <button
            type="button"
            onClick={onMenu}
            className="-ml-1 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Open sources"
          >
            <Menu className="size-4" />
          </button>
        )}
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[15px]">
          <Link to="/analysis" className="shrink-0 text-muted-foreground hover:text-foreground">
            Case analysis
          </Link>
          <span className="text-[#c3c8d2]">/</span>
          <span className="truncate font-medium text-foreground">{SAMPLE_CASE.name}</span>
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-[13px]">
        {awaiting !== undefined && (
          <span className="hidden items-center gap-1.5 text-muted-foreground md:flex">
            <span
              className={cn(
                "size-1.5 rounded-full",
                awaiting > 0 ? "bg-[#c89426]" : "bg-corroborate",
              )}
            />
            {awaiting > 0 ? `${awaiting} awaiting review` : "All findings reviewed"}
          </span>
        )}
        <span className="hidden rounded-md border border-border px-2 py-0.5 text-muted-foreground sm:inline">
          Public-record demo
        </span>
        <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[12px] text-muted-foreground">
          {mode === "photon" ? "iMessage · Photon" : "Simulated line"}
        </span>
        {actions}
      </div>
    </header>
  );
}
