import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TripCoverImageProps {
  tripId: string;
  coverImageUrl: string | null;
  onUpdated: () => void;
}

export function TripCoverImage({ tripId, coverImageUrl, onUpdated }: TripCoverImageProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${tripId}/cover.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("trip-covers")
        .upload(path, file, { upsert: true });

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

  return (
    <div className="relative group">
      {coverImageUrl ? (
        <div className="relative w-full h-48 rounded-lg overflow-hidden border">
          <img
            src={coverImageUrl}
            alt="Trip cover"
            className="w-full h-full object-cover"
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
              variant="destructive"
              onClick={handleRemove}
              disabled={uploading}
            >
              <X className="h-4 w-4 mr-1" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full h-36 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-6 w-6" />
              <span className="text-sm font-medium">Add Cover Image</span>
              <span className="text-xs">Displays on the shared trip page</span>
            </>
          )}
        </button>
      )}
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
