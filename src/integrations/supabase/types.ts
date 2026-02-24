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
      agent_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          trip_id: string | null
          trip_payment_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          trip_id?: string | null
          trip_payment_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          trip_id?: string | null
          trip_payment_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_notifications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_notifications_trip_payment_id_fkey"
            columns: ["trip_payment_id"]
            isOneToOne: false
            referencedRelation: "trip_payments"
            referencedColumns: ["id"]
          },
        ]
      }
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
          booking_type: string
          calculated_commission: number | null
          cancellation_terms: string | null
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
          payment_deadline: string | null
          return_date: string
          status: string
          supplier_id: string | null
          supplier_invoice_url: string | null
          supplier_payout: number
          total_amount: number
          travelers: number
          trip_id: string | null
          trip_name: string | null
          trip_page_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_reference: string
          booking_type?: string
          calculated_commission?: number | null
          cancellation_terms?: string | null
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
          payment_deadline?: string | null
          return_date: string
          status?: string
          supplier_id?: string | null
          supplier_invoice_url?: string | null
          supplier_payout?: number
          total_amount?: number
          travelers?: number
          trip_id?: string | null
          trip_name?: string | null
          trip_page_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_reference?: string
          booking_type?: string
          calculated_commission?: number | null
          cancellation_terms?: string | null
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
          payment_deadline?: string | null
          return_date?: string
          status?: string
          supplier_id?: string | null
          supplier_invoice_url?: string | null
          supplier_payout?: number
          total_amount?: number
          travelers?: number
          trip_id?: string | null
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
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
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
          video_intro_url: string | null
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
          video_intro_url?: string | null
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
          video_intro_url?: string | null
          website?: string | null
        }
        Relationships: []
      }
      cc_authorizations: {
        Row: {
          access_token: string
          authorization_amount: number
          authorization_description: string | null
          authorized_at: string | null
          auto_delete_at: string | null
          billing_zip: string | null
          booking_id: string
          cardholder_name: string | null
          client_id: string
          created_at: string
          encrypted_card_number: string | null
          encrypted_cvv: string | null
          encrypted_expiry: string | null
          expires_at: string | null
          id: string
          last_four: string | null
          signature_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string
          authorization_amount?: number
          authorization_description?: string | null
          authorized_at?: string | null
          auto_delete_at?: string | null
          billing_zip?: string | null
          booking_id: string
          cardholder_name?: string | null
          client_id: string
          created_at?: string
          encrypted_card_number?: string | null
          encrypted_cvv?: string | null
          encrypted_expiry?: string | null
          expires_at?: string | null
          id?: string
          last_four?: string | null
          signature_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          authorization_amount?: number
          authorization_description?: string | null
          authorized_at?: string | null
          auto_delete_at?: string | null
          billing_zip?: string | null
          booking_id?: string
          cardholder_name?: string | null
          client_id?: string
          created_at?: string
          encrypted_card_number?: string | null
          encrypted_cvv?: string | null
          encrypted_expiry?: string | null
          expires_at?: string | null
          id?: string
          last_four?: string | null
          signature_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cc_authorizations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cc_authorizations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      client_document_checklist: {
        Row: {
          checked_at: string | null
          client_id: string
          created_at: string
          id: string
          is_checked: boolean
          item_key: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          checked_at?: string | null
          client_id: string
          created_at?: string
          id?: string
          is_checked?: boolean
          item_key: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          checked_at?: string | null
          client_id?: string
          created_at?: string
          id?: string
          is_checked?: boolean
          item_key?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_document_checklist_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_document_checklist_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_sessions: {
        Row: {
          client_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          verified_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token: string
          verified_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_sessions_client_id_fkey"
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
          lead_source: string | null
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
          lead_source?: string | null
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
          lead_source?: string | null
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
          expected_commission: number | null
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
          expected_commission?: number | null
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
          expected_commission?: number | null
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
      invoice_sequences: {
        Row: {
          created_at: string
          current_number: number
          id: string
          prefix: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_number?: number
          id?: string
          prefix?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_number?: number
          id?: string
          prefix?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_paid: number
          amount_remaining: number
          client_id: string | null
          client_name: string | null
          created_at: string
          id: string
          invoice_date: string
          invoice_number: string
          status: string
          total_amount: number
          trip_id: string | null
          trip_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          amount_remaining?: number
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          invoice_date?: string
          invoice_number: string
          status?: string
          total_amount?: number
          trip_id?: string | null
          trip_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          amount_remaining?: number
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          status?: string
          total_amount?: number
          trip_id?: string | null
          trip_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      itineraries: {
        Row: {
          cover_image_url: string | null
          created_at: string
          depart_date: string | null
          id: string
          name: string
          overview: string | null
          return_date: string | null
          sort_order: number
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          depart_date?: string | null
          id?: string
          name?: string
          overview?: string | null
          return_date?: string | null
          sort_order?: number
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          depart_date?: string | null
          id?: string
          name?: string
          overview?: string | null
          return_date?: string | null
          sort_order?: number
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itineraries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_items: {
        Row: {
          booking_id: string | null
          category: string
          created_at: string
          day_number: number
          description: string | null
          end_time: string | null
          id: string
          item_date: string | null
          itinerary_id: string | null
          location: string | null
          notes: string | null
          sort_order: number
          start_time: string | null
          title: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          category?: string
          created_at?: string
          day_number: number
          description?: string | null
          end_time?: string | null
          id?: string
          item_date?: string | null
          itinerary_id?: string | null
          location?: string | null
          notes?: string | null
          sort_order?: number
          start_time?: string | null
          title: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          category?: string
          created_at?: string
          day_number?: number
          description?: string | null
          end_time?: string | null
          id?: string
          item_date?: string | null
          itinerary_id?: string | null
          location?: string | null
          notes?: string | null
          sort_order?: number
          start_time?: string | null
          title?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_items_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
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
      portal_messages: {
        Row: {
          agent_user_id: string
          client_id: string
          created_at: string
          id: string
          message: string
          read_at: string | null
          sender_type: string
        }
        Insert: {
          agent_user_id: string
          client_id: string
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          sender_type: string
        }
        Update: {
          agent_user_id?: string
          client_id?: string
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agency_name: string | null
          asta_number: string | null
          avatar_url: string | null
          ccra_number: string | null
          clia_number: string | null
          commission_rate: number | null
          commission_tier: Database["public"]["Enums"]["commission_tier"] | null
          created_at: string
          embarc_number: string | null
          full_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_name?: string | null
          asta_number?: string | null
          avatar_url?: string | null
          ccra_number?: string | null
          clia_number?: string | null
          commission_rate?: number | null
          commission_tier?:
            | Database["public"]["Enums"]["commission_tier"]
            | null
          created_at?: string
          embarc_number?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_name?: string | null
          asta_number?: string | null
          avatar_url?: string | null
          ccra_number?: string | null
          clia_number?: string | null
          commission_rate?: number | null
          commission_tier?:
            | Database["public"]["Enums"]["commission_tier"]
            | null
          created_at?: string
          embarc_number?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qbo_client_mappings: {
        Row: {
          client_id: string
          created_at: string
          id: string
          last_synced_at: string
          qbo_customer_id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          last_synced_at?: string
          qbo_customer_id: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          last_synced_at?: string
          qbo_customer_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qbo_client_mappings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_connections: {
        Row: {
          access_token: string
          company_name: string | null
          created_at: string
          id: string
          is_active: boolean
          realm_id: string
          refresh_token: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          company_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          realm_id: string
          refresh_token: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          company_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          realm_id?: string
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qbo_invoice_mappings: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          last_synced_at: string
          qbo_invoice_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          last_synced_at?: string
          qbo_invoice_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          last_synced_at?: string
          qbo_invoice_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qbo_invoice_mappings_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_sync_logs: {
        Row: {
          created_at: string
          details: Json | null
          direction: string
          error_message: string | null
          id: string
          records_processed: number
          status: string
          sync_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          direction?: string
          error_message?: string | null
          id?: string
          records_processed?: number
          status?: string
          sync_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          direction?: string
          error_message?: string | null
          id?: string
          records_processed?: number
          status?: string
          sync_type?: string
          user_id?: string
        }
        Relationships: []
      }
      signup_verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          verified?: boolean
        }
        Relationships: []
      }
      stripe_connected_accounts: {
        Row: {
          business_name: string | null
          card_issuing_status: string
          created_at: string
          id: string
          onboarding_status: string
          requirements_due: Json | null
          stripe_account_id: string
          transfers_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name?: string | null
          card_issuing_status?: string
          created_at?: string
          id?: string
          onboarding_status?: string
          requirements_due?: Json | null
          stripe_account_id: string
          transfers_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string | null
          card_issuing_status?: string
          created_at?: string
          id?: string
          onboarding_status?: string
          requirements_due?: Json | null
          stripe_account_id?: string
          transfers_status?: string
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
      trip_payments: {
        Row: {
          acceptance_signature: string | null
          amount: number
          booking_id: string | null
          created_at: string
          details: string | null
          due_date: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          payment_method_choice: string | null
          payment_type: string
          status: string
          stripe_payment_url: string | null
          stripe_receipt_url: string | null
          stripe_session_id: string | null
          terms_accepted_at: string | null
          trip_id: string
          updated_at: string
          user_id: string
          virtual_card_id: string | null
          virtual_card_status: string | null
        }
        Insert: {
          acceptance_signature?: string | null
          amount?: number
          booking_id?: string | null
          created_at?: string
          details?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_method_choice?: string | null
          payment_type?: string
          status?: string
          stripe_payment_url?: string | null
          stripe_receipt_url?: string | null
          stripe_session_id?: string | null
          terms_accepted_at?: string | null
          trip_id: string
          updated_at?: string
          user_id: string
          virtual_card_id?: string | null
          virtual_card_status?: string | null
        }
        Update: {
          acceptance_signature?: string | null
          amount?: number
          booking_id?: string | null
          created_at?: string
          details?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_method_choice?: string | null
          payment_type?: string
          status?: string
          stripe_payment_url?: string | null
          stripe_receipt_url?: string | null
          stripe_session_id?: string | null
          terms_accepted_at?: string | null
          trip_id?: string
          updated_at?: string
          user_id?: string
          virtual_card_id?: string | null
          virtual_card_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_travelers: {
        Row: {
          birthday: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_primary: boolean | null
          known_traveler_number: string | null
          last_name: string | null
          notes: string | null
          passport_info: string | null
          phone: string | null
          relationship: string | null
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          birthday?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_primary?: boolean | null
          known_traveler_number?: string | null
          last_name?: string | null
          notes?: string | null
          passport_info?: string | null
          phone?: string | null
          relationship?: string | null
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          birthday?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_primary?: boolean | null
          known_traveler_number?: string | null
          last_name?: string | null
          notes?: string | null
          passport_info?: string | null
          phone?: string | null
          relationship?: string | null
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_travelers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          allow_pdf_downloads: boolean
          approved_itinerary_id: string | null
          budget_range: string | null
          client_id: string | null
          cover_image_url: string | null
          created_at: string
          currency: string
          depart_date: string | null
          deposit_amount: number | null
          deposit_required: boolean | null
          destination: string | null
          id: string
          itinerary_approved_at: string | null
          itinerary_approved_by_client_id: string | null
          itinerary_style: string
          notes: string | null
          parent_trip_id: string | null
          post_trip_email_sent: boolean | null
          pricing_visibility: string
          published_at: string | null
          readiness_score: Json | null
          return_date: string | null
          share_token: string
          status: string
          tags: string[] | null
          total_commission_revenue: number
          total_commissionable_amount: number
          total_gross_sales: number
          total_net_sales: number
          total_supplier_payout: number
          trip_name: string
          trip_page_url: string | null
          trip_type: string | null
          updated_at: string
          upgrade_notes: string | null
          user_id: string
        }
        Insert: {
          allow_pdf_downloads?: boolean
          approved_itinerary_id?: string | null
          budget_range?: string | null
          client_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          depart_date?: string | null
          deposit_amount?: number | null
          deposit_required?: boolean | null
          destination?: string | null
          id?: string
          itinerary_approved_at?: string | null
          itinerary_approved_by_client_id?: string | null
          itinerary_style?: string
          notes?: string | null
          parent_trip_id?: string | null
          post_trip_email_sent?: boolean | null
          pricing_visibility?: string
          published_at?: string | null
          readiness_score?: Json | null
          return_date?: string | null
          share_token?: string
          status?: string
          tags?: string[] | null
          total_commission_revenue?: number
          total_commissionable_amount?: number
          total_gross_sales?: number
          total_net_sales?: number
          total_supplier_payout?: number
          trip_name: string
          trip_page_url?: string | null
          trip_type?: string | null
          updated_at?: string
          upgrade_notes?: string | null
          user_id: string
        }
        Update: {
          allow_pdf_downloads?: boolean
          approved_itinerary_id?: string | null
          budget_range?: string | null
          client_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          depart_date?: string | null
          deposit_amount?: number | null
          deposit_required?: boolean | null
          destination?: string | null
          id?: string
          itinerary_approved_at?: string | null
          itinerary_approved_by_client_id?: string | null
          itinerary_style?: string
          notes?: string | null
          parent_trip_id?: string | null
          post_trip_email_sent?: boolean | null
          pricing_visibility?: string
          published_at?: string | null
          readiness_score?: Json | null
          return_date?: string | null
          share_token?: string
          status?: string
          tags?: string[] | null
          total_commission_revenue?: number
          total_commissionable_amount?: number
          total_gross_sales?: number
          total_net_sales?: number
          total_supplier_payout?: number
          trip_name?: string
          trip_page_url?: string | null
          trip_type?: string | null
          updated_at?: string
          upgrade_notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_approved_itinerary_id_fkey"
            columns: ["approved_itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_itinerary_approved_by_client_id_fkey"
            columns: ["itinerary_approved_by_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_parent_trip_id_fkey"
            columns: ["parent_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
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
      webhook_configurations: {
        Row: {
          created_at: string
          data_format: string
          http_method: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          data_format?: string
          http_method?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          data_format?: string
          http_method?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      webhook_leads: {
        Row: {
          budget: string | null
          created_at: string
          email: string | null
          id: string
          lead_id: string | null
          location: string | null
          name: string | null
          phone: string | null
          project_type: string | null
          raw_payload: Json | null
          received_at: string
          source: string
          status: string
          timeline: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          name?: string | null
          phone?: string | null
          project_type?: string | null
          raw_payload?: Json | null
          received_at?: string
          source?: string
          status?: string
          timeline?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          name?: string | null
          phone?: string | null
          project_type?: string | null
          raw_payload?: Json | null
          received_at?: string
          source?: string
          status?: string
          timeline?: string | null
          updated_at?: string
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
      get_next_invoice_number: { Args: { p_user_id: string }; Returns: string }
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
      commission_tier: "tier_1" | "tier_2" | "tier_3" | "none"
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
      commission_tier: ["tier_1", "tier_2", "tier_3", "none"],
    },
  },
} as const
