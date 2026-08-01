import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { IntakeField, IntakeForm, IntakeFormResponse } from "@/lib/intakeForms";

// intake_forms / intake_form_responses are newer than the generated types.
const db = supabase as unknown as {
  from: (table: string) => any;
};

export function useIntakeForms() {
  return useQuery({
    queryKey: ["intake-forms"],
    queryFn: async (): Promise<IntakeForm[]> => {
      const { data, error } = await db
        .from("intake_forms")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as IntakeForm[];
    },
  });
}

export function usePublicIntakeForm(slug?: string) {
  return useQuery({
    queryKey: ["intake-form-public", slug],
    enabled: !!slug,
    queryFn: async (): Promise<IntakeForm | null> => {
      const { data, error } = await db
        .from("intake_forms")
        .select("id,title,description,slug,fields,is_active,thank_you_message")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as IntakeForm | null;
    },
  });
}

export function useFormResponses(formId?: string) {
  return useQuery({
    queryKey: ["intake-form-responses", formId],
    enabled: !!formId,
    queryFn: async (): Promise<IntakeFormResponse[]> => {
      const { data, error } = await db
        .from("intake_form_responses")
        .select("*")
        .eq("form_id", formId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as IntakeFormResponse[];
    },
  });
}

export function useSaveIntakeForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id?: string;
      title: string;
      description?: string | null;
      slug: string;
      fields: IntakeField[];
      is_active: boolean;
      thank_you_message?: string | null;
    }) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await db.from("intake_forms").update(rest).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await db
        .from("intake_forms")
        .insert({ ...payload, user_id: userData.user?.id })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intake-forms"] }),
  });
}

export function useDeleteIntakeForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("intake_forms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intake-forms"] }),
  });
}

export function useSubmitIntakeForm() {
  return useMutation({
    mutationFn: async (payload: {
      form_id: string;
      submitter_name?: string | null;
      submitter_email?: string | null;
      answers: Record<string, unknown>;
    }) => {
      const { error } = await db.from("intake_form_responses").insert(payload);
      if (error) throw error;
    },
  });
}

export async function uploadFormFile(formId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "dat";
  const path = `${formId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("form-uploads").upload(path, file);
  if (error) throw error;
  return path;
}