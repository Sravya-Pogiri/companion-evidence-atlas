import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useCase, useFiledItems } from "@/lib/case-store";
import { startDemo, type DemoController } from "@/lib/demo";
import { useDecisions, type Decisions } from "@/lib/review-store";
import { BTK, reviewQueue, type TimelineItem } from "@/lib/sample-case";
import { ITEM_CITATIONS, findSource, type Citation } from "@/lib/sources";

// UI state shared by the workspace columns. Case data itself stays in the case store and
// review store; this only tracks what the person is looking at.

export type View = "ingest" | "entities" | "timeline" | "findings" | "drafts" | "messages";

export interface Flash {
  source: string;
  /** Paragraph id, "t:<seconds>", or "" for the source as a whole. */
  anchor: string;
  nonce: number;
}

interface WorkspaceState {
  view: View;
  setView: (v: View) => void;
  sourceId: string;
  openSource: (id: string) => void;
  focusId: string | null;
  focusItem: (id: string | null, opts?: { view?: View }) => void;
  flash: Flash | null;
  openCitation: (c: Citation) => void;
  videoTime: Record<string, number>;
  setVideoTime: (video: string, t: number) => void;
  items: TimelineItem[];
  queue: TimelineItem[];
  decisions: Decisions;
  /** The scripted demo: idle, playing or paused. */
  demo: "idle" | "playing" | "paused";
  /** True while the demo is playing or paused; the composer waits. */
  replaying: boolean;
  /** Starts the demo from the beginning. */
  replay: () => void;
  /** Starts the demo, or resumes it when paused. */
  playDemo: () => void;
  pauseDemo: () => void;
  /** Stops the demo and puts the full sample case back. */
  resetDemo: () => void;
  /** Mobile: which column shows. */
  pane: "document" | "panel";
  setPane: (p: "document" | "panel") => void;
}

const Ctx = createContext<WorkspaceState | null>(null);

export function citationsFor(item: TimelineItem): Citation[] {
  const known = ITEM_CITATIONS[item.id];
  if (known) return known;
  // Filed from a message: cite the message attachment it came from.
  return [{ source: `msg:${item.id}` }];
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>("findings");
  const [sourceId, setSourceId] = useState(BTK ? "STATE" : "complaint");
  const [focusId, setFocusId] = useState<string | null>("complaint-reason");
  const [flash, setFlash] = useState<Flash | null>(null);
  const [videoTime, setVideoTimes] = useState<Record<string, number>>({ dashcam: 45, bodycam: 80 });
  const [demo, setDemo] = useState<"idle" | "playing" | "paused">("idle");
  const [pane, setPane] = useState<"document" | "panel">("document");
  const controller = useRef<DemoController | null>(null);
  const nonce = useRef(0);

  const items = useFiledItems();
  const { mode } = useCase();
  const decisions = useDecisions();
  const queue = useMemo(() => reviewQueue(items), [items]);

  // Leaving mid-demo puts the full sample back (stop() does that).
  useEffect(() => () => controller.current?.stop(), []);

  const setVideoTime = useCallback((video: string, t: number) => {
    setVideoTimes((prev) => ({ ...prev, [video]: t }));
  }, []);

  const openSource = useCallback((id: string) => {
    setSourceId(id);
    setPane("document");
  }, []);

  const openCitation = useCallback(
    (c: Citation) => {
      const source = findSource(c.source);
      setSourceId(c.source);
      setPane("document");
      if ("t" in c && source?.video) setVideoTime(source.video, c.t);
      nonce.current += 1;
      setFlash({
        source: c.source,
        anchor: "para" in c ? c.para : "t" in c ? `t:${c.t}` : "",
        nonce: nonce.current,
      });
    },
    [setVideoTime],
  );

  const focusItem = useCallback((id: string | null, opts?: { view?: View }) => {
    setFocusId(id);
    if (opts?.view) {
      setView(opts.view);
      setPane("panel");
    }
  }, []);

  const replay = useCallback(() => {
    if (mode === "photon") return;
    controller.current?.stop();
    setDemo("playing");
    setView("messages");
    setPane("panel");
    setFocusId(null);
    controller.current = startDemo(() => {
      setDemo("idle");
      controller.current = null;
      setFocusId("complaint-reason");
    });
  }, [mode]);

  const playDemo = useCallback(() => {
    if (demo === "paused" && controller.current) {
      controller.current.resume();
      setDemo("playing");
    } else if (demo === "idle") {
      replay();
    }
  }, [demo, replay]);

  const pauseDemo = useCallback(() => {
    if (demo !== "playing") return;
    controller.current?.pause();
    setDemo("paused");
  }, [demo]);

  const resetDemo = useCallback(() => {
    controller.current?.stop();
    controller.current = null;
    setDemo("idle");
    setFocusId("complaint-reason");
  }, []);

  // D plays or pauses the demo, unless the person is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "d" && e.key !== "D") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      if (demo === "playing") pauseDemo();
      else playDemo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [demo, playDemo, pauseDemo]);

  const value: WorkspaceState = {
    view,
    setView,
    sourceId,
    openSource,
    focusId,
    focusItem,
    flash,
    openCitation,
    videoTime,
    setVideoTime,
    items,
    queue,
    decisions,
    demo,
    replaying: demo !== "idle",
    replay,
    playDemo,
    pauseDemo,
    resetDemo,
    pane,
    setPane,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace needs a WorkspaceProvider");
  return v;
}
