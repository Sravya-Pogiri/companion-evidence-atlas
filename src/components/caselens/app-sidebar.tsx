import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Briefcase, Archive, GitCompare, Network, Clock, SearchX, Sparkles, ShieldCheck } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { sidebarEvidenceCounts } from "@/lib/overview-data";
import { LogoMark } from "./logo";

const items = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Cases", url: "/cases", icon: Briefcase },
  { title: "Evidence Vault", url: "/evidence", icon: Archive },
  { title: "Contradiction Engine", url: "/rosales", icon: GitCompare },
  { title: "Evidence Knowledge Graph", url: "/graph", icon: Network },
  { title: "Incident Timeline", url: "/timeline", icon: Clock },
  { title: "Missing Evidence", url: "/missing", icon: SearchX },
  { title: "Defense Assistant", url: "/assistant", icon: Sparkles },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2 px-1 py-2 text-ivory">
          <LogoMark className="h-7 w-7 shrink-0" />
          {!collapsed && <span className="font-serif text-xl font-semibold">CaseLens</span>}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Investigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((i) => (
                <SidebarMenuItem key={i.url}>
                  <SidebarMenuButton asChild isActive={path === i.url} tooltip={i.title}>
                    <Link to={i.url}><i.icon /><span>{i.title}</span>{!collapsed && sidebarEvidenceCounts[i.url] !== undefined && <span className={`sidebar-evidence-count ${i.url === "/missing" ? "text-missing" : "text-contradiction"}`}>{sidebarEvidenceCounts[i.url]}</span>}</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={path === "/settings"} tooltip="Settings & Privacy">
              <Link to="/settings"><ShieldCheck /><span>Settings & Privacy</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && path !== "/contradictions" && path !== "/graph" && path !== "/assistant" && path !== "/cases" && <p className="px-2 pb-2 font-serif text-xs italic text-gold">Justice is a right, not a luxury.</p>}
      </SidebarFooter>
    </Sidebar>
  );
}
