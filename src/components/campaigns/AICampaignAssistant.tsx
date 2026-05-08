import { useState } from "react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGenerateCampaignCopy } from "@/hooks/useCampaigns";
import { toast } from "sonner";

interface Props {
  onApplySubject: (s: string) => void;
  onApplyBody: (html: string) => void;
}

export function AICampaignAssistant({ onApplySubject, onApplyBody }: Props) {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Luxury");
  const [cta, setCta] = useState("");
  const [audience, setAudience] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const generate = useGenerateCampaignCopy();

  const runSubjects = async () => {
    const res = await generate.mutateAsync({ mode: "subjects", topic, tone, cta, audience });
    setSubjects(res.subjects ?? []);
    if (!res.subjects?.length) toast.warning("No subjects generated");
  };

  const runBody = async () => {
    const res = await generate.mutateAsync({ mode: "body", topic, tone, cta, audience });
    if (res.html) {
      onApplyBody(res.html);
      toast.success("Body applied");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Campaign topic / goal</Label>
          <Textarea
            rows={3}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. 2026 Mediterranean cruise sale, group cabin pricing through Aug 31"
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Luxury">Luxury</SelectItem>
                <SelectItem value="Friendly">Friendly</SelectItem>
                <SelectItem value="Urgent">Urgent</SelectItem>
                <SelectItem value="Informative">Informative</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Audience</Label>
            <Input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="past cruise clients"
              className="mt-1 h-9"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Call-to-action</Label>
          <Input
            value={cta}
            onChange={(e) => setCta(e.target.value)}
            placeholder="Reply to reserve your suite"
            className="mt-1 h-9"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={runSubjects}
            disabled={generate.isPending}
          >
            {generate.isPending && generate.variables?.mode === "subjects" ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Wand2 className="h-3 w-3 mr-1" />
            )}
            Subjects
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={runBody}
            disabled={generate.isPending}
          >
            {generate.isPending && generate.variables?.mode === "body" ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1" />
            )}
            Generate body
          </Button>
        </div>

        {subjects.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t">
            <Label className="text-xs text-muted-foreground">Click a subject to apply</Label>
            {subjects.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onApplySubject(s);
                  toast.success("Subject applied");
                }}
                className="w-full text-left text-sm p-2 rounded border hover:bg-accent transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}