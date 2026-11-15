import { useEffect, useRef } from "react";
import { AudioLines } from "lucide-react";
import { LogoMark } from "@/components/caselens/logo";
import { APP_NAME } from "@/lib/config";
import { PAGES } from "@/lib/media";

// The hero collage: real stills from the public sample laid out as an evidence board.
// Strings are drawn between real card positions and redrawn on resize and parallax.

const DEPTH: Record<string, number> = {
  complaint: 0.5,
  bodycam: 0.3,
  dashcam: 0.8,
  phone: 1,
  opinion: 0.6,
  audio: 0.7,
};
const MAX_SHIFT = 8;

const WAVE = [
  6, 10, 16, 9, 20, 13, 7, 15, 22, 11, 6, 14, 18, 8, 12, 7, 16, 10, 5, 12, 17, 9, 6, 11,
];

export function EvidenceCollage() {
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const agrees = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    const s = svg.current;
    if (!el || !s) return;
    const q = (sel: string) => el.querySelector<HTMLElement>(sel);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const layout = () => {
      if (getComputedStyle(s).display === "none") return;
      const base = el.getBoundingClientRect();
      const r = (node: Element | null) => {
        const b = node?.getBoundingClientRect();
        return b
          ? {
              l: b.left - base.left,
              t: b.top - base.top,
              r: b.right - base.left,
              b: b.bottom - base.top,
              w: b.width,
              h: b.height,
            }
          : null;
      };
      const hl = r(q("[data-anchor='highlight']"));
      const dash = r(q("[data-card='dashcam']"));
      const op = r(q("[data-card='opinion']"));
      const au = r(q("[data-card='audio']"));
      if (!hl || !dash || !op || !au) return;

      // Red: highlighted complaint line down through the gap under the page, up into the dashcam.
      const comp = r(q("[data-card='complaint']"));
      const rx0 = hl.r + 2,
        ry0 = hl.t + hl.h / 2;
      const rx1 = dash.l + 4,
        ry1 = dash.t + dash.h * 0.72;
      const dip = (comp ? comp.b : ry0) + 46;
      const c1 = { x: rx0 + 10, y: dip + 10 },
        c2 = { x: rx1 - 90, y: dip };
      const red = `M ${rx0} ${ry0} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${rx1} ${ry1}`;
      const redMid = {
        x: (rx0 + 3 * c1.x + 3 * c2.x + rx1) / 8,
        y: (ry0 + 3 * c1.y + 3 * c2.y + ry1) / 8,
      };
      // Green: dashcam to the opinion page.
      const gx0 = dash.l + dash.w * 0.3,
        gy0 = dash.b - 4;
      const gx1 = op.l + op.w * 0.55,
        gy1 = op.t + 6;
      const green = `M ${gx0} ${gy0} C ${gx0} ${gy0 + 40}, ${gx1} ${gy1 - 40}, ${gx1} ${gy1}`;
      // Orange: dashcam to the missing dispatch audio.
      const ox0 = dash.l + dash.w * 0.8,
        oy0 = dash.b - 4;
      const ox1 = au.l + au.w * 0.6,
        oy1 = au.t + 4;
      const orange = `M ${ox0} ${oy0} C ${ox0} ${oy0 + 36}, ${ox1} ${oy1 - 36}, ${ox1} ${oy1}`;

      s.querySelectorAll<SVGPathElement>("[data-path='red']").forEach((p) =>
        p.setAttribute("d", red),
      );
      s.querySelectorAll<SVGPathElement>("[data-path='green']").forEach((p) =>
        p.setAttribute("d", green),
      );
      s.querySelectorAll<SVGPathElement>("[data-path='orange']").forEach((p) =>
        p.setAttribute("d", orange),
      );
      if (pill.current) {
        pill.current.style.left = `${redMid.x}px`;
        pill.current.style.top = `${redMid.y}px`;
      }
      if (agrees.current) {
        agrees.current.style.left = `${(gx0 + gx1) / 2}px`;
        agrees.current.style.top = `${(gy0 + gy1) / 2}px`;
      }
    };

    // Follow the entrance animation, then settle.
    let frame = 0;
    const until = performance.now() + 1600;
    const follow = () => {
      layout();
      if (performance.now() < until) frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);

    const ro = new ResizeObserver(() => layout());
    ro.observe(el);

    // Gentle parallax, at most MAX_SHIFT pixels.
    let target = { x: 0, y: 0 };
    let cur = { x: 0, y: 0 };
    let moving = 0;
    const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-card]"));
    const tick = () => {
      cur = { x: cur.x + (target.x - cur.x) * 0.12, y: cur.y + (target.y - cur.y) * 0.12 };
      for (const c of cards) {
        const d = DEPTH[c.dataset["card"] ?? ""] ?? 0.5;
        c.style.translate = `${(cur.x * d * MAX_SHIFT).toFixed(2)}px ${(cur.y * d * MAX_SHIFT).toFixed(2)}px`;
      }
      layout();
      if (Math.abs(target.x - cur.x) > 0.002 || Math.abs(target.y - cur.y) > 0.002)
        moving = requestAnimationFrame(tick);
      else moving = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (window.innerWidth < 1024) return;
      target = {
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      };
      if (!moving) moving = requestAnimationFrame(tick);
    };
    if (!reduce) window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(moving);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  const complaint = PAGES.complaint;
  const hl = complaint.highlight;

  return (
    <div
      ref={root}
      className="lx-collage"
      aria-label="Sample evidence: a complaint page, dashcam and bodycam stills, a text thread, and a missing dispatch recording"
    >
      {/* Complaint page with the highlighted line */}
      <figure
        data-card="complaint"
        className="lx-card lx-rise overflow-hidden rounded-[3px] bg-[var(--paper)] text-[var(--ink)]"
        style={{ ["--delay" as string]: "0.05s" }}
      >
        <figcaption className="flex items-center justify-between border-b border-black/10 px-3 py-1.5 font-mono text-[12px] text-black/60">
          <span>COMPLAINT</span>
          <span>p.24 ¶208</span>
        </figcaption>
        <div className="relative aspect-[2/1] overflow-hidden">
          <div
            className="absolute inset-x-0 top-0"
            style={{ transform: `translateY(-${(hl.y - 0.25) * 100}%)` }}
          >
            <div className="relative">
              <img
                src={complaint.src}
                alt="Filed complaint, page 24, paragraph 208"
                className="block w-full"
              />
              <span
                data-anchor="highlight"
                aria-hidden
                className="absolute rounded-[2px] bg-[#f5d64a]/70 mix-blend-multiply"
                style={{
                  left: `${hl.x * 100 - 0.8}%`,
                  top: `${hl.y * 100 - 0.35}%`,
                  width: `${hl.w * 100 + 1.6}%`,
                  height: `${hl.h * 100 + 0.7}%`,
                }}
              />
            </div>
          </div>
        </div>
      </figure>

      {/* Bodycam, behind */}
      <figure
        data-card="bodycam"
        className="lx-card lx-rise overflow-hidden rounded-md bg-black"
        style={{ ["--delay" as string]: "0.15s" }}
      >
        <div className="relative aspect-video">
          <img
            src="/frames/bodycam-0122.jpg"
            alt="Bodycam still after the stop, about 1:22"
            className="size-full object-cover opacity-90"
          />
          <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 font-mono text-[12px] text-white/90">
            BODYCAM · 1:22
          </span>
        </div>
      </figure>

      {/* Dashcam, the conflict moment */}
      <figure
        data-card="dashcam"
        className="lx-card lx-rise overflow-hidden rounded-md bg-black"
        style={{ ["--delay" as string]: "0.25s" }}
      >
        <div className="relative aspect-video">
          <img
            src="/frames/dashcam-0045.jpg"
            alt="Dashcam still at about 0:45: the red Mustang approaches the intersection"
            className="size-full object-cover"
          />
          <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-px font-mono text-[13px] text-white">
            DASHCAM · 0:45
          </span>
          <div
            className="absolute inset-x-3 bottom-2.5 flex items-center gap-2 font-mono text-[11px] text-white/80"
            aria-hidden
          >
            <span>0:45</span>
            <span className="relative h-[3px] flex-1 rounded-full bg-white/25">
              <span className="absolute inset-y-0 left-0 w-[45%] rounded-full bg-white/80" />
              <span className="absolute left-[45%] top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
            </span>
          </div>
        </div>
      </figure>

      {/* Phone thread */}
      <div
        data-card="phone"
        className="lx-card lx-rise rounded-[1.75rem] border border-white/10 bg-[#121319] p-2"
        style={{ ["--delay" as string]: "0.4s" }}
      >
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-2 pb-2 pt-1">
          <span className="grid size-6 place-items-center rounded-full bg-white/10">
            <LogoMark className="size-3.5" />
          </span>
          <span className="text-[13px] font-medium">{APP_NAME}</span>
        </div>
        <div className="space-y-2 px-1.5 py-2.5">
          <div className="ml-auto w-[70%] overflow-hidden rounded-2xl rounded-br-md border border-white/10">
            <img
              src="/frames/dashcam-0045.jpg"
              alt=""
              className="aspect-video w-full object-cover"
            />
          </div>
          <p className="mr-auto w-[92%] rounded-2xl rounded-bl-md bg-[#262833] px-3 py-2 text-[13px] leading-snug text-[#e4e3de]">
            Possible conflict: the complaint says failure to signal, but the dashcam appears to show
            the signal on at about 0:45.
          </p>
        </div>
      </div>

      {/* Opinion page, agrees */}
      <figure
        data-card="opinion"
        className="lx-card lx-rise overflow-hidden rounded-[3px] bg-[var(--paper)]"
        style={{ ["--delay" as string]: "0.5s" }}
      >
        <figcaption className="border-b border-black/10 px-2.5 py-1 font-mono text-[11px] text-black/60">
          OPINION · p.11
        </figcaption>
        <div className="aspect-[4/3] overflow-hidden">
          <img
            src={PAGES.opinion.src}
            alt="Fifth Circuit opinion, page 11"
            className="w-full -translate-y-[38%]"
          />
        </div>
      </figure>

      {/* Missing dispatch audio */}
      <div
        data-card="audio"
        className="lx-card lx-rise rounded-lg border border-dashed border-[#f76b15]/80 bg-[#16130f] p-3"
        style={{ ["--delay" as string]: "0.6s" }}
      >
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#ecebe6]">
          <AudioLines className="size-3.5 shrink-0" aria-hidden /> Dispatch audio
        </p>
        <p className="mt-0.5 text-[12px] text-[#ff9a5c]">Not in the record</p>
        <div className="mt-2.5 flex h-6 items-center gap-[3px] opacity-40" aria-hidden>
          {WAVE.map((h, i) => (
            <span key={i} className="w-[3px] rounded-full bg-[#f76b15]" style={{ height: h }} />
          ))}
        </div>
      </div>

      {/* Strings */}
      <svg
        ref={svg}
        className="pointer-events-none absolute inset-0 z-[6] hidden size-full overflow-visible lg:block"
        aria-hidden
      >
        <defs>
          <mask id="lx-orange-reveal" maskUnits="userSpaceOnUse">
            <path
              data-path="orange"
              fill="none"
              stroke="#fff"
              strokeWidth="6"
              pathLength={1}
              className="lx-draw"
              style={{ ["--len" as string]: 1, ["--delay" as string]: "2.2s" }}
            />
          </mask>
        </defs>
        <path
          data-path="green"
          fill="none"
          stroke="#30a46c"
          strokeWidth="1.5"
          strokeLinecap="round"
          pathLength={1}
          className="lx-draw"
          style={{ ["--len" as string]: 1, ["--delay" as string]: "1.2s" }}
        />
        <path
          data-path="red"
          fill="none"
          stroke="#e5484d"
          strokeWidth="1.75"
          strokeLinecap="round"
          pathLength={1}
          className="lx-draw"
          style={{ ["--len" as string]: 1, ["--delay" as string]: "1.7s" }}
        />
        <path
          data-path="orange"
          fill="none"
          stroke="#f76b15"
          strokeWidth="1.5"
          strokeDasharray="5 5"
          mask="url(#lx-orange-reveal)"
        />
      </svg>
      <div
        ref={agrees}
        className="lx-pop absolute z-[7] hidden -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#30a46c]/60 bg-[#0f1f17] px-2 py-px text-[12px] font-medium text-[#5fd39a] lg:block"
        style={{ ["--delay" as string]: "1.9s" }}
      >
        Agrees
      </div>
      <div
        ref={pill}
        className="lx-pop absolute z-[7] hidden -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-[#e5484d]/60 bg-[#24121a] px-2.5 py-1 text-[12px] font-medium text-[#ff8f92] shadow-lg lg:block"
        style={{ ["--delay" as string]: "2.7s" }}
      >
        Possible conflict · <span className="font-mono">complaint p.24 ↔ dashcam 0:45</span>
      </div>
    </div>
  );
}
