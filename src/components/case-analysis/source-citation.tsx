import { citationLabel, findSource, type Citation } from "@/lib/sources";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";

/** A small blue chip that jumps to the cited paragraph, timestamp or page. */
export function SourceCitation({ c, className }: { c: Citation; className?: string }) {
  const { openCitation, flash } = useWorkspace();
  const source = findSource(c.source);
  const missing = source ? !source.available : false;
  const fromMessage = c.source.startsWith("msg:");
  const label = fromMessage ? "Message" : citationLabel(c);
  const active =
    flash !== null &&
    flash.source === c.source &&
    flash.anchor === ("para" in c ? c.para : "t" in c ? `t:${c.t}` : "");
  const title = fromMessage
    ? "Filed from a text message"
    : missing
      ? `${source?.title}: referenced, not in the record`
      : `${source?.title ?? c.source}, ${label}`;

  if (fromMessage) {
    return (
      <span
        title={title}
        className={cn(
          "inline-flex h-6 items-center rounded-md border border-border px-1.5 font-mono text-[13px] text-muted-foreground",
          className,
        )}
      >
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        openCitation(c);
      }}
      className={cn(
        "inline-flex h-6 items-center rounded-md border px-1.5 font-mono text-[13px] transition-colors",
        missing
          ? "border-[var(--lx-amber-border)] bg-[var(--lx-amber-bg)] text-[color:var(--lx-amber-text)] hover:bg-[var(--lx-amber-bg-hover)]"
          : "border-[var(--lx-link-border)] bg-card text-primary hover:border-primary hover:bg-accent",
        active && "border-primary bg-accent",
        className,
      )}
    >
      {label}
    </button>
  );
}

export function Citations({ cites, className }: { cites: Citation[]; className?: string }) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {cites.map((c, i) => (
        <SourceCitation key={`${c.source}-${i}`} c={c} />
      ))}
    </span>
  );
}
