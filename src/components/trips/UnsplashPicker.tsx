import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UnsplashPhoto {
  id: string;
  thumb: string;
  full: string;
  photographer: string;
  photographerUrl: string;
  alt: string;
}

interface UnsplashPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (imageUrl: string) => void;
  defaultQuery?: string;
}

export function UnsplashPicker({ open, onOpenChange, onSelect, defaultQuery }: UnsplashPickerProps) {
  const [query, setQuery] = useState(defaultQuery || "");
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("unsplash-search", {
        body: { query: query.trim() },
      });
      if (error) {
        const details = (error as any)?.context ? await (error as any).context.text() : error.message;
        console.error("unsplash-search failed:", details);
        toast.error(details?.includes("not configured")
          ? "Photo search isn't set up yet — the Unsplash key still needs to be added."
          : "Photo search failed. Please try again.");
        return;
      }
      setPhotos(data.photos || []);
      setSearched(true);
    } catch (err) {
      console.error("unsplash-search error:", err);
      toast.error("Photo search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Search photos online</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            placeholder="Search for a destination, ship, beach..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            autoFocus
          />
          <Button onClick={search} disabled={searching || !query.trim()}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {searching ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : photos.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 max-h-[420px] overflow-y-auto">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => {
                  onSelect(photo.full);
                  onOpenChange(false);
                }}
                className="relative rounded-md overflow-hidden border hover:ring-2 hover:ring-primary transition-all aspect-video group"
                title={`Photo by ${photo.photographer} on Unsplash`}
              >
                <img src={photo.thumb} alt={photo.alt} className="w-full h-full object-cover" loading="lazy" />
                <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] px-1.5 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                  {photo.photographer}
                </span>
              </button>
            ))}
          </div>
        ) : searched ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No photos found for "{query}". Try a different search.
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Search Unsplash's free photo library for a cover image.
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center">
          Photos provided by{" "}
          <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline">
            Unsplash
          </a>
        </p>
      </DialogContent>
    </Dialog>
  );
}
