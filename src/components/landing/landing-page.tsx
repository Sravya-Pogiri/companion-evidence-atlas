// The landing page, rendered at "/" by src/routes/index.tsx.
import { Link } from "@tanstack/react-router";
import { ArrowRight, AudioLines, Check, FileText, Play } from "lucide-react";
import { EvidenceCollage } from "./evidence-collage";
import { APP_NAME } from "@/lib/config";
import { PAGES } from "@/lib/media";

export function LandingPage() {
  return (
    <div className="lx-landing min-h-screen overflow-x-clip font-sans">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-4 sm:px-8">
          <Link to="/" className="font-serif text-xl font-medium tracking-[0.22em] text-[#ecebe6]">
            {APP_NAME.toUpperCase()}
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-6">
            <a
              href="#how-it-works"
              className="hidden px-2 text-sm text-[#a9a8b3] transition-colors hover:text-[#ecebe6] sm:inline"
            >
              How it works
            </a>
            <a
              href="#privacy"
              className="hidden px-2 text-sm text-[#a9a8b3] transition-colors hover:text-[#ecebe6] sm:inline"
            >
              Privacy
            </a>
            <Link
              to="/live"
              className="rounded-md border border-white/20 px-3.5 py-1.5 text-sm font-medium text-[#ecebe6] transition-colors hover:border-white/40 hover:bg-white/5"
            >
              Open live case
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid min-h-[100svh] max-w-[1320px] items-center gap-12 px-4 pb-16 pt-24 sm:px-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-10 lg:pb-10">
        <div className="max-w-[40rem]">
          <h1 className="lx-rise font-serif text-[clamp(2.4rem,3.55vw,3.4rem)] font-normal leading-[1.06] tracking-[-0.01em] text-[#f1efe9]">
            Justice shouldn’t depend{"\u00a0"}on
            <br />
            <em className="font-normal italic text-[#c9a86a]">how much time you have.</em>
          </h1>
          <p
            className="lx-rise mt-6 max-w-[55ch] text-[1.0625rem] leading-relaxed text-[#a9a8b3]"
            style={{ ["--delay" as string]: "0.1s" }}
          >
            Text evidence to one number. {APP_NAME} puts every photo, page and voice note on a live
            timeline, links it to its source, and flags where the evidence agrees, conflicts, or is
            missing — so public defenders spend less time searching and more time defending.
          </p>
          <div
            className="lx-rise mt-8 flex flex-wrap gap-3"
            style={{ ["--delay" as string]: "0.2s" }}
          >
            <Link
              to="/live"
              className="inline-flex items-center gap-2 rounded-md bg-[#c9a86a] px-5 py-3 text-[15px] font-semibold text-[#15120c] transition-colors hover:bg-[#d6b77c]"
            >
              Explore {APP_NAME} <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/live"
              search={{ demo: 1 }}
              className="inline-flex items-center gap-2 rounded-md border border-white/20 px-5 py-3 text-[15px] font-medium text-[#ecebe6] transition-colors hover:border-white/40 hover:bg-white/5"
            >
              Watch the evidence connect <Play className="size-3.5 fill-current" />
            </Link>
          </div>
          <p
            className="lx-rise mt-5 text-sm text-[#7f7e8a]"
            style={{ ["--delay" as string]: "0.3s" }}
          >
            Suggests findings only. A person confirms everything.
          </p>
        </div>

        <EvidenceCollage />
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-8 border-t border-white/[0.06]">
        <div className="mx-auto max-w-[1320px] px-4 py-24 sm:px-8">
          <h2 className="font-serif text-[clamp(1.9rem,3vw,2.6rem)] font-normal text-[#f1efe9]">
            How it works
          </h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            <Step n={1} title="Text it in" body="A photo, a page, or a voice note, to one number.">
              <TextItIn />
            </Step>
            <Step
              n={2}
              title="It lands on the timeline"
              body="Linked to the exact page or timestamp."
            >
              <LandsOnTimeline />
            </Step>
            <Step
              n={3}
              title="You confirm what matters"
              body={`${APP_NAME} flags agreements, possible conflicts and gaps; a person decides.`}
            >
              <YouConfirm />
            </Step>
          </ol>
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="scroll-mt-8 border-t border-white/[0.06]">
        <div className="mx-auto max-w-[1320px] px-4 py-24 sm:px-8">
          <h2 className="font-serif text-[clamp(1.9rem,3vw,2.6rem)] font-normal text-[#f1efe9]">
            Privacy
          </h2>
          <p className="mt-6 max-w-[62ch] text-[1.0625rem] leading-relaxed text-[#a9a8b3]">
            Only verified case-team numbers can text a case. Every finding links to its source.
            Nothing is added to the record without a person confirming it. This demo uses public
            court records and footage.
          </p>
        </div>
      </section>

      <footer className="border-t border-white/[0.06]">
        <p className="mx-auto max-w-[1320px] px-4 py-8 text-sm text-[#6f6e79] sm:px-8">
          Built at HackPrinceton 2026
        </p>
      </footer>
    </div>
  );
}

function Step({
  n,
  title,
  body,
  children,
}: {
  n: number;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col">
      <div className="grid h-52 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.02] p-6">
        {children}
      </div>
      <p className="mt-6 font-mono text-[13px] text-[#7f7e8a]">0{n}</p>
      <h3 className="mt-1 font-serif text-2xl font-normal text-[#f1efe9]">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-[#a9a8b3]">{body}</p>
    </li>
  );
}

function TextItIn() {
  return (
    <div className="w-full max-w-[15rem] space-y-2" aria-hidden>
      <div className="lx-card ml-auto w-[62%] overflow-hidden rounded-xl rounded-br-sm border border-white/10">
        <img src="/frames/dashcam-0053.jpg" alt="" className="aspect-video w-full object-cover" />
      </div>
      <div className="lx-card ml-auto flex w-[70%] items-center gap-2 rounded-xl rounded-br-sm border border-white/10 bg-[#1b1c24] px-2.5 py-1.5 text-[13px] text-[#cfcdc6]">
        <FileText className="size-3.5 shrink-0" /> Complaint, page 24
      </div>
      <div className="lx-card ml-auto flex w-[58%] items-center gap-2 rounded-xl rounded-br-sm border border-white/10 bg-[#1b1c24] px-2.5 py-1.5 text-[#cfcdc6]">
        <AudioLines className="size-3.5 shrink-0" />
        <span className="flex h-3 flex-1 items-center gap-[2px]">
          {[4, 8, 11, 6, 12, 9, 5, 10, 7, 4, 8].map((h, i) => (
            <span
              key={i}
              className="w-[2px] rounded-full bg-current opacity-70"
              style={{ height: h }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

function LandsOnTimeline() {
  const rows = [
    { label: "Dashcam", left: "48%", width: "34%", tag: "0:45", img: "/frames/dashcam-0045.jpg" },
    { label: "Documents", left: "48%", width: "40%", tag: "p.24" },
    { label: "Events", left: "30%", width: "22%", tag: "", missing: true },
  ];
  return (
    <div className="w-full max-w-[17rem] space-y-2.5" aria-hidden>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-[4.5rem] shrink-0 text-[12px] text-[#7f7e8a]">{r.label}</span>
          <span className="relative h-7 flex-1 border-t border-white/[0.06]">
            <span
              className={
                r.missing
                  ? "absolute top-1 flex h-6 items-center rounded border border-dashed border-[#f76b15]/80 bg-[#f76b15]/10"
                  : "lx-card absolute top-1 flex h-6 items-center gap-1 rounded border border-white/10 bg-[#22232b] pl-0.5 pr-1.5"
              }
              style={{ left: r.left, width: r.width }}
            >
              {r.img && <img src={r.img} alt="" className="h-5 w-8 rounded-[3px] object-cover" />}
              {r.tag && <span className="font-mono text-[11px] text-[#cfcdc6]">{r.tag}</span>}
            </span>
          </span>
        </div>
      ))}
      <div className="ml-[5rem] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

function YouConfirm() {
  return (
    <div
      className="lx-card w-full max-w-[15.5rem] rounded-lg border border-white/10 bg-[#17181f] p-3"
      aria-hidden
    >
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#ff8f92]">
        <span className="size-1.5 rounded-full bg-[#e5484d]" /> Possible conflict
      </p>
      <div className="mt-2 flex gap-2">
        <span className="h-10 w-14 shrink-0 overflow-hidden rounded-[3px] bg-[var(--paper)]">
          <img src={PAGES.complaint.src} alt="" className="w-full -translate-y-[30%]" />
        </span>
        <span className="h-10 w-16 shrink-0 overflow-hidden rounded-[3px]">
          <img src="/frames/dashcam-0045.jpg" alt="" className="size-full object-cover" />
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-snug text-[#a9a8b3]">
        Complaint p.24 says failure to signal; dashcam 0:45 appears to show it on.
      </p>
      <span className="mt-2.5 inline-flex items-center gap-1 rounded border border-white/15 px-2 py-0.5 text-[12px] text-[#ecebe6]">
        <Check className="size-3" /> Confirm
      </span>
    </div>
  );
}
