import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LANE_ICON, PageThumb, PlayableStill } from "@/components/caselens/evidence-media";
import { mediaFor } from "@/lib/media";
import { LANES, formatTime, type TimelineItem } from "@/lib/sample-case";
import { cn } from "@/lib/utils";

interface ConflictDialogProps {
  claim: TimelineItem | null;
  footage: TimelineItem | null;
  onClose: () => void;
  /** Extra classes for the dialog box, e.g. a scope class for a themed tab. */
  className?: string;
}

/** Compare sources: the record page on the left, the footage at that moment on the right. */
export function ConflictDialog({ claim, footage, onClose, className }: ConflictDialogProps) {
  const open = claim !== null && footage !== null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "max-h-[92vh] max-w-5xl overflow-y-auto border-border bg-card text-foreground",
          className,
        )}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-medium">
            Compare sources at about {formatTime(claim?.start ?? 0)}
          </DialogTitle>
          <DialogDescription className="text-sm">
            A possible conflict, not a conclusion. Read both and decide for yourself.
          </DialogDescription>
        </DialogHeader>
        {claim && footage && (
          <div className="grid gap-5 md:grid-cols-2">
            <SourcePane item={claim} />
            <SourcePane item={footage} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SourcePane({ item }: { item: TimelineItem }) {
  const media = mediaFor(item);
  const lane = LANES.find((l) => l.id === item.lane);
  const Icon = LANE_ICON[item.lane];
  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-border bg-muted/40 p-4">
      <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="size-4" aria-hidden /> {lane?.label} · {item.sourceLabel}
      </h3>
      <div className="mt-3">
        {media?.kind === "video" ? (
          <PlayableStill video={media.video} at={media.at} />
        ) : media?.kind === "page" ? (
          <a
            href={item.sourceLink ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="block aspect-video overflow-hidden rounded-md ring-1 ring-border"
            aria-label={`Open ${item.sourceLabel}`}
          >
            <PageThumb page={media.page} highlight focusTop className="size-full" />
          </a>
        ) : (
          <div className="grid aspect-video place-items-center rounded-md border border-dashed border-missing/70 text-sm text-muted-foreground">
            No media in the sample record
          </div>
        )}
      </div>
      <p
        className={
          item.flag === "conflict"
            ? "mt-4 border-l-2 border-contradiction pl-3 text-base leading-relaxed"
            : "mt-4 text-base leading-relaxed"
        }
      >
        {item.extractedText}
      </p>
      {item.sourceLink && (
        <a
          href={item.sourceLink}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Open source <ExternalLink className="size-3.5" />
        </a>
      )}
    </section>
  );
}
