import { Link, useLocation } from "react-router-dom";
import { Compass, FileText, MessageCircle, LayoutDashboard, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortal } from "@/contexts/PortalContext";
import { Button } from "@/components/ui/button";

const portalNav = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "My Trips", href: "/trips", icon: Compass },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Messages", href: "/messages", icon: MessageCircle },
];

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { session, logout } = usePortal();

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav bar */}
      <header className="sticky top-0 z-40 bg-sidebar border-b border-sidebar-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/dashboard" className="flex items-center gap-2">
                <img
                  src="/lovable-uploads/ca8734b5-c59b-4dd9-9431-498d1e25746a.png"
                  alt="Crestwell Travel Services"
                  className="h-10 w-auto object-contain"
                />
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                {portalNav.map((item) => {
                  const isActive = location.pathname === item.href ||
                    (item.href !== "/portal" && location.pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-sidebar-foreground/70 hidden sm:inline">
                Welcome, {session?.clientName}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-sidebar-foreground/70 hover:text-sidebar-foreground"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="md:hidden border-t border-sidebar-border px-4 py-2 flex gap-1 overflow-x-auto">
          {portalNav.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== "/portal" && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
