import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

interface StorefrontLogoUploadProps {
  /** auth user id — must be the first folder in the storage path for RLS */
  userId?: string | null;
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  compact?: boolean;
  /** file name (without extension) stored under the user's folder */
  fileBase?: string;
  /** preview shape — circle for profile photos, square for logos */
  shape?: "square" | "circle";
  /** how the preview image fills its frame */
  fit?: "contain" | "cover";
  /** noun used in buttons, toasts and helper copy */
  noun?: string;
}

/**
 * Uploads an agent logo to the public `logos` bucket and returns a full
 * absolute public URL (https://.../storage/v1/object/public/logos/...)
 * so it renders on storefronts, emails and any external surface.
 */
export const StorefrontLogoUpload = ({
  userId,
  value,
  onChange,
  label = "Storefront Logo",
  compact = false,
  fileBase = "storefront-logo",
  shape = "square",
  fit = "contain",
  noun = "logo",
}: StorefrontLogoUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!userId) {
      toast.error(`Missing agent account — cannot upload ${noun}`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(`${noun.charAt(0).toUpperCase()}${noun.slice(1)} must be under 5MB`);
      return;
    }

    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${userId}/${fileBase}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        console.error("Image upload failed:", uploadError);
        toast.error(uploadError.message || `Failed to upload ${noun}`);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("logos").getPublicUrl(path);

      onChange(`${publicUrl}?v=${Date.now()}`);
      toast.success(`${noun.charAt(0).toUpperCase()}${noun.slice(1)} uploaded`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {!compact && <Label>{label}</Label>}
      <div className="flex items-center gap-3">
        <div
          className={`h-16 w-16 shrink-0 border border-border bg-muted/30 flex items-center justify-center overflow-hidden ${
            shape === "circle" ? "rounded-full" : "rounded-md"
          }`}
        >
          {value ? (
            <img
              src={value}
              alt={`Agent ${noun}`}
              className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`}
            />
          ) : (
            <span className="text-[10px] text-muted-foreground text-center px-1">No {noun}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {value ? `Replace ${noun}` : `Upload ${noun}`}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <X className="h-4 w-4 mr-1" /> Remove
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
      {!compact && (
        <p className="text-xs text-muted-foreground break-all">
          {value
            ? value.split("?")[0]
            : "PNG, JPG, WEBP or SVG up to 5MB. Stored at a full public URL so it displays anywhere."}
        </p>
      )}
    </div>
  );
};