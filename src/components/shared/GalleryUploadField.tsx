import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Plus, X } from "lucide-react";
import { ImageUploadField } from "@/components/shared/ImageUploadField";

interface Props {
  label?: string;
  value: string[];
  onChange: (urls: string[]) => void;
  hint?: string;
}

/** Manage an ordered list of additional images for an itinerary item. */
export function GalleryUploadField({ label = "Gallery", value, onChange, hint }: Props) {
  const urls = Array.isArray(value) ? value : [];

  const update = (i: number, url: string) => {
    const next = [...urls];
    next[i] = url;
    onChange(next.filter((u) => u && u.trim()));
  };
  const remove = (i: number) => onChange(urls.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= urls.length) return;
    const next = [...urls];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">{label}</Label>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>

      {urls.length > 0 && (
        <div className="space-y-3">
          {urls.map((url, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md border p-2">
              <div className="flex-1 min-w-0">
                <ImageUploadField
                  label={`Photo ${i + 1}`}
                  value={url}
                  onChange={(u) => update(i, u)}
                  compact
                />
              </div>
              <div className="flex flex-col gap-1 pt-1">
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowLeft className="h-3 w-3 rotate-90" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(i, 1)} disabled={i === urls.length - 1}>
                  <ArrowRight className="h-3 w-3 rotate-90" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => remove(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...urls, ""])}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add photo
      </Button>
    </div>
  );
}
