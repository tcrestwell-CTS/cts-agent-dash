import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Calendar,
  GraduationCap,
  DollarSign,
  Mail,
  Settings,
  LogOut,
  UserPlus,
  BarChart3,
  Building2,
  FileSpreadsheet,
  Compass,
  Menu,
  X,
  HeartPulse,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCanViewTeam, useUserRole } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import crestwellLogo from "@/assets/crestwell-logo.png";
import { useState, useEffect, createContext, useContext } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

// Context so DashboardLayout can read collapsed state
export const SidebarCollapsedContext = createContext<boolean>(false);
export const useSidebarCollapsed = () => useContext(SidebarCollapsedContext);

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Trips", href: "/trips", icon: Compass },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Bookings", href: "/bookings", icon: Calendar },
  { name: "Suppliers", href: "/suppliers", icon: Building2 },
  { name: "Commissions", href: "/commissions", icon: DollarSign },
  { name: "Commission Report", href: "/commission-report", icon: FileSpreadsheet },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Training", href: "/training", icon: GraduationCap },
  { name: "Email & Branding", href: "/branding", icon: Mail },
  { name: "Settings", href: "/settings", icon: Settings },
];

const adminNavigation = [
  { name: "Team Management", href: "/team", icon: UserPlus },
  { name: "QBO Health", href: "/qbo-health", icon: HeartPulse },
];

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (val: boolean) => void;
}

export function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { canView: canViewTeam } = useCanViewTeam();
  const { data: userRole } = useUserRole();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [location.pathname, isMobile]);

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || "U";

  const userName = user?.user_metadata?.full_name || user?.email || "User";

  const getRoleLabel = (role: string | null | undefined) => {
    switch (role) {
      case "admin": return "Admin";
      case "office_admin": return "Office Admin";
      case "user":
      default: return "Travel Agent";
    }
  };

  const NavItem = ({ item }: { item: typeof navigation[0] }) => {
    const isActive = location.pathname === item.href;
    const link = (
      <Link
        to={item.href}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
          collapsed && !isMobile ? "justify-center px-2" : "",
          isActive
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )}
      >
        <item.icon
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            isActive
              ? "text-sidebar-primary"
              : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70"
          )}
        />
        {(!collapsed || isMobile) && <span>{item.name}</span>}
      </Link>
    );

    if (collapsed && !isMobile) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{item.name}</TooltipContent>
        </Tooltip>
      );
    }
    return link;
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo / collapse toggle */}
      <div
        className={cn(
          "flex h-20 items-center border-b border-sidebar-border",
          collapsed && !isMobile ? "justify-center px-2" : "px-4 justify-between"
        )}
      >
        {!isMobile ? (
          <button
            onClick={() => onCollapsedChange(!collapsed)}
            className="flex items-center gap-2 group focus:outline-none"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <img
              src={crestwellLogo}
              alt="Crestwell Travel Services"
              className={cn(
                "object-contain transition-all duration-300",
                collapsed ? "h-8 w-8" : "h-14 w-auto"
              )}
            />
            {!collapsed && (
              <ChevronLeft className="h-4 w-4 text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70 transition-colors ml-1 shrink-0" />
            )}
          </button>
        ) : (
          <>
            <img src={crestwellLogo} alt="Crestwell Travel Services" className="h-14 w-auto object-contain" />
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="text-sidebar-foreground">
              <X className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        <TooltipProvider delayDuration={0}>
          {navigation.map((item) => (
            <NavItem key={item.name} item={item} />
          ))}

          {canViewTeam && (
            <>
              {(!collapsed || isMobile) && (
                <div className="pt-4 pb-2 px-3">
                  <p className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">Team</p>
                </div>
              )}
              {collapsed && !isMobile && <div className="pt-4 pb-2"><hr className="border-sidebar-border" /></div>}
              {adminNavigation.map((item) => (
                <NavItem key={item.name} item={item} />
              ))}
            </>
          )}
        </TooltipProvider>
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4">
        {(!collapsed || isMobile) ? (
          <>
            <div className="flex items-center gap-3 mb-3">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Avatar" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
                  <span className="text-sm font-medium text-sidebar-foreground">{userInitials}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{getRoleLabel(userRole)}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </>
        ) : (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={signOut}
                  className="flex items-center justify-center w-full p-2 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger header */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center gap-3 border-b border-border bg-background px-4">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <img src={crestwellLogo} alt="Crestwell Travel Services" className="h-8 w-auto object-contain" />
        </header>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 transition-opacity" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
          isMobile
            ? cn("w-64", mobileOpen ? "translate-x-0" : "-translate-x-full")
            : collapsed ? "w-16" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
