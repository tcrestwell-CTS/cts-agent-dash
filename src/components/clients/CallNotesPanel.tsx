import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CalendarClock, ChevronDown, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import {
  useCallNotes,
  useDeleteCallNote,
  useSummarizeCall,
  type CallNote,
} from "@/hooks/useCallNotes";

const CALL_TYPES = [
  { value: "phone", label: "Phone call" },
  { value: "video", label: "Video call" },
  { value: "in_person", label: "In person" },
  { value: "other", label: "Other" },
];

const SENTIMENT_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  positive: "default",
  neutral: "secondary",
  concerned: "outline",
  negative: "destructive",
};

function formatDate(value?: string | null) {
  const parsed = value ? parseLocalDate(value) : null;
  return parsed ? format(parsed, "MMM d, yyyy") : "—";
}

function NoteCard({ note, onDelete }: { note: CallNote; onDelete: (id: string) => void }) {
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{note.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(note.call_date)} ·{" "}
            {CALL_TYPES.find((t) => t.value === note.call_type)?.label ?? note.call_type}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {note.sentiment && (
            <Badge variant={SENTIMENT_VARIANT[note.sentiment] ?? "secondary"} className="capitalize">
              {note.sentiment}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => onDelete(note.id)}
            aria-label="Delete call note"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {note.summary && <p className="text-sm whitespace-pre-wrap">{note.summary}</p>}

      {note.key_points?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Key points
          </p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {note.key_points.map((point, i) => <li key={i}>{point}</li>)}
          </ul>
        </div>
      )}

      {note.action_items?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Action items
          </p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {note.action_items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}

      {note.follow_up_date && (
        <p className="text-sm flex items-center gap-2 text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          Follow up by {formatDate(note.follow_up_date)}
        </p>
      )}

      {note.transcript && (
        <Collapsible open={showTranscript} onOpenChange={setShowTranscript}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="px-0 text-xs">
              <ChevronDown
                className={`h-3 w-3 mr-1 transition-transform ${showTranscript ? "rotate-180" : ""}`}
              />
              {showTranscript ? "Hide" : "Show"} original transcript
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap max-h-64 overflow-y-auto">
              {note.transcript}
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export default function CallNotesPanel({ clientId }: { clientId: string }) {
  const { data: notes = [], isLoading } = useCallNotes(clientId);
  const summarize = useSummarizeCall();
  const deleteNote = useDeleteCallNote(clientId);

  const [transcript, setTranscript] = useState("");
  const [callDate, setCallDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [callType, setCallType] = useState("phone");

  const handleSummarize = () => {
    summarize.mutate(
      { client_id: clientId, transcript: transcript.trim(), call_date: callDate, call_type: callType },
      {
        onSuccess: () => {
          setTranscript("");
          toast.success("Nadia summarized the call — review the notes below");
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Could not summarize that call"),
      },
    );
  };

  const handleDelete = (id: string) => {
    deleteNote.mutate(id, {
      onSuccess: () => toast.success("Call note deleted"),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Could not delete that note"),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Call Notes
          <Badge variant="secondary" className="font-normal">Nadia</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="call-date">Call date</Label>
              <Input
                id="call-date"
                type="date"
                value={callDate}
                onChange={(e) => setCallDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="call-type">Call type</Label>
              <Select value={callType} onValueChange={setCallType}>
                <SelectTrigger id="call-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transcript">Transcript or rough notes</Label>
            <Textarea
              id="transcript"
              rows={6}
              placeholder="Paste the call transcript or your rough notes here. Nadia only uses what you paste — she never invents details."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
          </div>

          <Button
            onClick={handleSummarize}
            disabled={summarize.isPending || transcript.trim().length < 40}
          >
            {summarize.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {summarize.isPending ? "Nadia is writing…" : "Summarize with Nadia"}
          </Button>
        </div>

        <Separator />

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">
            No call notes yet. Paste a transcript above to create the first one.
          </p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}