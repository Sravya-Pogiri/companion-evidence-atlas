import { ExternalLink, FileText, Video } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VIDEOS, formatTime, type TimelineItem } from "@/lib/sample-case";

interface ConflictDialogProps {
  claim: TimelineItem | null;
  footage: TimelineItem | null;
  onClose: () => void;
}

/** Side by side: the document claim on the left, the footage at that timestamp on the right. */
export function ConflictDialog({ claim, footage, onClose }: ConflictDialogProps) {
  const t = footage ? Math.floor(footage.start) : 0;
  return (
    <Dialog open={claim !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Possible conflict at about {formatTime(t)}</DialogTitle>
          <DialogDescription className="text-base">
            Potential finding. Compare the claim with the footage and decide for yourself.
          </DialogDescription>
        </DialogHeader>
        {claim && footage && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-lg border bg-card p-5">
              <h3 className="flex items-center gap-2 font-serif text-xl">
                <FileText className="size-5" /> Claim in the document
              </h3>
              <p className="mt-1 font-mono text-sm text-muted-foreground">{claim.sourceLabel}</p>
              <blockquote className="mt-4 border-l-2 border-contradiction pl-4 text-lg leading-relaxed">
                {claim.extractedText}
              </blockquote>
              {claim.sourceLink && (
                <a
                  href={claim.sourceLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1 text-sm text-gold hover:underline"
                >
                  Open source <ExternalLink className="size-4" />
                </a>
              )}
            </section>
            <section className="rounded-lg border bg-card p-5">
              <h3 className="flex items-center gap-2 font-serif text-xl">
                <Video className="size-5" /> {VIDEOS.bodycam.label} at about {formatTime(t)}
              </h3>
              <div className="mt-4 aspect-video overflow-hidden rounded-md border">
                <iframe
                  key={`${VIDEOS.bodycam.id}-${t}`}
                  className="size-full"
                  src={`https://www.youtube-nocookie.com/embed/${VIDEOS.bodycam.id}?start=${t}&autoplay=1&mute=1&rel=0`}
                  title={`${VIDEOS.bodycam.label} starting at ${formatTime(t)}`}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{footage.extractedText}</p>
              {footage.sourceLink && (
                <a
                  href={footage.sourceLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm text-gold hover:underline"
                >
                  Open on YouTube <ExternalLink className="size-4" />
                </a>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
