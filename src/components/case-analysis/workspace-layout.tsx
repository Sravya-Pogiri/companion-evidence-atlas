import { useState } from "react";
import { cn } from "@/lib/utils";
import { WorkspaceProvider, useWorkspace } from "./context";
import { DemoControls } from "./demo-controls";
import { EvidenceDocumentViewer } from "./evidence-document-viewer";
import { IntelligencePanel } from "./intelligence-panel";
import { InvestigationPipeline } from "./investigation-pipeline";
import { SourceSidebar } from "./source-sidebar";
import { WorkspaceFooter } from "./workspace-footer";
import { WorkspaceHeader } from "./workspace-header";

/**
 * The Case Analysis tab: a light, editorial evidence workspace that sits inside the app's
 * dark shell. Its look is scoped to `.lx-analysis` (case-analysis.css, loaded by the
 * /analysis route only), so nothing here changes the rest of the app.
 */
export function CaseAnalysis() {
  return (
    <WorkspaceProvider>
      <CaseAnalysisLayout />
    </WorkspaceProvider>
  );
}

/**
 * Breadcrumb, investigation steps, three independently scrolling columns (sources,
 * document, intelligence) and a status bar. On small screens the sources become a drawer
 * and the document and panel share one column.
 */
function CaseAnalysisLayout() {
  const { queue, decisions, pane, setPane } = useWorkspace();
  const [drawer, setDrawer] = useState(false);
  const awaiting = queue.filter((i) => decisions[i.id] === undefined).length;

  return (
    <div className="lx-analysis flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-background text-foreground">
      <WorkspaceHeader
        {...(queue.length > 0 ? { awaiting } : {})}
        onMenu={() => setDrawer(true)}
        actions={<DemoControls />}
      />
      <InvestigationPipeline />

      <div
        className="flex shrink-0 border-b border-border bg-background p-1.5 lg:hidden"
        role="tablist"
        aria-label="Show"
      >
        {(["document", "panel"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={pane === p}
            onClick={() => setPane(p)}
            className={cn(
              "h-8 flex-1 rounded-md text-[14px] font-medium transition-colors",
              pane === p
                ? "border border-border bg-white text-foreground"
                : "text-muted-foreground",
            )}
          >
            {p === "document" ? "Document" : "Intelligence"}
          </button>
        ))}
      </div>

      <main className="grid min-h-0 flex-1 lg:grid-cols-[19fr_42fr_39fr]">
        <SourceSidebar open={drawer} onClose={() => setDrawer(false)} />
        <section
          aria-label="Evidence document"
          className={cn(
            "min-h-0 border-border lg:border-r",
            pane !== "document" && "max-lg:hidden",
          )}
        >
          <EvidenceDocumentViewer />
        </section>
        <section
          aria-label="Intelligence"
          className={cn("min-h-0 bg-background", pane !== "panel" && "max-lg:hidden")}
        >
          <IntelligencePanel />
        </section>
      </main>

      <WorkspaceFooter />
    </div>
  );
}
