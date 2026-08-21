import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUp, Loader2, ArrowLeft, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ParsedDocItem {
  day_number: number;
  title: string;
  category: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  flight_number: string | null;
  departure_city_code: string | null;
  arrival_city_code: string | null;
  item_price: number | null;
  confirmation_number: string | null;
}

interface Props {
  tripId: string;
  departDate: string | null;
  returnDate: string | null;
  totalDays: number;
  onAdd: (data: any) => Promise<boolean>;
  variant?: "button" | "sidebar";
}

/** Extract plain text from a PDF, Word (.docx) or text file in the browser. */
async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfjs: any = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    const pages: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // Rebuild visual lines by grouping text items on the same vertical position.
      // Without this, "Day 1"/"Day 2" headings collapse into one long line and
      // the parser can't tell days apart.
      const lines: { y: number; parts: { x: number; str: string }[] }[] = [];
      for (const item of content.items as any[]) {
        const str = item?.str ?? "";
        if (!str.trim()) continue;
        const x = item.transform?.[4] ?? 0;
        const y = item.transform?.[5] ?? 0;
        const line = lines.find((l) => Math.abs(l.y - y) < 3);
        if (line) line.parts.push({ x, str });
        else lines.push({ y, parts: [{ x, str }] });
      }
      const text = lines
        .sort((a, b) => b.y - a.y)
        .map((l) =>
          l.parts
            .sort((a, b) => a.x - b.x)
            .map((p) => p.str)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim(),
        )
        .filter(Boolean)
        .join("\n");
      pages.push(text);
    }
    return pages.join("\n\n");
  }


  if (name.endsWith(".docx")) {
    const mammoth: any = await import("mammoth/mammoth.browser");
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result?.value ?? "";
  }

  if (name.endsWith(".doc")) {
    throw new Error("Legacy .doc files aren't supported — save as .docx or PDF first.");
  }

  return await file.text();
}

export function ImportItineraryDocDialog({
  tripId, departDate, returnDate, totalDays, onAdd, variant = "button",
}: Props) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [items, setItems] = useState<ParsedDocItem[] | null>(null);
  const [tripTitle, setTripTitle] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [days, setDays] = useState<Record<number, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFileName(null);
    setPastedText("");
    setItems(null);
    setTripTitle(null);
    setSelected({});
    setDays({});
  };

  const runParse = async (text: string, name: string | null) => {
    if (text.trim().length < 40) {
      toast.error("That document didn't contain enough readable text.");
      return;
    }
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-itinerary-document", {
        body: {
          document_text: text,
          file_name: name,
          depart_date: departDate,
          return_date: returnDate,
          total_days: totalDays,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const parsed: ParsedDocItem[] = data?.items ?? [];
      setItems(parsed);
      setTripTitle(data?.trip_title ?? null);
      setSelected(Object.fromEntries(parsed.map((_, i) => [i, true])));
      setDays(Object.fromEntries(parsed.map((item, i) => [i, item.day_number || 1])));
    } catch (err: any) {
      toast.error(err?.message || "Could not read that itinerary.");
    } finally {
      setParsing(false);
    }
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("That file is larger than 15 MB.");
      return;
    }
    setFileName(file.name);
    setParsing(true);
    try {
      const text = await extractText(file);
      setParsing(false);
      await runParse(text, file.name);
    } catch (err: any) {
      setParsing(false);
      toast.error(err?.message || "Could not read that file.");
    }
  };

  const handleImport = async () => {
    if (!items) return;
    const chosen = items.map((item, i) => ({ item, i })).filter(({ i }) => selected[i]);
    if (chosen.length === 0) {
      toast.error("Select at least one item to import.");
      return;
    }
    setImporting(true);
    let added = 0;
    for (const { item, i } of chosen) {
      const ok = await onAdd({
        trip_id: tripId,
        day_number: days[i] ?? item.day_number ?? 1,
        title: item.title,
        category: item.category,
        description: item.description || undefined,
        location: item.location || undefined,
        start_time: item.start_time || undefined,
        end_time: item.end_time || undefined,
        item_date: item.date || undefined,
        flight_number: item.flight_number || undefined,
        departure_city_code: item.departure_city_code || undefined,
        arrival_city_code: item.arrival_city_code || undefined,
        item_price: item.item_price ?? undefined,
        notes: item.confirmation_number ? `Confirmation: ${item.confirmation_number}` : undefined,
      });
      if (ok) added++;
    }
    setImporting(false);
    if (added > 0) {
      toast.success(`Added ${added} itinerary item${added === 1 ? "" : "s"}.`);
      reset();
      setOpen(false);
    } else {
      toast.error("Nothing could be imported.");
    }
  };

  const selectedCount = items ? Object.values(selected).filter(Boolean).length : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {variant === "sidebar" ? (
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <FileUp className="h-4 w-4 mr-2" /> Import from document
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <FileUp className="h-4 w-4 mr-2" /> Import PDF / Doc
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" /> Import itinerary from a document
          </DialogTitle>
        </DialogHeader>

        {!items ? (
          <Tabs defaultValue="file">
            <TabsList>
              <TabsTrigger value="file">Upload file</TabsTrigger>
              <TabsTrigger value="paste">Paste text</TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-4 pt-4">
              <div
                className="rounded-lg border border-dashed border-border p-8 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFile(e.dataTransfer.files?.[0] ?? null);
                }}
              >
                <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop a PDF, Word (.docx) or text itinerary here, or choose a file.
                </p>
                {fileName && <p className="mt-2 text-sm font-medium">{fileName}</p>}
                <Input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md,application/pdf"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  className="mt-4"
                  variant="outline"
                  disabled={parsing}
                  onClick={() => inputRef.current?.click()}
                >
                  {parsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {parsing ? "Reading document…" : "Choose file"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Scanned/image-only PDFs have no extractable text — paste the itinerary text instead.
              </p>
            </TabsContent>

            <TabsContent value="paste" className="space-y-4 pt-4">
              <Label htmlFor="doc-text">Itinerary text</Label>
              <Textarea
                id="doc-text"
                rows={12}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste the day-by-day itinerary text here…"
              />
              <Button
                disabled={parsing || pastedText.trim().length < 40}
                onClick={() => runParse(pastedText, null)}
              >
                {parsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Parse itinerary
              </Button>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Button variant="ghost" size="sm" onClick={reset}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              {tripTitle && <Badge variant="secondary">{tripTitle}</Badge>}
              <span>
                {items.length} item{items.length === 1 ? "" : "s"} across{" "}
                {new Set(items.map((_, i) => days[i] ?? 1)).size} day
                {new Set(items.map((_, i) => days[i] ?? 1)).size === 1 ? "" : "s"} ·{" "}
                {selectedCount} selected
              </span>
            </div>


            <ScrollArea className="h-[400px] pr-3">
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex gap-3 rounded-lg border border-border p-3">
                    <Checkbox
                      checked={!!selected[i]}
                      onCheckedChange={(checked) =>
                        setSelected((prev) => ({ ...prev, [i]: checked === true }))
                      }
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{item.title}</span>
                        <Badge variant="outline" className="capitalize">{item.category}</Badge>
                        {item.date && (
                          <span className="text-xs text-muted-foreground">{item.date}</span>
                        )}
                        {item.start_time && (
                          <span className="text-xs text-muted-foreground">{item.start_time}</span>
                        )}
                      </div>
                      {item.location && (
                        <p className="text-xs text-muted-foreground">{item.location}</p>
                      )}
                      {item.description && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                    <div className="w-24 shrink-0">
                      <Label className="text-[11px] text-muted-foreground">Day</Label>
                      <Input
                        type="number"
                        min={1}
                        max={Math.max(totalDays, 1)}
                        value={days[i] ?? 1}
                        onChange={(e) =>
                          setDays((prev) => ({ ...prev, [i]: Number(e.target.value) || 1 }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleImport} disabled={importing || selectedCount === 0}>
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Add {selectedCount} item{selectedCount === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
