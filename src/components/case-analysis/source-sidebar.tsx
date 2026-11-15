import {
  AudioLines,
  BookOpen,
  Camera,
  Car,
  FileText,
  Flag,
  ListOrdered,
  MessageSquare,
  Paperclip,
  PenLine,
  ScrollText,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCase } from "@/lib/case-store";
import { ENTITIES, SOURCES, type Source } from "@/lib/sources";
import { cn } from "@/lib/utils";
import { useWorkspace, type View } from "./context";

const SOURCE_ICON: Record<string, LucideIcon> = {
  summary: BookOpen,
  complaint: FileText,
  opinion: ScrollText,
  dashcam: Car,
  bodycam: Camera,
  dispatch: AudioLines,
};

function iconFor(s: Source): LucideIcon {
  return SOURCE_ICON[s.id] ?? FileText;
}

export function SourceSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sourceId, openSource, view, setView, items, queue, setPane } = useWorkspace();
  const { messages } = useCase();
  const attachments = items.filter((i) => i.id.startsWith("item-"));

  const workspace: { view: View; label: string; icon: LucideIcon; count: number }[] = [
    { view: "entities", label: "Entities", icon: Users, count: ENTITIES.length },
    { view: "timeline", label: "Timeline", icon: ListOrdered, count: items.length },
    {
      view: "findings",
      label: "Findings",
      icon: Flag,
      count: items.filter((i) => i.flag !== "agrees").length,
    },
    { view: "drafts", label: "Drafts", icon: PenLine, count: queue.length },
    { view: "messages", label: "Messages", icon: MessageSquare, count: messages.length },
  ];

  const pick = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} aria-hidden />
      )}
      <aside
        aria-label="Sources and workspace"
        className={cn(
          "lx-scroll flex flex-col overflow-y-auto border-r border-border bg-sidebar",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-[17rem] max-lg:shadow-xl max-lg:transition-transform",
          open ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 pt-4 lg:hidden">
          <span className="text-sm font-medium text-muted-foreground">Navigate</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-7 place-items-center rounded-md hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <Group label="Sources">
          {SOURCES.map((s) => {
            const Icon = iconFor(s);
            return (
              <Row
                key={s.id}
                active={sourceId === s.id}
                onClick={pick(() => openSource(s.id))}
                icon={Icon}
                title={s.title}
                meta={s.meta}
                {...(s.available ? {} : { tag: "ref" })}
              />
            );
          })}
          {attachments.map((i) => (
            <Row
              key={i.id}
              active={sourceId === `msg:${i.id}`}
              onClick={pick(() => openSource(`msg:${i.id}`))}
              icon={Paperclip}
              title={i.sourceLabel}
              meta="Text message attachment"
            />
          ))}
        </Group>

        <Group label="Workspace">
          {workspace.map((w) => (
            <Row
              key={w.view}
              active={view === w.view}
              onClick={pick(() => {
                setView(w.view);
                setPane("panel");
              })}
              icon={w.icon}
              title={w.label}
              count={w.count}
            />
          ))}
        </Group>

        <div className="mt-auto p-3">
          <p className="flex items-start gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm leading-snug text-muted-foreground">
            <ShieldCheck className="mt-px size-4 shrink-0" aria-hidden />
            Attorney review required for all output.
          </p>
        </div>
      </aside>
    </>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-2.5 pt-4">
      <p className="px-2 pb-1.5 font-mono text-[13px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function Row({
  active,
  onClick,
  icon: Icon,
  title,
  meta,
  tag,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  title: string;
  meta?: string;
  tag?: string;
  count?: number;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex w-full items-start gap-2.5 rounded-lg border px-2 py-1.5 text-left transition-colors",
          active ? "border-border bg-card " : "border-transparent hover:bg-foreground/5",
        )}
      >
        <Icon
          className={cn(
            "mt-[3px] size-4 shrink-0",
            active ? "text-foreground" : "text-muted-foreground",
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-base text-foreground">{title}</span>
            {tag && (
              <span className="rounded border border-[var(--lx-amber-border)] bg-[var(--lx-amber-bg)] px-1 font-mono text-xs leading-4 text-[color:var(--lx-amber-text)]">
                {tag}
              </span>
            )}
          </span>
          {meta && <span className="block truncate text-[13px] text-muted-foreground">{meta}</span>}
        </span>
        {count !== undefined && (
          <span className="pt-px font-mono text-[13px] tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
      </button>
    </li>
  );
}
