import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2, Bell, ExternalLink } from "lucide-react";
import { useAgentNotifications } from "@/hooks/useAgentNotifications";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

/**
 * VirtualCardNotifications
 *
 * Dashboard widget that shows the agent's unread virtual card notifications.
 * When a client pays via Stripe or Affirm, a notification is created
 * and appears here in real-time. The agent can click through to the
 * trip detail page to retrieve the virtual card details.
 */
export function VirtualCardNotifications() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useAgentNotifications();
  const navigate = useNavigate();

  // Only show virtual card notifications, most recent first
  const vcardNotifications = notifications.filter((n) => n.type === "virtual_card_ready");

  if (vcardNotifications.length === 0) return null;

  return (
    <Card className={unreadCount > 0 ? "ring-2 ring-primary/30" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Virtual Cards
            {unreadCount > 0 && (
              <Badge variant="default" className="text-xs px-1.5 py-0.5 h-5">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-7"
              onClick={() => markAllAsRead.mutate()}
            >
              Mark all read
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {vcardNotifications.slice(0, 5).map((notification) => (
          <div
            key={notification.id}
            className={`p-3 rounded-lg border text-sm cursor-pointer transition-colors ${
              notification.is_read
                ? "bg-background border-border/50"
                : "bg-primary/5 border-primary/20"
            }`}
            onClick={() => {
              if (!notification.is_read) markAsRead.mutate(notification.id);
              if (notification.trip_id) navigate(`/trips/${notification.trip_id}`);
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                {notification.is_read ? (
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                ) : (
                  <Bell className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className={`font-medium truncate ${notification.is_read ? "text-muted-foreground" : "text-foreground"}`}>
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {notification.message}
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
              </span>
            </div>
            {notification.trip_id && (
              <div className="mt-2 flex justify-end">
                <Button variant="ghost" size="sm" className="text-xs h-6 gap-1 text-primary">
                  <ExternalLink className="h-3 w-3" />
                  View Trip
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
