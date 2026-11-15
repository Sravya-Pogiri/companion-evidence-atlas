import { Play, RotateCcw } from "lucide-react";
import { resetCase, useCase } from "@/lib/case-store";
import { resetDecisions } from "@/lib/review-store";
import { useWorkspace } from "./context";

/** Bottom bar: replay controls (simulated line only) and the review promise. */
export function WorkspaceFooter() {
  const { mode } = useCase();
  const { replay, replaying, resetDemo, focusItem, setView } = useWorkspace();
  return (
    <footer className="flex h-11 shrink-0 items-center justify-between gap-4 border-t border-border bg-background px-4 sm:px-5 print:hidden">
      <div className="flex items-center gap-2">
        {mode === "simulated" && (
          <>
            <button
              type="button"
              onClick={replay}
              disabled={replaying}
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-60"
            >
              <Play className="size-3 fill-current" /> {replaying ? "Replaying…" : "Replay"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetDemo();
                resetCase();
                resetDecisions();
                focusItem("complaint-reason");
                setView("findings");
              }}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
            >
              <RotateCcw className="size-3" /> Restart
            </button>
          </>
        )}
      </div>
      <p className="hidden truncate text-sm text-muted-foreground sm:block">
        Every finding links back to its source. Nothing leaves draft status without attorney review.
      </p>
    </footer>
  );
}
