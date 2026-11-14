import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { LogoMark } from "@/components/caselens/logo";

export const Route = createFileRoute("/_workspace")({ component: Workspace });

const nav = [
  { to: "/", label: "Live Case" },
  { to: "/review", label: "Review" },
  { to: "/handoff", label: "Handoff" },
] as const;

function Workspace() {
  return (
    <div className="workspace-noir dark flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-8 border-b bg-card/90 px-6 backdrop-blur">
        <Link to="/" className="flex items-center gap-2 text-ivory">
          <LogoMark className="h-8 w-8 shrink-0" />
          <span className="font-serif text-2xl font-semibold">CaseLens Text</span>
        </Link>
        <nav aria-label="Main" className="flex h-full items-stretch gap-2">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: true }}
              className="flex items-center border-b-2 border-transparent px-3 text-base font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:border-gold data-[status=active]:text-gold"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <div role="note" className="border-b border-missing/40 bg-missing/10 px-6 py-2 text-sm text-foreground">
        Potential findings. Review before use.
      </div>
      <main className="workspace-main min-w-0 flex-1 p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
