import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MarketingImageAsset {
  id: string;
  user_id: string;
  storage_path: string;
  public_url: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  tags: string[];
  is_shared?: boolean;
  created_at: string;
}

const BUCKET = "email-assets";

function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) return resolve(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export function useImageAssets() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["marketing-image-assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_image_assets" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as MarketingImageAsset[];
    },
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const uploaded: MarketingImageAsset[] = [];
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const dims = await getImageDimensions(file);
        const row = {
          user_id: user.id,
          storage_path: path,
          public_url: pub.publicUrl,
          filename: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          alt_text: null,
          tags: [] as string[],
        };
        const { data: inserted, error: insErr } = await supabase
          .from("marketing_image_assets" as any)
          .insert(row as any)
          .select()
          .single();
        if (insErr) throw insErr;
        uploaded.push(inserted as unknown as MarketingImageAsset);
      }
      return uploaded;
    },
    onSuccess: (rows) => {
      qc.invalidateQueries({ queryKey: ["marketing-image-assets"] });
      toast.success(`Uploaded ${rows.length} image${rows.length === 1 ? "" : "s"}`);
    },
    onError: (e: Error) => toast.error(`Upload failed: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (asset: MarketingImageAsset) => {
      const { error: sErr } = await supabase.storage
        .from(BUCKET)
        .remove([asset.storage_path]);
      if (sErr) throw sErr;
      const { error } = await supabase
        .from("marketing_image_assets" as any)
        .delete()
        .eq("id", asset.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-image-assets"] });
      toast.success("Image deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateAlt = useMutation({
    mutationFn: async ({ id, alt_text }: { id: string; alt_text: string }) => {
      const { error } = await supabase
        .from("marketing_image_assets" as any)
        .update({ alt_text } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-image-assets"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const setShared = useMutation({
    mutationFn: async ({ id, is_shared }: { id: string; is_shared: boolean }) => {
      const { error } = await supabase
        .from("marketing_image_assets" as any)
        .update({ is_shared } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["marketing-image-assets"] });
      toast.success(vars.is_shared ? "Shared with the team" : "Removed from shared library");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, upload, remove, updateAlt, setShared };
}