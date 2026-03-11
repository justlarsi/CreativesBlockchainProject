import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  ShoppingBag,
  AlertTriangle,
  Users,
  FileText,
  Settings,
  Hexagon,
  LogOut,
  ChevronRight,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Works", url: "/works", icon: BookOpen },
  { title: "Marketplace", url: "/marketplace", icon: ShoppingBag },
  { title: "Infringement", url: "/infringement", icon: AlertTriangle },
  { title: "Collaboration", url: "/collaboration", icon: Users },
  { title: "Legal Tools", url: "/legal", icon: FileText },
];

const bottomNav = [
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="py-6 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 glow-border shrink-0">
            <Hexagon className="h-5 w-5 text-primary" />
          </div>
          {!collapsed && (
            <div>
              <span className="font-display font-bold text-lg text-foreground">Creative</span>
              <span className="font-display font-bold text-lg text-primary">Chain</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-3">
              Navigation
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground transition-all duration-200 group"
                      activeClassName="bg-primary/10 text-primary border-l-2 border-primary pl-[10px]"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="text-sm font-medium flex-1">{item.title}</span>
                          <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-4">
        <SidebarMenu className="space-y-1">
          {bottomNav.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground transition-all duration-200"
                  activeClassName="bg-primary/10 text-primary"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200">
                <LogOut className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="text-sm font-medium">Sign Out</span>}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {!collapsed && (
          <div className="mt-4 mx-1 rounded-xl p-3 bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">AK</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Amara Kamau</p>
                <p className="text-xs text-muted-foreground">Creator Pro</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full w-3/4 rounded-full bg-primary" />
              </div>
              <span className="text-xs text-muted-foreground">75%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Storage used</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
