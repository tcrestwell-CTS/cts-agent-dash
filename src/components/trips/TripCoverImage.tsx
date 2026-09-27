import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { validateHeroImage } from "@/lib/heroImageQuality";
import { UnsplashPicker } from "./UnsplashPicker";

interface TripCoverImageProps {
  tripId: string;
  coverImageUrl: string | null;
  onUpdated: () => void;
}

export function TripCoverImage({ tripId, coverImageUrl, onUpdated }: TripCoverImageProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [unsplashOpen, setUnsplashOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    const validation = await validateHeroImage(file);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }
    if (validation.warning) toast.warning(validation.warning);

    setUploading(true);
    try {
      const ext = file.name?.split(".").pop() || (file.type === "image/png" ? "png" : "jpg");
      const path = `${tripId}/cover.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("trip-covers")
        .upload(path, file, { upsert: true, cacheControl: "31536000" });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("trip-covers")
        .getPublicUrl(path);

      const { error: updateError } = await supabase
        .from("trips")
        .update({ cover_image_url: publicUrl } as any)
        .eq("id", tripId);

      if (updateError) throw updateError;

      toast.success("Cover image updated");
      onUpdated();
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) uploadFile(file);
        return;
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      const { error } = await supabase
        .from("trips")
        .update({ cover_image_url: null } as any)
        .eq("id", tripId);

      if (error) throw error;
      toast.success("Cover image removed");
      onUpdated();
    } catch {
      toast.error("Failed to remove image");
    } finally {
      setUploading(false);
    }
  };

  const handleUnsplashSelect = async (imageUrl: string) => {
    setUploading(true);
    try {
      const { error } = await supabase
        .from("trips")
        .update({ cover_image_url: imageUrl } as any)
        .eq("id", tripId);

      if (error) throw error;
      toast.success("Cover image updated");
      onUpdated();
    } catch {
      toast.error("Failed to set cover image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="relative group outline-none"
      tabIndex={0}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
    >
      {coverImageUrl ? (
        <div className={`relative w-full h-48 rounded-lg overflow-hidden border ${dragOver ? "ring-2 ring-primary" : ""}`}>
          <img
            src={coverImageUrl}
            alt="Trip cover"
            className="w-full h-full object-contain"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-1" />}
              Change
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setUnsplashOpen(true)}
              disabled={uploading}
            >
              <Search className="h-4 w-4 mr-1" /> Search photos
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRemove}
              disabled={uploading}
            >
              <X className="h-4 w-4 mr-1" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className={`w-full rounded-lg border-2 border-dashed transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"}`}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full h-36 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <ImagePlus className="h-6 w-6" />
                <span className="text-sm font-medium">Add Cover Image</span>
                <span className="text-xs">Landscape, 1600 × 900 pixels or larger</span>
              </>
            )}
          </button>
          <div className="flex items-center justify-center gap-2 pb-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <ImagePlus className="h-3.5 w-3.5" /> Upload
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => setUnsplashOpen(true)}
              disabled={uploading}
            >
              <Search className="h-3.5 w-3.5" /> Search photos online
            </Button>
          </div>
        </div>
      )}
      <UnsplashPicker
        open={unsplashOpen}
        onOpenChange={setUnsplashOpen}
        onSelect={handleUnsplashSelect}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
