import { cn } from "@/lib/utils";

/** The Lexora L mark on its cream tile, as on the landing page (public/lexora-mark.png). */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-[25%] border border-white/15 bg-[#fef9f5]",
        className,
      )}
    >
      <img src="/lexora-mark.png" alt="" className="size-full object-contain" />
    </span>
  );
}
