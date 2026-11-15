import { useState } from "react";
import {
  AudioLines,
  CalendarDays,
  Camera,
  Car,
  CircleDashed,
  FileText,
  Flag,
  Landmark,
  Play,
  Search,
  type LucideIcon,
} from "lucide-react";
import { LOCAL_VIDEO, embedUrl, nearestFrame, type PageImage, type VideoId } from "@/lib/media";
import { VIDEOS, formatClock, type Lane } from "@/lib/sample-case";
import { cn } from "@/lib/utils";

export const LANE_ICON: Record<Lane, LucideIcon> = {
  bodycam: Camera,
  dashcam: Car,
  dispatch: AudioLines,
  documents: FileText,
  events: Flag,
  incidents: CalendarDays,
  investigation: Search,
  court: Landmark,
  gaps: CircleDashed,
};

/** A real frame with an optional duration badge. */
export function FrameThumb({
  src,
  duration,
  className,
  alt = "",
}: {
  src: string;
  duration?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <span className={cn("relative block overflow-hidden bg-black", className)}>
      <img src={src} alt={alt} loading="lazy" className="size-full object-cover" />
      {duration !== undefined && (
        <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-px font-mono text-[13px] leading-5 text-white">
          {formatClock(duration)}
        </span>
      )}
    </span>
  );
}

/**
 * A video that is not on YouTube, played from its local copy. When the file is not there (it is
 * kept out of git), it shows a link to where the video is published instead.
 */
export function LocalClip({
  src,
  href,
  label,
  className,
}: {
  src: string;
  href: string | null;
  label: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <a
        href={href ?? undefined}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "grid aspect-video place-items-center rounded-md border border-current/15 text-sm opacity-80 hover:opacity-100",
          className,
        )}
      >
        <span className="flex items-center gap-2">
          <Play className="size-4" aria-hidden /> Open {label} at the archive
        </span>
      </a>
    );
  return (
    <video
      className={cn("aspect-video w-full rounded-md bg-black", className)}
      src={src}
      controls
      preload="metadata"
      playsInline
      onError={() => setFailed(true)}
      aria-label={label}
    />
  );
}

/** A rendered court-record page, optionally with the quoted words highlighted. */
export function PageThumb({
  page,
  highlight = false,
  className,
  focusTop = false,
}: {
  page: PageImage;
  highlight?: boolean;
  className?: string;
  /** Crop to the band around the highlight instead of showing the whole page. */
  focusTop?: boolean;
}) {
  const h = page.highlight;
  return (
    <span className={cn("relative block overflow-hidden bg-[var(--paper)]", className)}>
      <span
        className="absolute inset-x-0 block"
        style={{
          top: 0,
          transform: focusTop && h ? `translateY(-${Math.max(0, h.y - 0.28) * 100}%)` : undefined,
        }}
      >
        <span className="relative block">
          <img src={page.src} alt={`Page ${page.page}`} loading="lazy" className="block w-full" />
          {highlight && h && (
            <span
              aria-hidden
              className="absolute rounded-[2px] bg-[#f5d64a]/55 mix-blend-multiply"
              style={{
                left: `${h.x * 100 - 0.6}%`,
                top: `${h.y * 100 - 0.3}%`,
                width: `${h.w * 100 + 1.2}%`,
                height: `${h.h * 100 + 0.6}%`,
              }}
            />
          )}
        </span>
      </span>
    </span>
  );
}

/** A still that becomes the public video, starting at `at`, when played. */
export function PlayableStill({
  video,
  at,
  className,
  badge,
}: {
  video: VideoId;
  at: number;
  className?: string;
  badge?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [localFailed, setLocalFailed] = useState(false);
  const frame = nearestFrame(video, at);
  const local = LOCAL_VIDEO[video];
  return (
    <div className={cn("relative aspect-video overflow-hidden rounded-md bg-black", className)}>
      {playing && local && !localFailed ? (
        // The local copy when it is there; YouTube when it is not.
        <video
          className="size-full"
          src={`${local}#t=${Math.floor(at)}`}
          autoPlay
          controls
          playsInline
          onError={() => setLocalFailed(true)}
          aria-label={`${VIDEOS[video].label} from ${formatClock(at)}`}
        />
      ) : playing ? (
        <iframe
          className="size-full"
          src={embedUrl(video, at)}
          title={`${VIDEOS[video].label} from ${formatClock(at)}`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group relative block size-full"
          aria-label={`Play ${VIDEOS[video].label} from ${formatClock(at)}`}
        >
          <img src={frame.src} alt="" className="size-full object-cover" />
          <span className="absolute inset-0 grid place-items-center bg-black/10 transition-colors group-hover:bg-black/25">
            <span className="grid size-11 place-items-center rounded-full bg-black/60 text-white ring-1 ring-white/30">
              <Play className="ml-0.5 size-5 fill-current" />
            </span>
          </span>
          <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-px font-mono text-[13px] leading-5 text-white">
            {badge ?? `${VIDEOS[video].label.toUpperCase()} · ${formatClock(at)}`}
          </span>
        </button>
      )}
    </div>
  );
}
