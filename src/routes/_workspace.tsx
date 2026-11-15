import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { CaseSwitcher } from "@/components/cases/case-switcher";
import { LogoMark } from "@/components/caselens/logo";
import { APP_NAME } from "@/lib/config";
import { hydrateDecisions } from "@/lib/review-store";
import { requestedCase, useCaseFromUrl } from "@/lib/use-case-from-url";
import { useChannelSync } from "@/lib/use-channel-sync";

export const Route = createFileRoute("/_workspace")({ component: Workspace });

const nav = [
  { to: "/live", label: "Live Case" },
  { to: "/analysis", label: "Case Analysis" },
  { to: "/review", label: "Review" },
  { to: "/handoff", label: "Handoff" },
] as const;

function LoadingCase() {
  return (
    <p role="status" className="p-6 text-sm text-muted-foreground">
      Opening the case…
    </p>
  );
}

function Workspace() {
  useEffect(() => {
    hydrateDecisions();
  }, []);
  useChannelSync();
  const caseReady = useCaseFromUrl();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  // A page opened for another case waits for that case, instead of flashing Rosales first.
  const waiting = requestedCase(searchStr) !== null && !caseReady;
  // Live Case carries its own notice in the timeline card; Case Analysis is a full-height
  // tab with its own review notice and status bar.
  const onLive = path === "/live";
  const onAnalysis = path === "/analysis";

  return (
    <div className="workspace-noir dark flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-8 border-b bg-background/90 px-6 backdrop-blur print:hidden">
        {/* A plain link: the landing page is a static site, so this must be a full page load. */}
        <a href="/landing/index.html" className="flex items-center gap-2 text-foreground">
          <LogoMark className="h-6 w-6 shrink-0" />
          <span className="font-serif text-xl font-semibold tracking-wide">{APP_NAME}</span>
        </a>
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
        <CaseSwitcher />
      </header>
      {!onLive && !onAnalysis && (
        <div
          role="note"
          className="border-b px-6 py-1.5 text-sm text-muted-foreground print:hidden"
        >
          Findings are suggestions. Confirm before use.
        </div>
      )}
      {onAnalysis ? (
        <main className="min-w-0 flex-1">{waiting ? <LoadingCase /> : <Outlet />}</main>
      ) : (
        <main className="workspace-main min-w-0 flex-1 p-6">
          {waiting ? <LoadingCase /> : <Outlet />}
        </main>
      )}
    </div>
  );
}
