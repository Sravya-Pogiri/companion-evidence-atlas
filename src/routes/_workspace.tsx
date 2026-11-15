import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LogoMark } from "@/components/caselens/logo";
import { ACTIVE_CASE, CASE_OPTIONS, switchCase, type CaseId } from "@/lib/active-case";
import { APP_NAME } from "@/lib/config";
import { hydrateDecisions } from "@/lib/review-store";
import { useChannelSync } from "@/lib/use-channel-sync";

// Rendered in the browser only: which case is open is read there (see active-case.ts).
export const Route = createFileRoute("/_workspace")({ ssr: false, component: Workspace });

const nav = [
  { to: "/live", label: "Live Case" },
  { to: "/analysis", label: "Case Analysis" },
  { to: "/review", label: "Review" },
  { to: "/handoff", label: "Handoff" },
  { to: "/investigate", label: "Investigate" },
] as const;

function Workspace() {
  useEffect(() => {
    hydrateDecisions();
  }, []);
  useChannelSync();
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Live Case carries its own notice in the timeline card; Case Analysis is a full-height
  // tab with its own review notice and status bar.
  const onLive = path === "/live";
  const onAnalysis = path === "/analysis";
  const onInvestigate = path === "/investigate";

  return (
    <div className="workspace-noir dark flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-8 border-b bg-background/90 px-6 backdrop-blur print:hidden">
        <Link to="/" className="flex items-center gap-2 text-foreground">
          <LogoMark className="h-8 w-8 shrink-0" />
          <span className="font-serif text-xl font-semibold tracking-wide">{APP_NAME}</span>
        </Link>
        <nav aria-label="Main" className="flex h-full items-stretch gap-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: true, includeSearch: false }}
              className="flex items-center border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:border-gold data-[status=active]:text-gold"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <span className="max-md:sr-only">Case</span>
          <select
            value={ACTIVE_CASE}
            onChange={(e) => switchCase(e.target.value as CaseId)}
            className="h-8 max-w-[15rem] rounded-md border border-white/15 bg-background px-2 text-sm text-foreground outline-none hover:border-white/25 focus:border-gold/60"
          >
            {CASE_OPTIONS.map((c) => (
              <option key={c.id} value={c.id} title={c.kind}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      {!onLive && !onAnalysis && !onInvestigate && (
        <div
          role="note"
          className="border-b px-6 py-1.5 text-sm text-muted-foreground print:hidden"
        >
          Findings are suggestions. Confirm before use.
        </div>
      )}
      {onAnalysis ? (
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      ) : (
        <main className="workspace-main min-w-0 flex-1 p-6">
          <Outlet />
        </main>
      )}
    </div>
  );
}
