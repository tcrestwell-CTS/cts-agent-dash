import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface BusinessContact {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  industry: string | null;
  website: string | null;
  linkedin_url: string | null;
  revenue_size: string | null;
  employee_count: string | null;
  lead_source: string | null;
  lead_status: string;
  notes: string | null;
  follow_up_date: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

export type BusinessContactInsert = Omit<BusinessContact, "id" | "created_at" | "updated_at">;

export function useBusinessContacts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["business-contacts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_contacts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BusinessContact[];
    },
    enabled: !!user,
  });

  const addContact = useMutation({
    mutationFn: async (contact: Partial<BusinessContactInsert>) => {
      const { error } = await supabase.from("business_contacts").insert({
        ...contact,
        user_id: user!.id,
        company_name: contact.company_name || "Unknown",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-contacts"] });
      toast.success("Business contact added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BusinessContact> & { id: string }) => {
      const { error } = await supabase.from("business_contacts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-contacts"] });
      toast.success("Contact updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("business_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-contacts"] });
      toast.success("Contact deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkImport = useMutation({
    mutationFn: async (contacts: Partial<BusinessContactInsert>[]) => {
      const rows = contacts.map((c) => ({
        ...c,
        user_id: user!.id,
        company_name: c.company_name || "Unknown",
        lead_status: c.lead_status || "new",
      }));
      const { error } = await supabase.from("business_contacts").insert(rows);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["business-contacts"] });
      toast.success(`${variables.length} contacts imported`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, addContact, updateContact, deleteContact, bulkImport };
}
