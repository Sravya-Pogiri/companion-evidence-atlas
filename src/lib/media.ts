import { VIDEOS, type Lane, type TimelineItem } from "@/lib/sample-case";

// Real stills from the public sample. Frames were taken from the public YouTube videos with
// ffmpeg; pages were rendered from the public PDFs. Times below are times in each source video.

export type VideoId = keyof typeof VIDEOS;

export interface Frame {
  video: VideoId;
  /** Seconds into the source video. */
  at: number;
  src: string;
}

export const FRAMES: Frame[] = [
  { video: "dashcam", at: 40, src: "/frames/dashcam-0040.jpg" },
  { video: "dashcam", at: 45, src: "/frames/dashcam-0045.jpg" },
  { video: "dashcam", at: 53, src: "/frames/dashcam-0053.jpg" },
  { video: "dashcam", at: 58, src: "/frames/dashcam-0058.jpg" },
  { video: "bodycam", at: 80, src: "/frames/bodycam-0120.jpg" },
  { video: "bodycam", at: 82, src: "/frames/bodycam-0122.jpg" },
];

export interface PageImage {
  src: string;
  page: number;
  /** Where the quoted words sit on the page, as fractions of its width and height. */
  highlight?: { x: number; y: number; w: number; h: number };
  file: string;
}

export const PAGES = {
  complaint: {
    src: "/pages/complaint-p24.png",
    page: 24,
    file: "LA-Rosales-Traffic-Stop-Complaint.pdf",
    // Rendered down to 495pt so the photo lower on the page (people's faces) is left out.
    // "Failure to signal" in para. 208 sits at PDF points 295,300 to 389,318.
    highlight: { x: 295 / 612, y: 300 / 495, w: 94 / 612, h: 18 / 495 },
  },
  opinion: {
    src: "/pages/opinion-p11.png",
    page: 11,
    file: "USCOURTS-ca5-25-30650-0.pdf",
  },
} satisfies Record<string, PageImage>;

export const BLURRY_PHOTO = "/frames/blurry-photo.jpg";

export type ItemMedia =
  | { kind: "video"; video: VideoId; at: number; frame: string; file: string }
  | { kind: "page"; page: PageImage };

function video(v: VideoId, at: number): ItemMedia {
  return {
    kind: "video",
    video: v,
    at,
    frame: nearestFrame(v, at).src,
    file: `youtu.be/${VIDEOS[v].id}`,
  };
}

const BY_ITEM: Record<string, ItemMedia> = {
  "dashcam-approach": video("dashcam", 45),
  "bodycam-after-stop": video("bodycam", 80),
  "turn-left": video("dashcam", 58),
  "complaint-reason": { kind: "page", page: PAGES.complaint },
  "opinion-signal": { kind: "page", page: PAGES.opinion },
  "activation-missing": { kind: "page", page: PAGES.opinion },
};

export function nearestFrame(v: VideoId, at: number): Frame {
  const frames = FRAMES.filter((f) => f.video === v);
  return frames.reduce((best, f) => (Math.abs(f.at - at) < Math.abs(best.at - at) ? f : best));
}

/** The still or page that belongs to an item, when the sample has one. */
export function mediaFor(
  item: Pick<TimelineItem, "id" | "lane" | "start" | "sourceLink">,
): ItemMedia | null {
  const known = BY_ITEM[item.id];
  if (known) return known;
  // Items filed during the demo: footage lanes get the nearest real frame from that video.
  const lane = item.lane as Lane;
  if (lane === "dashcam" || lane === "bodycam") return video(lane, item.start);
  if (item.sourceLink?.includes(VIDEOS.dashcam.id)) return video("dashcam", item.start);
  if (item.sourceLink?.includes(VIDEOS.bodycam.id)) return video("bodycam", item.start);
  return null;
}

export function embedUrl(v: VideoId, at: number): string {
  return `https://www.youtube-nocookie.com/embed/${VIDEOS[v].id}?start=${Math.floor(at)}&autoplay=1&rel=0&modestbranding=1`;
}
