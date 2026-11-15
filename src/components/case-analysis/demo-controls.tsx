import { Pause, Play, RotateCcw } from "lucide-react";
import { useCase } from "@/lib/case-store";
import { useWorkspace } from "./context";

/** Top-bar demo controls: Play demo, Pause or Resume, and Reset while a demo is running. */
export function DemoControls() {
  const { mode } = useCase();
  const { demo, playDemo, pauseDemo, resetDemo } = useWorkspace();
  if (mode === "photon") return null;
  const playing = demo === "playing";
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={playing ? pauseDemo : playDemo}
        aria-keyshortcuts="D"
        title={`${playing ? "Pause" : demo === "paused" ? "Resume" : "Play"} the scripted demo (D)`}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        {playing ? (
          <Pause className="size-3 fill-current" />
        ) : (
          <Play className="size-3 fill-current" />
        )}
        {playing ? "Pause" : demo === "paused" ? "Resume" : "Play demo"}
      </button>
      {demo !== "idle" && (
        <button
          type="button"
          onClick={resetDemo}
          aria-label="Reset demo"
          title="Reset demo"
          className="lx-fade grid size-7 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
        </button>
      )}
    </div>
  );
}
