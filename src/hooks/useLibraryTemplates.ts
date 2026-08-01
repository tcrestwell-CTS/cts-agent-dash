import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LibraryTemplateKind = "itinerary" | "proposal" | "email" | "packing" | "checklist";

export interface LibraryTemplate {
  id: string;
  kind: LibraryTemplateKind;
  name: string;
  description: string | null;
  destination: string | null;
  trip_type: string | null;
  duration_days: number | null;
  content: string | null;
  template_data: Record<string, unknown>;
  tags: string[];
  is_shared: boolean;
  is_archived: boolean;
  usage_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type LibraryTemplateInput = Partial<
  Pick<
    LibraryTemplate,
    "kind" | "name" | "description" | "destination" | "trip_type" | "duration_days" | "content" | "tags" | "is_shared"
  >
>;

const KEY = ["library-templates"];

export function useLibraryTemplates(kind?: LibraryTemplateKind) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [...KEY, kind ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("library_templates" as any)
        .select("*")
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });
      if (kind) q = q.eq("kind", kind);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as LibraryTemplate[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: async (input: LibraryTemplateInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("library_templates" as any)
        .insert({ ...input, created_by: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as LibraryTemplate;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Template saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: LibraryTemplateInput & { id: string }) => {
      const { error } = await supabase
        .from("library_templates" as any)
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Template updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("library_templates" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Template deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markUsed = useMutation({
    mutationFn: async (tpl: LibraryTemplate) => {
      const { error } = await supabase
        .from("library_templates" as any)
        .update({ usage_count: (tpl.usage_count ?? 0) + 1 } as any)
        .eq("id", tpl.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, create, update, remove, markUsed };
}