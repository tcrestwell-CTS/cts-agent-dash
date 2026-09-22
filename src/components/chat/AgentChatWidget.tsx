/**
 * AgentChatWidget — Enhanced AI Chat with:
 *
 *  1. FILE UPLOAD — Paperclip button: accepts PDF, images, CSV, TXT.
 *     PDFs are read as base64 and sent to the ai-chat edge function which
 *     passes them to the LLM as a document attachment.
 *     Images are similarly passed for visual analysis / itinerary building.
 *
 *  2. VOICE INPUT — Mic button using the browser-native Web Speech API.
 *     Transcript appends to the input field. Zero cost, no third-party service.
 *
 *  3. AUTO PAGE CONTEXT — Reads the current route's tripId / clientId via
 *     useParams() and passes them to the edge function. The system prompt is
 *     updated server-side with the entity's name and key details, so the AI
 *     already knows what trip/client you're looking at when you open chat.
 *
 *  4. RESEARCH & SUMMARIZE CLIENT — AI command. Typing "research [name]" or
 *     clicking the "Research Client" quick-action button triggers a Supabase
 *     query on the edge function that fetches the client's full history (trips,
 *     bookings, payments, notes) and returns a structured summary.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle, X, Send, Loader2, Users, ArrowLeft, Circle, Sparkles,
  Paperclip, Mic, MicOff, User, FileText, Image as ImageIcon, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgentMessages, useOnlineAgents } from "@/hooks/useAgentMessages";
import { useTeamProfiles } from "@/hooks/useTeamProfiles";
import { useAgentNotifications } from "@/hooks/useAgentNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";
import { playMessageChime } from "@/lib/notificationSound";

// ── Types ──────────────────────────────────────────────────────────────────────

import { HIDDEN_AGENT_USER_IDS } from "@/lib/hiddenAgents";

type View = "closed" | "menu" | "team" | "dm" | "ai";

// Users removed from the team chat UI and message streams.
const BLOCKED_FROM_CHAT = HIDDEN_AGENT_USER_IDS;

interface FileAttachment {
  name: string;
  type: "pdf" | "image" | "csv" | "text";
  base64: string;
  mimeType: string;
}

interface AiMsg {
  role: "user" | "assistant";
  content: string;
  attachment?: { name: string; type: FileAttachment["type"] };
}

// ── Web Speech API type augmentation ──────────────────────────────────────────

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// ── File helpers ───────────────────────────────────────────────────────────────

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.gif,.webp,.csv,.txt";
const MAX_FILE_MB = 8;

function getFileType(file: File): FileAttachment["type"] {
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "text/csv" || file.name.endsWith(".csv")) return "csv";
  return "text";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:...;base64, prefix
      resolve(result.split(",")[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Quick action chips ─────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "Research this client", icon: User,       prompt: "__RESEARCH_CLIENT__" },
  { label: "Summarize this trip",  icon: Sparkles,   prompt: "Summarize the current trip for me — status, next actions, and any pending payments." },
  { label: "Tasks this week",      icon: FileText,   prompt: "What tasks are due this week?" },
];

// ── Main Component ─────────────────────────────────────────────────────────────

export function AgentChatWidget() {
  const { user } = useAuth();
  // Auto page context: parse entity IDs from the current pathname.
  // useLocation() works at any level of the router tree; useParams() only
  // returns values when rendered inside a matching <Route> — since this widget
  // is at the root level of BrowserRouter, useParams always returns {}.
  const location = useLocation();

  // Hide the agent-only chat widget on public/client-facing routes.
  const isPublicRoute = (() => {
    const path = location.pathname;
    return (
      path.startsWith("/group/") ||
      path.startsWith("/shared/") ||
      path.startsWith("/proposal/") ||
      path.startsWith("/authorize/") ||
      path.startsWith("/pay") ||
      path.startsWith("/payment") ||
      path.startsWith("/checkout") ||
      path.startsWith("/update-info/") ||
      path.startsWith("/client/") ||
      path === "/payment-success"
    );
  })();
  if (!user || isPublicRoute) return null;

  const pageContext = (() => {
    const path = location.pathname;
    // /trips/:tripId  or  /trips/:tripId/anything
    const tripMatch = path.match(/^\/trips\/([^/]+)/);
    // /contacts/:clientId  or  /portal-preview/:clientId
    const clientMatch = path.match(/^\/(?:contacts|portal-preview)\/([^/]+)/);
    return {
      tripId: tripMatch?.[1] ?? null,
      clientId: clientMatch?.[1] ?? null,
    };
  })();

  const [view, setView] = useState<View>("closed");
  const [dmPartnerId, setDmPartnerId] = useState<string | undefined>();
  const [dmPartnerName, setDmPartnerName] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const onlineAgents = useOnlineAgents();
  const { data: teamProfiles = [] } = useTeamProfiles();
  // Everyone on the team, online first — DM threads with offline agents were
  // previously invisible because the menu only listed online sessions.
  const onlineIds = new Set(onlineAgents.map((a) => a.user_id));
  const teammates = teamProfiles
    .filter((p) => p.user_id && p.user_id !== user?.id && !BLOCKED_FROM_CHAT.includes(p.user_id))
    .map((p) => ({
      user_id: p.user_id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      online: onlineIds.has(p.user_id),
    }))
    .sort((a, b) =>
      a.online === b.online
        ? (a.full_name || "").localeCompare(b.full_name || "")
        : a.online ? -1 : 1
    );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI state
  const [aiMessages, setAiMessages] = useState<AiMsg[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiSending, setAiSending] = useState(false);

  // File attachment state
  const [pendingFile, setPendingFile] = useState<FileAttachment | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const speechSupported = typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const channel = view === "dm" ? "dm" : "team";
  const { messages, loading, sendMessage } = useAgentMessages(
    channel as "team" | "dm",
    dmPartnerId
  );

  // Unread chat notifications persist even when the widget is closed / the
  // agent was offline when the message arrived.
  const { notifications, markAsRead } = useAgentNotifications();
  const unreadChat = notifications.filter((n) => n.type === "agent_message" && !n.is_read);

  useEffect(() => {
    if (view !== "team" && view !== "dm") return;
    unreadChat.forEach((n) => markAsRead.mutate(n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, unreadChat.length]);

  // ── Popup notifications for new agent chat messages ──────────────────────────
  // Subscribe globally so agents get toast pop-ups regardless of which page
  // they're on. Suppresses toasts for the conversation currently open in the
  // widget and for messages the current user sent themselves.
  const mountedAtRef = useRef<string>(new Date().toISOString());
  useEffect(() => {
    if (!user) return;
    const sub = supabase
      .channel("agent-messages-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_messages" },
        async (payload) => {
          const m: any = payload.new;
          if (!m || m.sender_id === user.id || BLOCKED_FROM_CHAT.includes(m.sender_id)) return;
          // Only notify on team messages or DMs addressed to this user
          const isDmToMe = m.channel === "dm" && m.recipient_id === user.id;
          const isTeam = m.channel === "team";
          if (!isDmToMe && !isTeam) return;
          // Suppress if the relevant conversation is already open
          if (isTeam && view === "team") return;
          if (isDmToMe && view === "dm" && dmPartnerId === m.sender_id) return;

          // Look up sender name
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("user_id", m.sender_id)
            .maybeSingle();
          const senderName = profile?.full_name || "Agent";
          const preview =
            (m.message as string).length > 120
              ? `${(m.message as string).slice(0, 117)}…`
              : (m.message as string);

          playMessageChime();
          toast(isDmToMe ? `New message from ${senderName}` : `${senderName} · Team Chat`, {
            description: preview,
            duration: 8000,
            action: {
              label: "Open",
              onClick: () => {
                if (isDmToMe) {
                  setDmPartnerId(m.sender_id);
                  setDmPartnerName(senderName);
                  setView("dm");
                } else {
                  setView("team");
                }
              },
            },
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [user, view, dmPartnerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, view, aiMessages.length]);

  // ── Team/DM send ─────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    await sendMessage(newMessage, view === "dm" ? dmPartnerId : undefined);
    setNewMessage("");
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (view === "ai") handleAiSend();
      else handleSend();
    }
  };

  const openDm = (agentId: string, agentName: string) => {
    setDmPartnerId(agentId);
    setDmPartnerName(agentName);
    setView("dm");
  };

  // ── File upload ───────────────────────────────────────────────────────────────

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`File too large — max ${MAX_FILE_MB}MB`);
      return;
    }

    setFileLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const type = getFileType(file);
      setPendingFile({ name: file.name, type, base64, mimeType: file.type });
      // Prompt helper
      if (type === "pdf") setAiInput((prev) => prev || "Extract the itinerary from this document and build a trip");
      else if (type === "image") setAiInput((prev) => prev || "What do you see in this image?");
    } catch {
      toast.error("Failed to read file");
    } finally {
      setFileLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Voice input ───────────────────────────────────────────────────────────────

  const toggleVoice = useCallback(() => {
    if (!speechSupported) {
      toast.error("Voice input not supported in this browser");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAiInput((prev) => prev ? `${prev} ${transcript}` : transcript);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech") toast.error(`Voice error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, speechSupported]);

  if (!user) return null;

  // ── AI send ───────────────────────────────────────────────────────────────────

  const handleAiSend = async (overrideText?: string) => {
    const text = (overrideText ?? aiInput).trim();
    if ((!text && !pendingFile) || aiSending) return;

    // Special: research client quick action
    const isResearch = text === "__RESEARCH_CLIENT__";
    const displayText = isResearch
      ? "Research and summarize this client for me"
      : text;

    const userMsg: AiMsg = {
      role: "user",
      content: displayText,
      ...(pendingFile ? { attachment: { name: pendingFile.name, type: pendingFile.type } } : {}),
    };

    const next: AiMsg[] = [...aiMessages, userMsg];
    setAiMessages(next);
    setAiInput("");
    const capturedFile = pendingFile;
    setPendingFile(null);
    setAiSending(true);

    try {
      const body: any = {
        messages: next.map((m) => ({ role: m.role, content: m.content })),
        // Auto page context
        context: pageContext,
      };

      // Attach file for edge function processing
      if (capturedFile) {
        body.attachment = {
          name: capturedFile.name,
          type: capturedFile.type,
          base64: capturedFile.base64,
          mimeType: capturedFile.mimeType,
        };
      }

      // Research mode flag
      if (isResearch) {
        body.researchClient = true;
      }

      const { data, error } = await supabase.functions.invoke("ai-chat", { body });
      if (error) throw error;
      const reply = (data as any)?.reply ?? "(no reply)";
      setAiMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast.error(e?.message ?? "AI request failed");
      setAiMessages((prev) => [...prev, { role: "assistant", content: "Sorry, that failed. Try again." }]);
    } finally {
      setAiSending(false);
    }
  };

  // ── File type icon ────────────────────────────────────────────────────────────

  const FileTypeIcon = ({ type }: { type: FileAttachment["type"] }) => {
    if (type === "pdf") return <FileText className="h-3.5 w-3.5 text-destructive" />;
    if (type === "image") return <ImageIcon className="h-3.5 w-3.5 text-info" />;
    return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  // ── RENDER ────────────────────────────────────────────────────────────────────

  if (view === "closed") {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Donna (AI) FAB */}
        <button
          onClick={() => setView("ai")}
          className="group relative h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center transition-all hover:scale-105"
          data-testid="button-ai-fab"
          title="Chat with Donna (AI Assistant)"
        >
          <Sparkles className="h-6 w-6" />
          <span className="absolute right-full mr-2 whitespace-nowrap rounded-md bg-foreground/90 px-2 py-1 text-[11px] font-medium text-background opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Ask Donna
          </span>
        </button>

        {/* Team Chat FAB */}
        <button
          onClick={() => setView("team")}
          className="group relative h-14 w-14 rounded-full bg-card border border-border text-foreground shadow-lg hover:bg-muted flex items-center justify-center transition-all hover:scale-105"
          data-testid="button-chat-fab"
          title="Team Chat"
        >
          <Users className="h-6 w-6" />
          {unreadChat.length > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold flex items-center justify-center">
              {unreadChat.length > 9 ? "9+" : unreadChat.length}
            </span>
          ) : onlineAgents.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-success text-[10px] text-white font-bold flex items-center justify-center">
              {onlineAgents.length}
            </span>
          )}
          <span className="absolute right-full mr-2 whitespace-nowrap rounded-md bg-foreground/90 px-2 py-1 text-[11px] font-medium text-background opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Team Chat
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[560px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50 flex-shrink-0">
        {(view === "team" || view === "dm" || view === "ai") && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setView(view === "ai" ? "closed" : "menu")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h3 className="text-sm font-semibold flex-1">
          {view === "menu" && "Team Chat"}
          {view === "team" && "Team Chat"}
          {view === "dm" && dmPartnerName}
          {view === "ai" && (
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Donna
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">BETA</Badge>
            </span>
          )}
        </h3>
        {/* Page context pill */}
        {view === "ai" && pageContext.tripId && (
          <Badge variant="outline" className="text-[9px] px-1.5 gap-0.5 text-muted-foreground">
            <Sparkles className="h-2.5 w-2.5" /> Trip context
          </Badge>
        )}
        {view === "ai" && pageContext.clientId && !pageContext.tripId && (
          <Badge variant="outline" className="text-[9px] px-1.5 gap-0.5 text-muted-foreground">
            <User className="h-2.5 w-2.5" /> Client context
          </Badge>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setView("closed")}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Menu View ── */}
      {view === "menu" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <button
            onClick={() => setView("team")}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Team Channel</p>
              <p className="text-xs text-muted-foreground">Message all agents</p>
            </div>
          </button>

          {teammates.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-medium text-muted-foreground px-1 pb-2">
                Advisors ({onlineAgents.length} online)
              </p>
              {teammates.map((agent) => (
                <button
                  key={agent.user_id}
                  onClick={() => openDm(agent.user_id, agent.full_name || "Agent")}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div className="relative">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={agent.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">{(agent.full_name || "A").charAt(0)}</AvatarFallback>
                    </Avatar>
                    {agent.online && (
                      <Circle className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 fill-success text-success" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-foreground truncate">
                    {agent.full_name || "Agent"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {teammates.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No other advisors yet
            </p>
          )}
        </div>
      )}

      {/* ── AI View ── */}
      {view === "ai" && (
        <>
          <ScrollArea className="flex-1 p-3">
            {aiMessages.length === 0 ? (
              <div className="py-4 space-y-3">
                {/* Page context banner */}
                {(pageContext.tripId || pageContext.clientId) && (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                    <span>
                      {pageContext.tripId
                        ? "I can see you're on a trip page — I'll use it as context automatically."
                        : "I can see you're on a client page — I'll use it as context automatically."}
                    </span>
                  </div>
                )}

                {/* Quick actions */}
                <div className="space-y-1.5">
                  {(pageContext.clientId || pageContext.tripId) && (
                    <button
                      onClick={() => handleAiSend("__RESEARCH_CLIENT__")}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted/50 text-left transition-colors text-xs"
                    >
                      <User className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="font-medium">Research &amp; summarize this client</span>
                    </button>
                  )}
                  {QUICK_ACTIONS.filter((a) => a.prompt !== "__RESEARCH_CLIENT__").map((action) => (
                    <button
                      key={action.prompt}
                      onClick={() => handleAiSend(action.prompt)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted/50 text-left transition-colors text-xs"
                    >
                      <action.icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground px-1">
                  Or try: "Build a trip itinerary from this PDF" (attach a file) · "What's on my plate today?"
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {aiMessages.map((m, i) => (
                  <div key={i} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
                    <div className={cn(
                      "max-w-[88%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}>
                      {m.attachment && (
                        <div className={cn(
                          "flex items-center gap-1.5 mb-1.5 rounded px-2 py-1 text-[11px]",
                          m.role === "user" ? "bg-white/20" : "bg-background/60"
                        )}>
                          <FileTypeIcon type={m.attachment.type} />
                          <span className="truncate max-w-[160px]">{m.attachment.name}</span>
                        </div>
                      )}
                      {m.content}
                    </div>
                  </div>
                ))}
                {aiSending && (
                  <div className="flex gap-2">
                    <div className="bg-muted rounded-xl px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> thinking…
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input area */}
          <div className="p-3 border-t flex-shrink-0 space-y-2">
            {/* Pending file chip */}
            {pendingFile && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted border text-xs">
                <FileTypeIcon type={pendingFile.type} />
                <span className="flex-1 truncate">{pendingFile.name}</span>
                <button
                  onClick={() => setPendingFile(null)}
                  className="text-muted-foreground hover:text-foreground"
                  type="button"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Voice listening indicator */}
            {isListening && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-destructive/10 dark:bg-destructive/20 border border-destructive/30 dark:border-destructive text-xs text-destructive dark:text-destructive">
                <span className="h-2 w-2 rounded-full bg-destructive animate-pulse flex-shrink-0" />
                Listening… speak now
              </div>
            )}

            <div className="flex items-end gap-1.5">
              {/* File upload button */}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => fileInputRef.current?.click()}
                disabled={fileLoading || aiSending}
                title="Attach file (PDF, image, CSV, TXT)"
                type="button"
                data-testid="button-chat-attach"
              >
                {fileLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Paperclip className="h-4 w-4" />
                }
              </Button>

              {/* Voice button */}
              {speechSupported && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 shrink-0 transition-colors",
                    isListening
                      ? "text-destructive hover:text-destructive bg-destructive/10 dark:bg-destructive/20"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={toggleVoice}
                  disabled={aiSending}
                  title={isListening ? "Stop listening" : "Voice input"}
                  type="button"
                  data-testid="button-chat-voice"
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}

              {/* Text input */}
              <Textarea
                placeholder={isListening ? "Listening…" : pendingFile ? "Ask about this file…" : "Ask Donna…"}
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                className="resize-none min-h-[36px] text-sm flex-1"
                disabled={isListening}
                data-testid="input-chat-message"
              />

              {/* Send button */}
              <Button
                size="icon"
                className="shrink-0 h-9 w-9"
                onClick={() => handleAiSend()}
                disabled={(!aiInput.trim() && !pendingFile) || aiSending}
                type="button"
                data-testid="button-chat-send"
              >
                {aiSending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />
                }
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── Team / DM View ── */}
      {(view === "team" || view === "dm") && (
        <>
          <ScrollArea className="flex-1 p-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No messages yet. Start the conversation!
              </p>
            ) : (
              <div className="space-y-3">
                {messages
                  .filter((msg) => !BLOCKED_FROM_CHAT.includes(msg.sender_id))
                  .map((msg) => {
                  const isMine = msg.sender_id === user.id;
                  return (
                    <div key={msg.id} className={cn("flex gap-2", isMine && "flex-row-reverse")}>
                      {!isMine && (
                        <Avatar className="h-7 w-7 mt-0.5 shrink-0">
                          <AvatarImage src={msg.sender_avatar} />
                          <AvatarFallback className="text-[10px]">
                            {(msg.sender_name || "A").charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={cn(
                        "max-w-[75%] rounded-xl px-3 py-2",
                        isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      )}>
                        {!isMine && view === "team" && (
                          <p className="text-[10px] font-semibold mb-0.5 opacity-70">
                            {msg.sender_name}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                        <p className={cn(
                          "text-[10px] mt-1",
                          isMine ? "text-primary-foreground/60" : "text-muted-foreground"
                        )}>
                          {format(new Date(msg.created_at), "h:mm a")}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <div className="p-3 border-t flex-shrink-0">
            <div className="flex gap-2">
              <Textarea
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                className="resize-none min-h-[36px] text-sm"
              />
              <Button
                size="icon"
                className="shrink-0 h-9 w-9"
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
