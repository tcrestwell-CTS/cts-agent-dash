import { useState, useRef, useEffect } from "react";
import { usePortalMessages, useSendPortalMessage, usePortalDashboard } from "@/hooks/usePortalData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Loader2, User } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";
import { usePortalAuth } from "@/contexts/PortalAuthContext";

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return `Today ${format(d, "h:mm a")}`;
  if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
  return format(d, "MMM d, h:mm a");
}

export default function PortalMessages() {
  const { data, isLoading } = usePortalMessages();
  const { data: dashData } = usePortalDashboard();
  const { session } = usePortalAuth();
  const sendMessage = useSendPortalMessage();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = data?.messages || [];
  const agent = dashData?.agent;
  const agentInitials = agent?.name
    ? agent.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "TC";
  const clientName = session?.clientName || "You";
  const clientInitials = clientName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!newMessage.trim() || sendMessage.isPending) return;
    await sendMessage.mutateAsync(newMessage.trim());
    setNewMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Messages</h1>
        {agent && (
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              {agent.avatar_url && <AvatarImage src={agent.avatar_url} alt={agent.name} />}
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{agentInitials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs font-semibold text-foreground leading-none">{agent.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Your travel advisor</p>
            </div>
          </div>
        )}
      </div>

      <Card className="flex flex-col overflow-hidden" style={{ height: "calc(100vh - 260px)", minHeight: 400 }}>
        <CardHeader className="pb-3 border-b shrink-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            Chat with {agent?.name || "Your Travel Agent"}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8 gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Start the conversation</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Send a message to {agent?.name || "your travel agent"} below.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg: any) => {
              const isAgent = msg.sender_type === "agent";
              return (
                <div key={msg.id} className={cn("flex gap-2.5", isAgent ? "flex-row" : "flex-row-reverse")}>
                  <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                    {isAgent && agent?.avatar_url && <AvatarImage src={agent.avatar_url} alt={agent.name} />}
                    <AvatarFallback className={cn(
                      "text-xs font-semibold",
                      isAgent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {isAgent ? agentInitials : clientInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn("max-w-[75%] space-y-1", isAgent ? "items-start" : "items-end flex flex-col")}>
                    <div className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      isAgent
                        ? "bg-muted text-foreground rounded-tl-sm"
                        : "bg-primary text-primary-foreground rounded-tr-sm"
                    )}>
                      {msg.message}
                    </div>
                    <p className="text-[10px] text-muted-foreground px-1">
                      {isAgent ? agent?.name || "Agent" : "You"} · {dateLabel(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="shrink-0 border-t p-3 flex gap-2 bg-card">
          <Textarea
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
            className="resize-none text-sm min-h-[40px] max-h-[120px]"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMessage.isPending}
            size="icon"
            className="shrink-0 self-end h-10 w-10"
          >
            {sendMessage.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />
            }
          </Button>
        </div>
      </Card>
    </div>
  );
}
