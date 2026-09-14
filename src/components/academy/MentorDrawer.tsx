import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useMentorThread, useSendMentorMessage } from "@/hooks/useAcademyExtras";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentor: { userId: string; fullName: string; title: string; officeHours: string } | null;
}

export function MentorDrawer({ open, onOpenChange, mentor }: Props) {
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const { data: thread } = useMentorThread(mentor?.userId);
  const send = useSendMentorMessage();

  const submit = async () => {
    if (!mentor || !body.trim()) return;
    try {
      await send.mutateAsync({ mentorUserId: mentor.userId, body: body.trim() });
      setBody("");
    } catch {
      toast({ title: "Message not sent", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="academy flex w-full flex-col sm:max-w-md" style={{ background: "var(--academy-surface)" }}>
        <SheetHeader>
          <SheetTitle style={{ fontFamily: "Lora, Georgia, serif" }}>
            {mentor ? mentor.fullName : "Your mentor"}
          </SheetTitle>
          {mentor && (
            <p className="text-left text-[13px]" style={{ color: "var(--academy-ink-soft)" }}>
              {mentor.title} · {mentor.officeHours}
            </p>
          )}
        </SheetHeader>

        {!mentor ? (
          <p className="mt-6 text-[14px]" style={{ color: "var(--academy-ink-soft)" }}>
            No mentor has been assigned yet. The education team will pair you with one shortly.
          </p>
        ) : (
          <>
            <div className="mt-5 flex-1 space-y-3 overflow-y-auto pr-1">
              {(thread || []).length === 0 && (
                <p className="text-[13.5px]" style={{ color: "var(--academy-ink-soft)" }}>
                  Start the conversation — ask about a lesson, a supplier, or a live quote.
                </p>
              )}
              {(thread || []).map((m) => {
                const mine = m.sender_id === user?.id;
                return (
                  <div
                    key={m.id}
                    style={{
                      maxWidth: "88%",
                      marginLeft: mine ? "auto" : 0,
                      background: mine ? "var(--academy-pine)" : "var(--academy-parchment)",
                      color: mine ? "#fff" : "var(--academy-ink)",
                      border: mine ? "none" : "1px solid var(--academy-line)",
                      borderRadius: 12,
                      padding: "10px 13px",
                      fontSize: 13.5,
                      lineHeight: 1.55,
                    }}
                  >
                    {m.message}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--academy-line)" }}>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="Write a message"
                className="w-full resize-none rounded-[10px] p-3 text-[14px]"
                style={{ border: "1px solid var(--academy-line)", background: "var(--academy-surface)" }}
              />
              <button
                onClick={submit}
                disabled={send.isPending || !body.trim()}
                className="mt-3 w-full rounded-[10px] px-4 py-2.5 text-[13.5px] font-medium disabled:opacity-50"
                style={{ background: "var(--academy-gold)", color: "#fff" }}
              >
                {send.isPending ? "Sending…" : "Send message"}
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
