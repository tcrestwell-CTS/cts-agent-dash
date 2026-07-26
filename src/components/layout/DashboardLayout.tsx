import { useState } from "react";
import { Sidebar, SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from "./Sidebar";
import { Header } from "./Header";
import { useSessionHeartbeat } from "@/hooks/useSessionHeartbeat";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMediaQuery } from "@/hooks/use-media-query";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const isMobile = useIsMobile();
  const isDrawerMode = useMediaQuery("(max-width: 1023px)");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useSessionHeartbeat();

  const contentPadding = isDrawerMode ? 0 : collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
        isDrawerMode={isDrawerMode}
      />
      <div
        className="transition-[padding-left] duration-[280ms] ease"
        style={{ paddingLeft: contentPadding }}
      >
        <Header
          showMobileMenuButton={isDrawerMode}
          onMobileMenuClick={() => setMobileOpen(true)}
        />
        <main>
          <div className={isMobile ? "p-4" : "p-8"}>{children}</div>
        </main>
      </div>
    </div>
  );
}
