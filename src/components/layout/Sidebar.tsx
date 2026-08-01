import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  MessageSquareText,
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
  X,
  HeartPulse,
  ArrowRightLeft,
  ShieldAlert,
  ChevronRight,
  Bell,
  CreditCard,
  Globe,
  Plane,
  FileText,
  Hotel,
  Ship,
  Star,
  Activity,
  BookOpen,
  Megaphone,
  AlertTriangle,
  ShieldCheck,
  Car,
  Inbox,
  TrendingUp,
  Landmark,
  FileBarChart,
  Download,
  Wallet,
  Banknote,
  FileWarning,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCanViewTeam, useUserRole, useIsBookkeeper, useIsAdmin } from "@/hooks/useAdmin";
import { useEarningsLabel } from "@/hooks/useEarningsLabel";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import type { FeatureKey } from "@/lib/featureRegistry";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import crestwellLogo from "@/assets/CTN-Logo.png";
import { useState, useEffect, createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const SidebarCollapsedContext = createContext<boolean>(false);
export const useSidebarCollapsed = () => useContext(SidebarCollapsedContext);

export const SIDEBAR_WIDTH_EXPANDED = 260;
export const SIDEBAR_WIDTH_COLLAPSED = 76;

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Optional feature gate. If set, item is hidden when user lacks the feature. */
  feature?: FeatureKey;
};

interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  defaultCollapsed?: boolean;
}

const topLevelNav: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, feature: "dashboard" },
  { name: "Approvals", href: "/approvals", icon: Inbox },
  { name: "Notifications", href: "/notifications", icon: Bell },
];

const navGroups: NavGroup[] = [
  {
    label: "Clients & Sales",
    icon: Users,
    items: [
      { name: "Leads",    href: "/leads",             icon: UserPlus,  feature: "leads" },
      { name: "Clients",  href: "/contacts",           icon: Users,     feature: "clients" },
      { name: "Partners", href: "/business-contacts",  icon: Building2, feature: "business_contacts" },
      { name: "Scheduling", href: "/scheduling",        icon: CalendarClock },
      { name: "Notes Chat", href: "/notes-chat",        icon: MessageSquareText },
    ],
  },
  {
    label: "Trips",
    icon: Compass,
    items: [
      { name: "Trips",       href: "/trips",       icon: Compass,   feature: "trips" },
      { name: "Trip Builder",href: "/trip-builder",icon: Compass,   feature: "trips" },
      { name: "Bookings",    href: "/bookings",    icon: BookOpen,  feature: "trips" },
      { name: "Suppliers",   href: "/suppliers",   icon: Building2, feature: "suppliers" },
      { name: "Commissions", href: "/commissions", icon: DollarSign, feature: "commissions" },
    ],
  },
  {
    label: "Search",
    icon: Ship,
    items: [
      { name: "Cruises",     href: "/cruises",     icon: Ship,    feature: "cruise_search" },
      { name: "Hotels",      href: "/hotels",       icon: Hotel,   feature: "hotel_search" },
      { name: "Flights",     href: "/flights",      icon: Plane,   feature: "flight_search" },
      { name: "Excursions",       href: "/excursions",        icon: Compass,    feature: "excursions" },
      { name: "Car Rentals",      href: "/car-rentals",       icon: Car },
      { name: "Loan Applications",href: "/loan-applications", icon: CreditCard, feature: "loan_applications" },
    ],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    defaultCollapsed: true,
    items: [
      { name: "Publish Manager", href: "/publish-manager", icon: FileText, feature: "publish_manager" },
      { name: "Featured Trips",  href: "/featured-trips",  icon: Star, feature: "featured_trips" },
      { name: "Template Library", href: "/template-library", icon: FileText },
      { name: "Form Builder", href: "/forms", icon: ClipboardList },
    ],
  },
  {
    label: "Grow",
    icon: TrendingUp,
    defaultCollapsed: true,
    items: [
      { name: "Campaigns",  href: "/campaigns",       icon: Megaphone, feature: "campaigns" },
      { name: "Training",   href: "/training",         icon: GraduationCap, feature: "training" },
      { name: "Analytics",  href: "/analytics",        icon: BarChart3, feature: "analytics" },
      { name: "The Circle ✦", href: "/circle-members", icon: Star },
    ],
  },
];

const bottomNav: NavItem[] = [
  { name: "Settings", href: "/settings", icon: Settings },
];

const adminNavGroups: NavGroup[] = [
  {
    label: "Team",
    icon: UserPlus,
    items: [
      { name: "Team Management",  href: "/team",               icon: UserPlus },
      { name: "Training Admin",   href: "/training/admin",     icon: GraduationCap },
      { name: "Risk & Compliance",href: "/risk-compliance",    icon: ShieldAlert },
      { name: "Portal Management",href: "/portal-management",  icon: Globe },
    ],
  },
  {
    label: "Operations",
    icon: Activity,
    defaultCollapsed: true,
    items: [
      { name: "AI Agents Health", href: "/kandi",            icon: BarChart3 },
      { name: "Task Monitor",     href: "/task-monitor",      icon: Activity },
      { name: "Email Activity",   href: "/email-activity",    icon: Mail },
      { name: "Payment Security", href: "/payment-security",  icon: ShieldAlert },
      { name: "Flight Monitor",   href: "/flight-monitoring", icon: Bell },
    ],
  },
  {
    label: "Finance",
    icon: HeartPulse,
    items: [
      { name: "QBO Health",            href: "/qbo-health",            icon: HeartPulse },
      { name: "QBO Payment Sync",      href: "/qbo-payment-sync",      icon: ArrowRightLeft },
      { name: "Daily Payment Report",  href: "/reports/daily-payments", icon: FileText },
      { name: "Supplier Payments Due", href: "/supplier-payments-due",  icon: Banknote },
      { name: "Commission Report",     href: "/commission-report",      icon: FileText },
    ],
  },
  {
    label: "Reconciliation",
    icon: ArrowRightLeft,
    defaultCollapsed: true,
    items: [
      { name: "Recon Dashboard", href: "/recon",             icon: ArrowRightLeft },
      { name: "Match Center",    href: "/recon/matches",     icon: ArrowRightLeft },
      { name: "Exceptions",      href: "/recon/exceptions",  icon: AlertTriangle },
      { name: "Approvals",       href: "/recon/approvals",   icon: ShieldCheck },
      { name: "Stripe Payouts",  href: "/recon/payouts",     icon: CreditCard },
      { name: "Monthly Recon",   href: "/reconciliation",    icon: FileSpreadsheet },
      { name: "Recon Settings",  href: "/recon/settings",    icon: Settings },
    ],
  },
];

// ─── Bookkeeper-only navigation ──────────────────────────────────────────────
type BookkeeperSection = { label: string | null; items: NavItem[] };

const bookkeeperSections: BookkeeperSection[] = [
  {
    label: null,
    items: [{ name: "Dashboard", href: "/bookkeeper", icon: LayoutDashboard }],
  },
  {
    label: "Financials",
    items: [
      { name: "P&L",               href: "/bookkeeper/pl",            icon: TrendingUp },
      { name: "Balance Sheet",     href: "/bookkeeper/balance-sheet", icon: FileBarChart },
      { name: "Trial Balance",     href: "/bookkeeper/trial-balance", icon: FileSpreadsheet },
      { name: "Financial Packet",  href: "/bookkeeper/packet",        icon: FileText },
    ],
  },
  {
    label: "AR / AP",
    items: [
      { name: "AR Aging", href: "/bookkeeper/ar-aging", icon: AlertTriangle },
      { name: "AP Aging", href: "/bookkeeper/ap-aging", icon: AlertTriangle },
    ],
  },
  {
    label: "Transactions",
    items: [
      { name: "Income",       href: "/bookkeeper/income",       icon: DollarSign },
      { name: "Expenses",     href: "/bookkeeper/expenses",     icon: Banknote },
      { name: "Unattributed", href: "/bookkeeper/unattributed", icon: FileWarning },
    ],
  },
  {
    label: "Payroll",
    items: [
      { name: "Agent Payouts", href: "/bookkeeper/payouts", icon: Wallet },
      { name: "1099 Prep",     href: "/bookkeeper/1099",    icon: FileText },
    ],
  },
  {
    label: "Sync",
    items: [
      { name: "QBO Sync",            href: "/qbo-health",            icon: HeartPulse },
      { name: "Stripe Recon",        href: "/recon/stripe",          icon: ArrowRightLeft },
      { name: "Bank Reconciliation", href: "/bookkeeper/bank-recon", icon: Landmark },
      { name: "QBO Sync Logs",       href: "/bookkeeper/qbo-logs",   icon: Activity },
    ],
  },
  {
    label: "Export",
    items: [
      { name: "Export Center", href: "/bookkeeper/export", icon: Download },
      { name: "Audit Log",     href: "/bookkeeper/audit",  icon: ShieldCheck },
    ],
  },
];

function useUnattributedCount(enabled: boolean) {
  return useQuery({
    queryKey: ["bookkeeper-unattributed-count"],
    enabled,
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("checkout_payments")
        .select("id", { count: "exact", head: true })
        .eq("payment_type", "unattributed_deposit")
        .neq("status", "succeeded");
      if (error) {
        console.error("Unattributed count error:", error);
        return 0;
      }
      return count ?? 0;
    },
  });
}

function getRoleLabel(role: string | null | undefined) {
  switch (role) {
    case "admin": return "Admin";
    case "office_admin": return "Office Admin";
    case "bookkeeper": return "Bookkeeper";
    case "user":
    default: return "Travel Agent";
  }
}

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (val: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (val: boolean) => void;
  isDrawerMode: boolean;
}

export function Sidebar({ collapsed, onCollapsedChange, mobileOpen, onMobileOpenChange, isDrawerMode }: SidebarProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { canView: canViewTeam } = useCanViewTeam();
  const { data: userRole } = useUserRole();
  const { data: isBookkeeper } = useIsBookkeeper();
  const { data: isAdmin } = useIsAdmin();
  const bookkeeperMode = !!isBookkeeper && !isAdmin;
  const { data: unattributedCount = 0 } = useUnattributedCount(bookkeeperMode);
  const { can: canFeature } = useFeaturePermissions();
  const navigate = useNavigate();
  const earnings = useEarningsLabel();

  const isCollapsed = collapsed && !isDrawerMode;

  const localizedNavGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items
        .map((i) =>
          i.href === "/commissions" ? { ...i, name: earnings.plural } : i
        )
        .filter((i) => !i.feature || canFeature(i.feature)),
    }))
    .filter((g) => g.items.length > 0);

  const visibleTopLevel = topLevelNav.filter(
    (i) => !i.feature || canFeature(i.feature)
  );

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || "U";

  const userName = user?.user_metadata?.full_name || user?.email || "User";

  const OPEN_GROUPS_KEY = "cts.sidebar.openGroups.v1";
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    let stored: Record<string, boolean> = {};
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(OPEN_GROUPS_KEY) : null;
      if (raw) stored = JSON.parse(raw) as Record<string, boolean>;
    } catch {
      stored = {};
    }
    const initial: Record<string, boolean> = {};
    [...navGroups, ...adminNavGroups].forEach((g) => {
      if (Object.prototype.hasOwnProperty.call(stored, g.label)) {
        initial[g.label] = stored[g.label];
        return;
      }
      const isActive = g.items.some(
        (i) => location.pathname === i.href || location.pathname.startsWith(i.href + "/")
      );
      initial[g.label] = isActive ? true : !(g.defaultCollapsed ?? false);
    });
    return initial;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(openGroups));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [openGroups]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const NavItemLink = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.href;
    const showBadge = item.href === "/bookkeeper/unattributed" && unattributedCount > 0;

    const link = (
      <Link
        to={item.href}
        onClick={() => isDrawerMode && onMobileOpenChange(false)}
        className={cn(
          "group relative flex items-center rounded-lg text-[13.5px] font-medium transition-colors duration-150",
          "h-[38px] gap-[11px] px-[11px]",
          isCollapsed && "justify-center px-0",
          isActive
            ? "bg-sidebar-accent text-accent"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )}
      >
        <span
          className={cn(
            "absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-accent transition-opacity duration-150",
            isActive ? "opacity-100" : "opacity-0"
          )}
        />
        <item.icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9} />
        {!isCollapsed && (
          <span className="flex flex-1 items-center justify-between">
            <span>{item.name}</span>
            {showBadge && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-[10px]">
                {unattributedCount}
              </Badge>
            )}
          </span>
        )}
        {isCollapsed && showBadge && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        )}
      </Link>
    );

    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">
            {item.name}
            {showBadge ? ` (${unattributedCount})` : ""}
          </TooltipContent>
        </Tooltip>
      );
    }
    return link;
  };

  const NavGroupSection = ({ group }: { group: NavGroup }) => {
    const isOpen = openGroups[group.label] ?? false;

    if (isCollapsed) {
      return (
        <>
          <div className="py-2">
            <hr className="border-sidebar-border" />
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavItemLink key={item.name} item={item} />
            ))}
          </div>
        </>
      );
    }

    return (
      <div className="pt-1">
        <button
          onClick={() => toggleGroup(group.label)}
          className="flex w-full items-center justify-between rounded-lg px-[11px] py-[7px] text-[10.5px] font-bold uppercase tracking-[.13em] text-sidebar-foreground/75 transition-colors hover:text-sidebar-foreground"
        >
          <span>{group.label}</span>
          <ChevronRight
            className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-150", isOpen && "rotate-90")}
          />
        </button>
        {isOpen && (
          <div className="mt-0.5 space-y-0.5">
            {group.items.map((item) => (
              <NavItemLink key={item.name} item={item} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo / collapse toggle */}
      <div
        className={cn(
          "flex h-[76px] shrink-0 items-center border-b border-sidebar-border",
          isCollapsed ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        {!isDrawerMode ? (
          <button
            onClick={() => onCollapsedChange(!collapsed)}
            className="flex items-center rounded-[10px] bg-white/94 p-[5px_7px] transition-opacity hover:opacity-90"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <img
              src={crestwellLogo}
              alt="Crestwell Travel Services"
              className={cn("object-contain transition-all duration-300", isCollapsed ? "h-8 w-8" : "h-14 w-auto")}
            />
          </button>
        ) : (
          <>
            <span className="rounded-[10px] bg-white/94 p-[5px_7px]">
              <img src={crestwellLogo} alt="Crestwell Travel Services" className="h-14 w-auto object-contain" />
            </span>
            <button
              onClick={() => onMobileOpenChange(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        <TooltipProvider delayDuration={0}>
          {bookkeeperMode ? (
            <>
              {bookkeeperSections.map((section, idx) => (
                <div key={section.label ?? `top-${idx}`} className={idx === 0 ? "" : "pt-3"}>
                  {section.label && !isCollapsed && (
                    <div className="px-[11px] pb-1">
                      <p className="text-[10.5px] font-bold uppercase tracking-[.13em] text-sidebar-foreground/75">
                        {section.label}
                      </p>
                    </div>
                  )}
                  {section.label && isCollapsed && (
                    <div className="pb-1"><hr className="border-sidebar-border" /></div>
                  )}
                  <div className="space-y-0.5">
                    {section.items.map((item) => (
                      <NavItemLink key={item.name} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="space-y-0.5">
                {visibleTopLevel.map((item) => (
                  <NavItemLink key={item.name} item={item} />
                ))}
              </div>

              {localizedNavGroups.map((group) => (
                <NavGroupSection key={group.label} group={group} />
              ))}

              <div className="pt-2">
                <hr className="mb-2 border-sidebar-border" />
                {bottomNav.map((item) => (
                  <NavItemLink key={item.name} item={item} />
                ))}
              </div>

              {canViewTeam && (
                <>
                  {!isCollapsed && (
                    <div className="px-[11px] pb-1 pt-4">
                      <p className="text-[10.5px] font-bold uppercase tracking-[.13em] text-sidebar-foreground/75">Admin</p>
                    </div>
                  )}
                  {isCollapsed && <div className="pb-1 pt-4"><hr className="border-sidebar-border" /></div>}
                  {adminNavGroups.map((group) => (
                    <NavGroupSection key={group.label} group={group} />
                  ))}
                </>
              )}
            </>
          )}
        </TooltipProvider>
      </nav>

      {/* Footer */}
      <div className={cn("shrink-0 border-t border-sidebar-border p-3", isCollapsed && "px-2")}>
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="Avatar" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent">
                <span className="text-[11.5px] font-semibold text-primary">{userInitials}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-sidebar-foreground">{userName}</p>
              <p className="truncate text-[11.5px] text-sidebar-foreground/60">{getRoleLabel(userRole)}</p>
            </div>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={signOut}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Sign out</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ) : (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
                  <span className="text-[11.5px] font-semibold text-primary">{userInitials}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{userName} — {getRoleLabel(userRole)}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={signOut}
                  className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );

  if (isDrawerMode) {
    return (
      <>
        {mobileOpen && (
          <div
            className="fixed inset-0 z-[35] bg-primary/50 transition-opacity"
            onClick={() => onMobileOpenChange(false)}
          />
        )}
        <aside
          className={cn(
            "fixed left-0 top-0 z-40 h-screen w-[260px] bg-sidebar border-r border-sidebar-border transition-transform duration-[280ms] ease-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  return (
    <aside
      className="fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar transition-[width] duration-[280ms] ease"
      style={{ width: isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
    >
      {sidebarContent}
    </aside>
  );
}
