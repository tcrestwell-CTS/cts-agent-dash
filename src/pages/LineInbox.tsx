import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type LineConversation = {
  id: string;
  line_user_id: string;
  display_name: string | null;
  picture_url: string | null;
  client_id: string | null;
  assigned_agent_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
};

type LineMessage = {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  text: string | null;
  created_at: string;
};

export default function LineInbox() {
  const { session } = useAuth();
  const [conversations, setConversations] = useState<LineConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LineMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    const { data } = await supabase
      .from("line_conversations")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false });
    setConversations((data as LineConversation[]) || []);
  };

  useEffect(() => {
    loadConversations();
    // Simple polling — same pragmatic approach used for the mobile chat
    // screen's message refresh, no realtime subscription set up yet.
    const interval = setInterval(loadConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const loadMessages = async () => {
      const { data } = await supabase
        .from("line_messages")
        .select("*")
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true });
      setMessages((data as LineMessage[]) || []);
    };
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedConvo = conversations.find((c) => c.id === selectedId);

  const handleSend = async () => {
    if (!replyText.trim() || !selectedId || !session) return;
    setSending(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-line-message`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ conversationId: selectedId, text: replyText }),
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Failed to send");
      setReplyText("");
      // Optimistic append — real row will show up on next poll too.
      setMessages((prev) => [
        ...prev,
        { id: `temp-${Date.now()}`, conversation_id: selectedId, direction: "outbound", text: replyText, created_at: new Date().toISOString() },
      ]);
      loadConversations();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Conversation list */}
        <div className="w-80 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <MessageCircle className="w-5 h-5" /> LINE
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Conversations from Thailand-based clients via LINE
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No LINE conversations yet.</p>
            ) : (
              conversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => setSelectedId(convo.id)}
                  className={cn(
                    "w-full text-left p-3 border-b border-border hover:bg-muted/50 transition-colors flex items-start gap-3",
                    selectedId === convo.id && "bg-muted"
                  )}
                >
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    <AvatarImage src={convo.picture_url ?? undefined} />
                    <AvatarFallback>{(convo.display_name ?? "?")[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{convo.display_name ?? "Unknown LINE user"}</p>
                      {convo.unread_count > 0 && (
                        <Badge variant="default" className="text-[10px] px-1.5 h-4">{convo.unread_count}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{convo.last_message_preview ?? ""}</p>
                    {!convo.client_id && (
                      <Badge variant="outline" className="text-[10px] mt-1">Not linked to a client</Badge>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message thread */}
        <div className="flex-1 flex flex-col">
          {!selectedConvo ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-border flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={selectedConvo.picture_url ?? undefined} />
                  <AvatarFallback>{(selectedConvo.display_name ?? "?")[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{selectedConvo.display_name ?? "Unknown LINE user"}</p>
                  {!selectedConvo.client_id && (
                    <p className="text-xs text-muted-foreground">
                      Not yet linked to a client record — reply normally, link them from the client's profile when confirmed
                    </p>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex", msg.direction === "outbound" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[70%] rounded-lg px-3 py-2 text-sm",
                        msg.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                    >
                      <p>{msg.text}</p>
                      <p className={cn("text-[10px] mt-1", msg.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-border flex gap-2">
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Type a reply..."
                  disabled={sending}
                />
                <Button onClick={handleSend} disabled={sending || !replyText.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
