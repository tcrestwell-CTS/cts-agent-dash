import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Supplier {
  id: string;
  user_id: string;
  name: string;
  supplier_type: string;
  commissionable_percentage: number;
  commission_rate: number;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSupplierData {
  name: string;
  supplier_type: string;
  commissionable_percentage: number;
  commission_rate: number;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  notes?: string;
}

export interface UpdateSupplierData extends Partial<CreateSupplierData> {
  is_active?: boolean;
}

export function useSuppliers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading, refetch } = useQuery({
    queryKey: ["suppliers", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!user,
  });

  const createSupplier = useMutation({
    mutationFn: async (data: CreateSupplierData) => {
      if (!user) throw new Error("Not authenticated");

      const { data: newSupplier, error } = await supabase
        .from("suppliers")
        .insert({
          user_id: user.id,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      return newSupplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier created successfully");
    },
    onError: (error) => {
      console.error("Error creating supplier:", error);
      toast.error("Failed to create supplier");
    },
  });

  const updateSupplier = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSupplierData }) => {
      const { data: updated, error } = await supabase
        .from("suppliers")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier updated successfully");
    },
    onError: (error) => {
      console.error("Error updating supplier:", error);
      toast.error("Failed to update supplier");
    },
  });

  const deleteSupplier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting supplier:", error);
      toast.error("Failed to delete supplier");
    },
  });

  // Get active suppliers only
  const activeSuppliers = suppliers.filter((s) => s.is_active);

  return {
    suppliers,
    activeSuppliers,
    isLoading,
    refetch,
    createSupplier,
    updateSupplier,
    deleteSupplier,
  };
}

// Helper function to calculate commission values based on supplier
export function calculateBookingFinancials(
  grossSales: number,
  supplier?: Supplier | null
) {
  // Default values if no supplier
  const commissionablePercentage = supplier?.commissionable_percentage ?? 85;
  const commissionRate = supplier?.commission_rate ?? 10;

  const commissionableAmount = grossSales * (commissionablePercentage / 100);
  const commissionRevenue = commissionableAmount * (commissionRate / 100);
  const netSales = grossSales - commissionRevenue;
  const supplierPayout = netSales; // Could factor in platform fees in the future

  return {
    grossSales,
    commissionableAmount,
    commissionRevenue,
    netSales,
    supplierPayout,
    commissionablePercentage,
    commissionRate,
  };
}
