import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { Bell, Search } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/caselens/app-sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cases } from "@/lib/case-data";
import { SimBadge } from "@/components/caselens/shared";

export const Route = createFileRoute("/_workspace")({ component: Workspace });

function Workspace() {
  const path = useRouterState({ select: r => r.location.pathname });
  const evidenceReview = path === "/contradictions" || path === "/graph" || path === "/assistant" || path === "/cases";
  return (
    <SidebarProvider className={`workspace-noir dark ${evidenceReview ? "evidence-review-shell" : ""}`}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur">
            <SidebarTrigger />
            <Select defaultValue={cases[0]?.id ?? ""}>
              <SelectTrigger className="h-9 w-44 shrink-0 lg:w-56" aria-label="Select case"><SelectValue /></SelectTrigger>
              <SelectContent>{cases.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="relative hidden max-w-xs flex-1 2xl:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search evidence, people, statements…" className="h-9 pl-8" />
            </div>
            <div className="evidence-legend" aria-label="Evidence color legend">
              <span className="evidence-contradiction"><i />Contradiction</span><span className="evidence-corroborate"><i />Supporting</span><span className="evidence-missing"><i />Missing</span><span className="evidence-related"><i />Related</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {!evidenceReview && <SimBadge className="hidden sm:inline-flex" />}
              <Button variant="ghost" size="icon" aria-label="Notifications" className="relative h-8 w-8">
                <Bell className="h-4 w-4" /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-contradiction" />
              </Button>
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8"><AvatarFallback className="bg-muted text-xs text-gold">JR</AvatarFallback></Avatar>
                <div className="hidden text-xs leading-tight lg:block"><div className="font-medium">J. Ramirez</div><div className="text-muted-foreground">Deputy Public Defender</div></div>
              </div>
            </div>
          </header>
          <main className="workspace-main min-w-0 flex-1 p-4 sm:p-6 lg:p-8"><Outlet /></main>
        </div>
      </div>
    </SidebarProvider>
  );
}
