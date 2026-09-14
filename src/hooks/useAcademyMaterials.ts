import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type MaterialStatus = "uploaded" | "processing" | "ready" | "published" | "failed";

export interface AcademyMaterial {
  id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  lesson_ids: string[];
  extracted_text: string | null;
  status: MaterialStatus;
  error_message: string | null;
  created_at: string;
  academy_material_lesson_drafts: Array<{
    id: string;
    lesson_id: string;
    generated_draft: string | null;
    status: MaterialStatus | "assigned";
    error_message: string | null;
  }>;
}

export function useAcademyMaterials() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["academy-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academy_source_materials")
        .select("*, academy_material_lesson_drafts(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AcademyMaterial[];
    },
    enabled: !!user,
  });
}

export function useUploadAcademyMaterial() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, text, lessonIds }: { file: File; text: string; lessonIds: string[] }) => {
      if (!user) throw new Error("You must be signed in.");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("academy-materials").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: material, error } = await supabase
        .from("academy_source_materials")
        .insert({
          file_name: file.name,
          storage_path: path,
          mime_type: file.type || "application/octet-stream",
          file_size: file.size,
          lesson_ids: lessonIds,
          extracted_text: text,
          uploaded_by: user.id,
        })
        .select("id")
        .single();
      if (error) {
        await supabase.storage.from("academy-materials").remove([path]);
        throw error;
      }

      const { error: draftError } = await supabase.from("academy_material_lesson_drafts").insert(
        lessonIds.map((lessonId) => ({ material_id: material.id, lesson_id: lessonId })),
      );
      if (draftError) throw draftError;
      return material.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["academy-materials"] }),
  });
}

export function useGenerateAcademyDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ materialId, lessonId }: { materialId: string; lessonId: string }) => {
      const { data, error } = await supabase.functions.invoke("generate-academy-lesson", {
        body: { material_id: materialId, lesson_id: lessonId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { draft: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["academy-materials"] }),
  });
}

export function useSaveAcademyDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ draftId, generatedDraft }: { draftId: string; generatedDraft: string }) => {
      const { error } = await supabase
        .from("academy_material_lesson_drafts")
        .update({ generated_draft: generatedDraft, status: "ready", error_message: null })
        .eq("id", draftId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["academy-materials"] }),
  });
}

export function usePublishAcademyDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ draftId, lessonId, materialId, content, sourceName }: {
      draftId: string; lessonId: string; materialId: string; content: string; sourceName: string;
    }) => {
      const now = new Date().toISOString();
      const { error: lessonError } = await supabase.from("training_lessons").update({
        content_body: content,
        content_source_name: sourceName,
        content_source_updated_at: now,
      }).eq("id", lessonId);
      if (lessonError) throw lessonError;
      const { error: draftError } = await supabase.from("academy_material_lesson_drafts")
        .update({ generated_draft: content, status: "published", error_message: null }).eq("id", draftId);
      if (draftError) throw draftError;
      const { error: materialError } = await supabase.from("academy_source_materials")
        .update({ status: "published", published_lesson_id: lessonId }).eq("id", materialId);
      if (materialError) throw materialError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academy-materials"] });
      qc.invalidateQueries({ queryKey: ["academy-lessons"] });
    },
  });
}