import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, Map, Backpack, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, Globe, Banknote, Cloud, AlertTriangle, Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  tripId: string;
  destination: string | null;
  departDate: string | null;
  returnDate: string | null;
  tripName: string;
  activityTypes?: string[];    // e.g. ["beach", "hiking", "snorkeling"]
}

interface DestinationGuide {
  destination: string;
  overview: string;
  weather: string;
  currency: string;
  language: string;
  timezone: string;
  visa: string;
  tips: string[];
  emergency: string;
}

interface PackingCategory {
  category: string;
  icon: string;
  items: string[];
}

// ── Destination Guide ──────────────────────────────────────────────────────────
function DestinationGuideSection({
  destination, guide, loading, onGenerate,
}: {
  destination: string | null;
  guide: DestinationGuide | null;
  loading: boolean;
  onGenerate: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Destination Guide
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="sm"
              className="h-7 text-xs gap-1"
              onClick={onGenerate}
              disabled={loading || !destination}
            >
              {loading
                ? <><RefreshCw className="h-3 w-3 animate-spin" /> Generating…</>
                : <><Sparkles className="h-3 w-3" /> {guide ? "Refresh" : "Generate"}</>}
            </Button>
            {guide && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(v => !v)}>
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {loading && (
        <CardContent className="space-y-2 pt-0">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </CardContent>
      )}

      {guide && expanded && !loading && (
        <CardContent className="pt-0 space-y-3 text-sm">
          <p className="text-muted-foreground">{guide.overview}</p>

          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: Cloud, label: "Weather", value: guide.weather },
              { icon: Banknote, label: "Currency", value: guide.currency },
              { icon: Globe, label: "Language", value: guide.language },
              { icon: Info, label: "Timezone", value: guide.timezone },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-md bg-muted/50 p-2">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                  <Icon className="h-3 w-3" />{label}
                </div>
                <p className="text-xs font-medium">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2">
            <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">
              <AlertTriangle className="h-3 w-3" />Visa / Entry
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-300">{guide.visa}</p>
          </div>

          {guide.tips.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Local Tips</p>
              <ul className="space-y-1">
                {guide.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs">
                    <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0 mt-0.5" />{tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {guide.emergency && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2 text-xs text-red-700 dark:text-red-300">
              <span className="font-semibold">Emergency:</span> {guide.emergency}
            </div>
          )}
        </CardContent>
      )}

      {!guide && !loading && (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">
            {destination
              ? `Click Generate to create an AI guide for ${destination}.`
              : "Set a destination on this trip to generate a guide."}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

// ── Packing List ────────────────────────────────────────────────────────────────
function PackingListSection({
  packingList, loading, onGenerate, tripName,
}: {
  packingList: PackingCategory[] | null;
  loading: boolean;
  onGenerate: () => void;
  tripName: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const totalItems = (packingList || []).reduce((s, c) => s + c.items.length, 0);
  const packedCount = checked.size;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Backpack className="h-4 w-4 text-primary" />
            Packing List
            {packingList && (
              <Badge variant="outline" className="text-[10px] ml-1">
                {packedCount}/{totalItems}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="sm"
              className="h-7 text-xs gap-1"
              onClick={onGenerate}
              disabled={loading}
            >
              {loading
                ? <><RefreshCw className="h-3 w-3 animate-spin" /> Generating…</>
                : <><Sparkles className="h-3 w-3" /> {packingList ? "Refresh" : "Generate"}</>}
            </Button>
            {packingList && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(v => !v)}>
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </div>
        {packingList && totalItems > 0 && (
          <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.round((packedCount / totalItems) * 100)}%` }}
            />
          </div>
        )}
      </CardHeader>

      {loading && (
        <CardContent className="space-y-2 pt-0">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </CardContent>
      )}

      {packingList && expanded && !loading && (
        <CardContent className="pt-0 space-y-3">
          {packingList.map((cat) => (
            <div key={cat.category}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-1.5">
                <span>{cat.icon}</span>{cat.category}
              </p>
              <ul className="space-y-1">
                {cat.items.map((item) => {
                  const key = `${cat.category}:${item}`;
                  const done = checked.has(key);
                  return (
                    <li
                      key={key}
                      className="flex items-center gap-2 cursor-pointer group"
                      onClick={() => toggle(key)}
                    >
                      <div className={`h-3.5 w-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${done ? "bg-primary border-primary" : "border-muted-foreground/40 group-hover:border-primary"}`}>
                        {done && <CheckCircle2 className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <span className={`text-xs ${done ? "line-through text-muted-foreground" : ""}`}>{item}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </CardContent>
      )}

      {!packingList && !loading && (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">
            AI will generate a packing list based on {tripName}'s destination, duration, and activity types.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────────
export function AITripAssistantPanel({ tripId, destination, departDate, returnDate, tripName, activityTypes }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [guideLoading, setGuideLoading] = useState(false);
  const [packingLoading, setPackingLoading] = useState(false);
  const [guide, setGuide] = useState<DestinationGuide | null>(null);
  const [packingList, setPackingList] = useState<PackingCategory[] | null>(null);

  async function saveHtmlToTripDocuments(opts: {
    label: string;
    description: string;
    fileName: string;
    html: string;
  }) {
    if (!user) return;
    try {
      const blob = new Blob([opts.html], { type: "text/html" });
      const safeName = opts.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `agent-docs/${user.id}/${tripId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("client-documents")
        .upload(path, blob, { upsert: false, contentType: "text/html" });
      if (upErr) throw upErr;

      const { error: insErr } = await (supabase as any)
        .from("client_document_uploads")
        .insert({
          trip_id: tripId,
          uploaded_by: user.id,
          doc_key: "ai_generated",
          label: opts.label,
          description: opts.description,
          file_name: safeName,
          file_size: blob.size,
          mime_type: "text/html",
          storage_path: path,
        });
      if (insErr) throw insErr;
      qc.invalidateQueries({ queryKey: ["trip-agent-docs", tripId] });
      toast.success(`Saved "${opts.label}" to Trip Documents`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Could not save to Trip Documents");
    }
  }

  function guideToHtml(g: DestinationGuide): string {
    const esc = (s: string) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(g.destination)} — Destination Guide</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#1f2937;line-height:1.55}
h1{margin-bottom:.25rem}h2{margin-top:1.75rem;border-bottom:1px solid #e5e7eb;padding-bottom:.25rem}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin:1rem 0}
.box{border:1px solid #e5e7eb;border-radius:8px;padding:.75rem;background:#f9fafb}
.label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:.25rem}
.warn{background:#fffbeb;border-color:#fde68a}.danger{background:#fef2f2;border-color:#fecaca;color:#991b1b}
ul{padding-left:1.2rem}</style></head><body>
<h1>${esc(g.destination)}</h1><p>${esc(g.overview)}</p>
<div class="grid">
<div class="box"><div class="label">Weather</div>${esc(g.weather)}</div>
<div class="box"><div class="label">Currency</div>${esc(g.currency)}</div>
<div class="box"><div class="label">Language</div>${esc(g.language)}</div>
<div class="box"><div class="label">Timezone</div>${esc(g.timezone)}</div>
</div>
<div class="box warn"><div class="label">Visa / Entry</div>${esc(g.visa)}</div>
<h2>Local Tips</h2><ul>${(g.tips || []).map(t => `<li>${esc(t)}</li>`).join("")}</ul>
${g.emergency ? `<div class="box danger"><strong>Emergency:</strong> ${esc(g.emergency)}</div>` : ""}
<p style="margin-top:2rem;font-size:11px;color:#9ca3af">Generated by AI Trip Assistant</p>
</body></html>`;
  }

  function packingToHtml(list: PackingCategory[]): string {
    const esc = (s: string) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(tripName)} — Packing List</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#1f2937;line-height:1.55}
h1{margin-bottom:1rem}h2{margin-top:1.5rem}ul{padding-left:1.2rem}li{margin:.2rem 0}</style></head><body>
<h1>Packing List — ${esc(tripName)}</h1>
${list.map(c => `<h2>${esc(c.icon || "")} ${esc(c.category)}</h2><ul>${c.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`).join("")}
<p style="margin-top:2rem;font-size:11px;color:#9ca3af">Generated by AI Trip Assistant</p>
</body></html>`;
  }

  const generateGuide = async () => {
    if (!destination) return;
    setGuideLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-trip-assistant", {
        body: { type: "destination_guide", destination, tripId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGuide(data.guide);
      if (data.guide) {
        await saveHtmlToTripDocuments({
          label: `Destination Guide — ${data.guide.destination || destination}`,
          description: "AI-generated destination guide for the client.",
          fileName: `destination-guide-${destination}.html`,
          html: guideToHtml(data.guide),
        });
      }
    } catch (err: any) {
      // Fallback: call openai directly via a simple fetch if edge fn not deployed
      try {
        const prompt = `You are a travel advisor. Generate a concise destination guide for "${destination}" for US travelers. Return ONLY valid JSON matching this schema exactly:
{
  "destination": string,
  "overview": string (2-3 sentences),
  "weather": string (one line),
  "currency": string (name + symbol),
  "language": string,
  "timezone": string,
  "visa": string (entry requirements for US citizens, one line),
  "tips": string[] (4-5 practical local tips),
  "emergency": string (local emergency numbers)
}`;

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          }),
        });
        const json = await res.json();
        const parsed = JSON.parse(json.choices[0].message.content);
        setGuide(parsed.guide || parsed);
      } catch {
        toast.error("Could not generate destination guide. Check edge function deployment.");
      }
    } finally {
      setGuideLoading(false);
    }
  };

  const generatePackingList = async () => {
    setPackingLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-trip-assistant", {
        body: {
          type: "packing_list",
          destination,
          departDate,
          returnDate,
          tripId,
          activityTypes: activityTypes || [],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPackingList(data.packingList);
      if (Array.isArray(data.packingList) && data.packingList.length) {
        await saveHtmlToTripDocuments({
          label: `Packing List — ${tripName}`,
          description: "AI-generated packing list for the client.",
          fileName: `packing-list-${tripName || "trip"}.html`,
          html: packingToHtml(data.packingList),
        });
      }
    } catch {
      // Fallback prompt
      try {
        const nights = departDate && returnDate
          ? Math.max(1, Math.round((new Date(returnDate).getTime() - new Date(departDate).getTime()) / 86400000))
          : 7;
        const prompt = `Generate a packing list for a ${nights}-night trip to ${destination || "an international destination"}${activityTypes?.length ? ` with activities: ${activityTypes.join(", ")}` : ""}. Return ONLY valid JSON:
{
  "packingList": [
    { "category": string, "icon": string (emoji), "items": string[] }
  ]
}
Include categories: Documents, Clothing, Toiletries, Electronics, Health & Safety, and relevant activity-specific gear.`;

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          }),
        });
        const json = await res.json();
        const parsed = JSON.parse(json.choices[0].message.content);
        setPackingList(parsed.packingList || parsed);
      } catch {
        toast.error("Could not generate packing list. Check edge function deployment.");
      }
    } finally {
      setPackingLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">AI Trip Assistant</span>
        <Badge variant="outline" className="text-[10px]">Beta</Badge>
      </div>

      <DestinationGuideSection
        destination={destination}
        guide={guide}
        loading={guideLoading}
        onGenerate={generateGuide}
      />

      <PackingListSection
        packingList={packingList}
        loading={packingLoading}
        onGenerate={generatePackingList}
        tripName={tripName}
      />
    </div>
  );
}
