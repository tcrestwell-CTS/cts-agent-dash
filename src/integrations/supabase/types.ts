export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      booking_travelers: {
        Row: {
          booking_id: string
          companion_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          booking_id: string
          companion_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          booking_id?: string
          companion_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_travelers_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_travelers_companion_id_fkey"
            columns: ["companion_id"]
            isOneToOne: false
            referencedRelation: "client_companions"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_reference: string
          calculated_commission: number | null
          client_id: string
          commission_override_amount: number | null
          commission_revenue: number
          commissionable_amount: number
          created_at: string
          depart_date: string
          destination: string
          gross_sales: number
          id: string
          net_sales: number
          notes: string | null
          override_approved: boolean | null
          override_approved_at: string | null
          override_approved_by: string | null
          override_notes: string | null
          override_pending_approval: boolean | null
          owner_agent: string | null
          return_date: string
          status: string
          supplier_id: string | null
          supplier_payout: number
          total_amount: number
          travelers: number
          trip_name: string | null
          trip_page_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_reference: string
          calculated_commission?: number | null
          client_id: string
          commission_override_amount?: number | null
          commission_revenue?: number
          commissionable_amount?: number
          created_at?: string
          depart_date: string
          destination: string
          gross_sales?: number
          id?: string
          net_sales?: number
          notes?: string | null
          override_approved?: boolean | null
          override_approved_at?: string | null
          override_approved_by?: string | null
          override_notes?: string | null
          override_pending_approval?: boolean | null
          owner_agent?: string | null
          return_date: string
          status?: string
          supplier_id?: string | null
          supplier_payout?: number
          total_amount?: number
          travelers?: number
          trip_name?: string | null
          trip_page_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_reference?: string
          calculated_commission?: number | null
          client_id?: string
          commission_override_amount?: number | null
          commission_revenue?: number
          commissionable_amount?: number
          created_at?: string
          depart_date?: string
          destination?: string
          gross_sales?: number
          id?: string
          net_sales?: number
          notes?: string | null
          override_approved?: boolean | null
          override_approved_at?: string | null
          override_approved_by?: string | null
          override_notes?: string | null
          override_pending_approval?: boolean | null
          owner_agent?: string | null
          return_date?: string
          status?: string
          supplier_id?: string | null
          supplier_payout?: number
          total_amount?: number
          travelers?: number
          trip_name?: string | null
          trip_page_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_settings: {
        Row: {
          accent_color: string | null
          address: string | null
          agency_name: string | null
          created_at: string
          email_address: string | null
          facebook: string | null
          from_email: string | null
          from_name: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          phone: string | null
          primary_color: string | null
          tagline: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          agency_name?: string | null
          created_at?: string
          email_address?: string | null
          facebook?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          phone?: string | null
          primary_color?: string | null
          tagline?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          agency_name?: string | null
          created_at?: string
          email_address?: string | null
          facebook?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          phone?: string | null
          primary_color?: string | null
          tagline?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      client_companions: {
        Row: {
          birthday: string | null
          client_id: string
          created_at: string
          email: string | null
          first_name: string
          id: string
          known_traveler_number: string | null
          last_name: string | null
          notes: string | null
          passport_info: string | null
          phone: string | null
          redress_number: string | null
          relationship: string
          updated_at: string
          user_id: string
        }
        Insert: {
          birthday?: string | null
          client_id: string
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          known_traveler_number?: string | null
          last_name?: string | null
          notes?: string | null
          passport_info?: string | null
          phone?: string | null
          redress_number?: string | null
          relationship?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          birthday?: string | null
          client_id?: string
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          known_traveler_number?: string | null
          last_name?: string | null
          notes?: string | null
          passport_info?: string | null
          phone?: string | null
          redress_number?: string | null
          relationship?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_companions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          activities_interests: string | null
          address_city: string | null
          address_country: string | null
          address_line_1: string | null
          address_line_2: string | null
          address_state: string | null
          address_zip_code: string | null
          anniversary: string | null
          birthday: string | null
          created_at: string
          cruise_cabin_floor_preference: string | null
          cruise_cabin_location_preference: string | null
          email: string | null
          first_name: string | null
          flight_bulkhead_preference: string | null
          flight_seating_preference: string | null
          food_drink_allergies: string | null
          id: string
          known_traveler_number: string | null
          last_name: string | null
          location: string | null
          lodging_elevator_preference: string | null
          lodging_floor_preference: string | null
          loyalty_programs: string | null
          name: string
          notes: string | null
          passport_info: string | null
          phone: string | null
          preferred_first_name: string | null
          redress_number: string | null
          secondary_email: string | null
          secondary_phone: string | null
          status: string
          tags: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activities_interests?: string | null
          address_city?: string | null
          address_country?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          address_state?: string | null
          address_zip_code?: string | null
          anniversary?: string | null
          birthday?: string | null
          created_at?: string
          cruise_cabin_floor_preference?: string | null
          cruise_cabin_location_preference?: string | null
          email?: string | null
          first_name?: string | null
          flight_bulkhead_preference?: string | null
          flight_seating_preference?: string | null
          food_drink_allergies?: string | null
          id?: string
          known_traveler_number?: string | null
          last_name?: string | null
          location?: string | null
          lodging_elevator_preference?: string | null
          lodging_floor_preference?: string | null
          loyalty_programs?: string | null
          name: string
          notes?: string | null
          passport_info?: string | null
          phone?: string | null
          preferred_first_name?: string | null
          redress_number?: string | null
          secondary_email?: string | null
          secondary_phone?: string | null
          status?: string
          tags?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activities_interests?: string | null
          address_city?: string | null
          address_country?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          address_state?: string | null
          address_zip_code?: string | null
          anniversary?: string | null
          birthday?: string | null
          created_at?: string
          cruise_cabin_floor_preference?: string | null
          cruise_cabin_location_preference?: string | null
          email?: string | null
          first_name?: string | null
          flight_bulkhead_preference?: string | null
          flight_seating_preference?: string | null
          food_drink_allergies?: string | null
          id?: string
          known_traveler_number?: string | null
          last_name?: string | null
          location?: string | null
          lodging_elevator_preference?: string | null
          lodging_floor_preference?: string | null
          loyalty_programs?: string | null
          name?: string
          notes?: string | null
          passport_info?: string | null
          phone?: string | null
          preferred_first_name?: string | null
          redress_number?: string | null
          secondary_email?: string | null
          secondary_phone?: string | null
          status?: string
          tags?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          id: string
          paid_date: string | null
          rate: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          id?: string
          paid_date?: string | null
          rate: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          id?: string
          paid_date?: string | null
          rate?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          client_id: string
          created_at: string
          id: string
          sent_at: string
          status: string
          subject: string
          template: string
          to_email: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          sent_at?: string
          status?: string
          subject: string
          template: string
          to_email: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          sent_at?: string
          status?: string
          subject?: string
          template?: string
          to_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_details: Json | null
          file_name: string | null
          id: string
          import_type: string
          records_failed: number | null
          records_imported: number | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          file_name?: string | null
          id?: string
          import_type: string
          records_failed?: number | null
          records_imported?: number | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          file_name?: string | null
          id?: string
          import_type?: string
          records_failed?: number | null
          records_imported?: number | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          commission_tier: Database["public"]["Enums"]["commission_tier"]
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          commission_tier?: Database["public"]["Enums"]["commission_tier"]
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          commission_tier?: Database["public"]["Enums"]["commission_tier"]
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          client_messages: boolean
          commission_updates: boolean
          created_at: string
          id: string
          marketing_emails: boolean
          new_booking_alerts: boolean
          training_reminders: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          client_messages?: boolean
          commission_updates?: boolean
          created_at?: string
          id?: string
          marketing_emails?: boolean
          new_booking_alerts?: boolean
          training_reminders?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          client_messages?: boolean
          commission_updates?: boolean
          created_at?: string
          id?: string
          marketing_emails?: boolean
          new_booking_alerts?: boolean
          training_reminders?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agency_name: string | null
          avatar_url: string | null
          commission_rate: number | null
          commission_tier: Database["public"]["Enums"]["commission_tier"] | null
          created_at: string
          full_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_name?: string | null
          avatar_url?: string | null
          commission_rate?: number | null
          commission_tier?:
            | Database["public"]["Enums"]["commission_tier"]
            | null
          created_at?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_name?: string | null
          avatar_url?: string | null
          commission_rate?: number | null
          commission_tier?:
            | Database["public"]["Enums"]["commission_tier"]
            | null
          created_at?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          commission_rate: number
          commissionable_percentage: number
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          supplier_type: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          commission_rate?: number
          commissionable_percentage?: number
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          supplier_type?: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          commission_rate?: number
          commissionable_percentage?: number
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          supplier_type?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { accepting_user_id: string; invitation_token: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "office_admin"
      commission_tier: "tier_1" | "tier_2" | "tier_3"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "office_admin"],
      commission_tier: ["tier_1", "tier_2", "tier_3"],
    },
  },
} as const
