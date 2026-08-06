import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Search, Sun, Moon, Bell, Menu, CheckCircle2, ExternalLink, CreditCard } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useAdmin";
import { useAgentNotifications } from "@/hooks/useAgentNotifications";
import { useOnClickOutside } from "@/hooks/use-on-click-outside";

function getRoleLabel(role: string | null | undefined) {
  switch (role) {
    case "admin": return "Admin";
    case "office_admin": return "Office Admin";
    case "bookkeeper": return "Bookkeeper";
    case "user":
    default: return "Travel Agent";
  }
}

interface HeaderProps {
  onMobileMenuClick?: () => void;
  showMobileMenuButton?: boolean;
}

export function Header({ onMobileMenuClick, showMobileMenuButton }: HeaderProps) {
  const { user } = useAuth();
  const { data: userRole } = useUserRole();
  const { theme, setTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useAgentNotifications();

  useOnClickOutside(notifRef, () => setNotifOpen(false));

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
      {showMobileMenuButton && (
        <button
          onClick={onMobileMenuClick}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>
      )}

      <div className="relative hidden sm:block" style={{ width: 300 }}>
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-[13.5px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        <span className="hidden md:inline-flex items-center rounded-full border border-border bg-card-2 px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground">
          {getRoleLabel(userRole)}
        </span>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-accent" />
            )}
          </button>

          {notifOpen && (
            <div
              className="absolute right-0 top-[calc(100%+8px)] z-[60] w-80 overflow-hidden rounded-[11px] border border-border bg-popover shadow-lg"
              style={{ maxHeight: 400 }}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-[13.5px] font-semibold text-foreground">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead.mutate()}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 340 }}>
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-[15px] font-semibold text-foreground">All caught up</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">No notifications right now.</p>
                  </div>
                ) : (
                  notifications.slice(0, 10).map((n) => {
                    const NotifIcon =
                      n.type === "itinerary_approved" ? CheckCircle2 :
                      n.type === "payment_reminder" ? Bell :
                      n.type === "option_selected" ? ExternalLink :
                      CreditCard;
                    return (
                      <div
                        key={n.id}
                        className={cn(
                          "cursor-pointer border-b border-border/50 px-4 py-3 text-sm transition-colors",
                          n.is_read ? "bg-popover" : "bg-tint"
                        )}
                        onClick={() => {
                          if (!n.is_read) markAsRead.mutate(n.id);
                          if (n.type === "client_message" && n.client_id) {
                            navigate(`/contacts/${n.client_id}?messages=1`);
                            setNotifOpen(false);
                          } else if (n.trip_id) {
                            navigate(`/trips/${n.trip_id}`);
                            setNotifOpen(false);
                          }
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <NotifIcon className={cn("mt-0.5 h-4 w-4 shrink-0", n.is_read ? "text-muted-foreground" : "text-accent")} />
                          <div className="min-w-0 flex-1">
                            <p className={cn("truncate font-medium", n.is_read ? "text-muted-foreground" : "text-foreground")}>
                              {n.title}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                            <p className="mt-1 text-xs text-muted-foreground/60">
                              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {notifications.length > 0 && (
                <div className="border-t border-border px-4 py-2">
                  <button
                    onClick={() => {
                      setNotifOpen(false);
                      navigate("/notifications?filter=pending");
                    }}
                    className="w-full py-1 text-center text-xs font-medium text-accent hover:underline"
                  >
                    View pending notifications
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {user?.user_metadata?.avatar_url ? (
          <img src={user.user_metadata.avatar_url} alt="Avatar" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
            <span className="text-[11.5px] font-semibold text-primary">{userInitials}</span>
          </div>
        )}
      </div>
    </header>
  );
}
