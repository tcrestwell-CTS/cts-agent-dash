import { Sidebar } from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className={isMobile ? "pt-14" : "pl-64"}>
        <div className={isMobile ? "p-4" : "p-8"}>{children}</div>
      </main>
    </div>
  );
}
