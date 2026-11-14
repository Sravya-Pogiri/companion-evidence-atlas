export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <circle cx="14" cy="14" r="10" stroke="var(--gold)" strokeWidth="1.8" />
      <path
        d="M14 7v13M9 10h10M9 10l-2.5 5h5zM19 10l-2.5 5h5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M21.5 21.5L28 28" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
