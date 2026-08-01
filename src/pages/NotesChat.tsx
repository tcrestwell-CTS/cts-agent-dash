import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquareText, RotateCcw, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Which clients mentioned an Alaska cruise?",
  "What did we promise on the last call with Jeanette?",
  "Who has open action items from recent calls?",
  "Any clients with dietary restrictions or allergies noted?",
];

export default function NotesChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastTerms, setLastTerms] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [loading]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("notes-chat", {
        body: { messages: next },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLastTerms(Array.isArray(data?.terms) ? data.terms : []);
      setMessages([...next, { role: "assistant", content: String(data?.answer ?? "") }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Notes Chat is unavailable right now.";
      toast.error(message);
      setMessages(next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <MessageSquareText className="h-6 w-6 text-primary" />
              Notes Chat
            </h1>
            <p className="text-sm text-muted-foreground">
              Ask questions across your client records, call notes, trips, portal messages and leads.
              Results are scoped to your own records — admins see the whole agency.
            </p>
          </div>
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMessages([]);
                setLastTerms([]);
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              New conversation
            </Button>
          )}
        </div>

        <Card className="flex min-h-[60vh] flex-col">
          <CardContent className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && !loading && (
              <div className="space-y-4 py-8 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Notes Chat only answers from records you have access to.
                </p>
                <div className="mx-auto flex max-w-xl flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} variant="secondary" size="sm" onClick={() => ask(s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
                      : "max-w-[90%] rounded-lg border bg-muted/40 px-4 py-3 text-sm"
                  }
                >
                  {m.role === "user" ? (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  ) : (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-ul:my-2">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching client history…
              </div>
            )}
            <div ref={endRef} />
          </CardContent>

          <div className="border-t p-4">
            {lastTerms.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1">
                <span className="text-xs text-muted-foreground">Matched on:</span>
                {lastTerms.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask(input);
                  }
                }}
                placeholder="Ask about a client, trip, call or lead…"
                rows={2}
                className="resize-none"
                disabled={loading}
              />
              <Button onClick={() => ask(input)} disabled={loading || !input.trim()} size="icon" className="h-10 w-10">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">How it works</CardTitle>
            <CardDescription className="text-xs">
              Each question runs a keyword search across your clients, Nadia call notes, trips, portal messages
              and assigned leads, then answers only from what it finds — with the record cited inline. Non-admin
              agents see only records tied to their user ID; admins see all agency records.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </DashboardLayout>
  );
}
