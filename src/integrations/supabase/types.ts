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
      active_sessions: {
        Row: {
          created_at: string
          current_route: string | null
          id: string
          last_seen_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_route?: string | null
          id?: string
          last_seen_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_route?: string | null
          id?: string
          last_seen_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          title: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          title: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      agencies: {
        Row: {
          accent_color: string | null
          address: string | null
          asta_number: string | null
          clia_number: string | null
          created_at: string
          email: string | null
          iata_number: string | null
          id: string
          logo_url: string | null
          name: string
          owner_user_id: string
          phone: string | null
          primary_color: string | null
          tagline: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          asta_number?: string | null
          clia_number?: string | null
          created_at?: string
          email?: string | null
          iata_number?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_user_id: string
          phone?: string | null
          primary_color?: string | null
          tagline?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          asta_number?: string | null
          clia_number?: string | null
          created_at?: string
          email?: string | null
          iata_number?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_user_id?: string
          phone?: string | null
          primary_color?: string | null
          tagline?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      agency_margin_rules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          line_type: string | null
          name: string
          notes: string | null
          priority: number
          rule_type: string
          rule_value: number
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          line_type?: string | null
          name: string
          notes?: string | null
          priority?: number
          rule_type?: string
          rule_value?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          line_type?: string | null
          name?: string
          notes?: string | null
          priority?: number
          rule_type?: string
          rule_value?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_margin_rules_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_suppliers_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_margin_rules_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_settings: {
        Row: {
          approval_threshold: number
          commission_holdback_pct: number
          consortium_joined_on: string | null
          consortium_member_id: string | null
          consortium_name: string | null
          created_at: string
          ensemble_account_ref: string | null
          ensemble_last_sync_at: string | null
          ensemble_last_sync_status: string | null
          ensemble_sync_connected: boolean
          evaluation_period_months: number
          id: string
          tier_1_threshold: number
          tier_2_threshold: number
          tier_auto_promote: boolean
          txtya_default_group_id: string | null
          txtya_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_threshold?: number
          commission_holdback_pct?: number
          consortium_joined_on?: string | null
          consortium_member_id?: string | null
          consortium_name?: string | null
          created_at?: string
          ensemble_account_ref?: string | null
          ensemble_last_sync_at?: string | null
          ensemble_last_sync_status?: string | null
          ensemble_sync_connected?: boolean
          evaluation_period_months?: number
          id?: string
          tier_1_threshold?: number
          tier_2_threshold?: number
          tier_auto_promote?: boolean
          txtya_default_group_id?: string | null
          txtya_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_threshold?: number
          commission_holdback_pct?: number
          consortium_joined_on?: string | null
          consortium_member_id?: string | null
          consortium_name?: string | null
          created_at?: string
          ensemble_account_ref?: string | null
          ensemble_last_sync_at?: string | null
          ensemble_last_sync_status?: string | null
          ensemble_sync_connected?: boolean
          evaluation_period_months?: number
          id?: string
          tier_1_threshold?: number
          tier_2_threshold?: number
          tier_auto_promote?: boolean
          txtya_default_group_id?: string | null
          txtya_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_auto_apply_settings: {
        Row: {
          action_type: string
          agent_name: string
          auto_apply: boolean
          created_at: string
          id: string
          max_confidence_required: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type: string
          agent_name: string
          auto_apply?: boolean
          created_at?: string
          id?: string
          max_confidence_required?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          agent_name?: string
          auto_apply?: boolean
          created_at?: string
          id?: string
          max_confidence_required?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_availability: {
        Row: {
          buffer_minutes: number
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          slot_minutes: number
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          buffer_minutes?: number
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          slot_minutes?: number
          start_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          buffer_minutes?: number
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          slot_minutes?: number
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_availability_blocks: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_meetings: {
        Row: {
          agent_notes: string | null
          cancelled_at: string | null
          client_id: string | null
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          ends_at: string
          id: string
          notes: string | null
          starts_at: string
          status: string
          timezone: string
          topic: string | null
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_notes?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          ends_at: string
          id?: string
          notes?: string | null
          starts_at: string
          status?: string
          timezone?: string
          topic?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_notes?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          notes?: string | null
          starts_at?: string
          status?: string
          timezone?: string
          topic?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_meetings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          channel: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          recipient_id: string | null
          sender_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          recipient_id?: string | null
          sender_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          recipient_id?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      agent_notifications: {
        Row: {
          client_id: string | null
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
          client_id?: string | null
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
          client_id?: string | null
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
            foreignKeyName: "agent_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "payments"
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
      agent_onboarding_progress: {
        Row: {
          branding_configured: boolean
          created_at: string
          first_booking_added: boolean
          first_client_added: boolean
          first_trip_created: boolean
          id: string
          onboarding_completed_at: string | null
          profile_completed: boolean
          training_started: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          branding_configured?: boolean
          created_at?: string
          first_booking_added?: boolean
          first_client_added?: boolean
          first_trip_created?: boolean
          id?: string
          onboarding_completed_at?: string | null
          profile_completed?: boolean
          training_started?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          branding_configured?: boolean
          created_at?: string
          first_booking_added?: boolean
          first_client_added?: boolean
          first_trip_created?: boolean
          id?: string
          onboarding_completed_at?: string | null
          profile_completed?: boolean
          training_started?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_payout_accounts: {
        Row: {
          account_holder_name: string | null
          account_number: string | null
          account_number_last4: string | null
          account_type: string | null
          address_line1: string | null
          address_line2: string | null
          bank_name: string | null
          business_name: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          notes: string | null
          payee_name: string | null
          payout_method: string
          paypal_email: string | null
          phone: string | null
          postal_code: string | null
          routing_number: string | null
          state: string | null
          tax_form: string | null
          tax_id_last4: string | null
          updated_at: string
          user_id: string
          venmo_handle: string | null
          zelle_handle: string | null
        }
        Insert: {
          account_holder_name?: string | null
          account_number?: string | null
          account_number_last4?: string | null
          account_type?: string | null
          address_line1?: string | null
          address_line2?: string | null
          bank_name?: string | null
          business_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          payee_name?: string | null
          payout_method?: string
          paypal_email?: string | null
          phone?: string | null
          postal_code?: string | null
          routing_number?: string | null
          state?: string | null
          tax_form?: string | null
          tax_id_last4?: string | null
          updated_at?: string
          user_id: string
          venmo_handle?: string | null
          zelle_handle?: string | null
        }
        Update: {
          account_holder_name?: string | null
          account_number?: string | null
          account_number_last4?: string | null
          account_type?: string | null
          address_line1?: string | null
          address_line2?: string | null
          bank_name?: string | null
          business_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          payee_name?: string | null
          payout_method?: string
          paypal_email?: string | null
          phone?: string | null
          postal_code?: string | null
          routing_number?: string | null
          state?: string | null
          tax_form?: string | null
          tax_id_last4?: string | null
          updated_at?: string
          user_id?: string
          venmo_handle?: string | null
          zelle_handle?: string | null
        }
        Relationships: []
      }
      agent_subscription_payments: {
        Row: {
          agent_user_id: string
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          period_end: string | null
          period_start: string | null
          plan_name: string | null
          qbo_deposit_id: string | null
          qbo_synced_at: string | null
          status: string
          stripe_fee: number
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          agent_user_id: string
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          period_end?: string | null
          period_start?: string | null
          plan_name?: string | null
          qbo_deposit_id?: string | null
          qbo_synced_at?: string | null
          status?: string
          stripe_fee?: number
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_user_id?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          period_end?: string | null
          period_start?: string | null
          plan_name?: string | null
          qbo_deposit_id?: string | null
          qbo_synced_at?: string | null
          status?: string
          stripe_fee?: number
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agent_training_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          module_id: string
          notes: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          module_id: string
          notes?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          module_id?: string
          notes?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_training_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_proposed_actions: {
        Row: {
          action_type: string
          agent_name: string
          applied_at: string | null
          approved_at: string | null
          approved_by: string | null
          auto_apply_eligible: boolean
          confidence: number | null
          created_at: string
          error_message: string | null
          id: string
          proposed_changes: Json
          reasoning: string | null
          source: string | null
          status: string
          summary: string
          target_id: string | null
          target_table: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type: string
          agent_name: string
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          auto_apply_eligible?: boolean
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          proposed_changes?: Json
          reasoning?: string | null
          source?: string | null
          status?: string
          summary: string
          target_id?: string | null
          target_table?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          agent_name?: string
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          auto_apply_eligible?: boolean
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          proposed_changes?: Json
          reasoning?: string | null
          source?: string | null
          status?: string
          summary?: string
          target_id?: string | null
          target_table?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          key: string
          scope: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          key: string
          scope?: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          key?: string
          scope?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      approval_tasks: {
        Row: {
          action_payload: Json | null
          action_type: string
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          exception_id: string | null
          id: string
          qbo_object_id: string | null
          qbo_response: Json | null
          recon_match_id: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requires_admin: boolean | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          action_payload?: Json | null
          action_type: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          exception_id?: string | null
          id?: string
          qbo_object_id?: string | null
          qbo_response?: Json | null
          recon_match_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requires_admin?: boolean | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          action_payload?: Json | null
          action_type?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          exception_id?: string | null
          id?: string
          qbo_object_id?: string | null
          qbo_response?: Json | null
          recon_match_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requires_admin?: boolean | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_tasks_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "exception_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_tasks_recon_match_id_fkey"
            columns: ["recon_match_id"]
            isOneToOne: false
            referencedRelation: "recon_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          content_html: string | null
          content_markdown: string | null
          created_at: string | null
          faq_schema: Json | null
          hero_image_alt: string | null
          hero_image_url: string | null
          id: number
          infographic_url: string | null
          language: string | null
          meta_description: string | null
          meta_keywords: string | null
          published_at: string | null
          reading_time: number | null
          received_at: string | null
          slug: string
          tags: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content_html?: string | null
          content_markdown?: string | null
          created_at?: string | null
          faq_schema?: Json | null
          hero_image_alt?: string | null
          hero_image_url?: string | null
          id?: number
          infographic_url?: string | null
          language?: string | null
          meta_description?: string | null
          meta_keywords?: string | null
          published_at?: string | null
          reading_time?: number | null
          received_at?: string | null
          slug: string
          tags?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content_html?: string | null
          content_markdown?: string | null
          created_at?: string | null
          faq_schema?: Json | null
          hero_image_alt?: string | null
          hero_image_url?: string | null
          id?: number
          infographic_url?: string | null
          language?: string | null
          meta_description?: string | null
          meta_keywords?: string | null
          published_at?: string | null
          reading_time?: number | null
          received_at?: string | null
          slug?: string
          tags?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      booking_commission_lines: {
        Row: {
          amount: number
          booking_id: string
          commission_amount: number
          commission_rate: number
          created_at: string
          description: string
          id: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          booking_id: string
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          description: string
          id?: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          description?: string
          id?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_commission_lines_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_confirmations: {
        Row: {
          booking_id: string
          commission_variance: number
          created_at: string
          extracted_at: string | null
          extracted_commission_amount: number | null
          extracted_commission_rate: number | null
          extracted_cruise_line: string | null
          extracted_gross_charges: number | null
          extracted_guests: number | null
          extracted_itinerary: string | null
          extracted_json: Json
          extracted_net_charges: number | null
          extracted_reservation_id: string | null
          extracted_sailing_date: string | null
          extracted_ship: string | null
          extracted_stateroom: string | null
          gross_variance: number
          id: string
          net_variance: number
          pdf_filename: string | null
          recon_notes: string | null
          recon_status: string
          reconciled_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_id: string
          commission_variance?: number
          created_at?: string
          extracted_at?: string | null
          extracted_commission_amount?: number | null
          extracted_commission_rate?: number | null
          extracted_cruise_line?: string | null
          extracted_gross_charges?: number | null
          extracted_guests?: number | null
          extracted_itinerary?: string | null
          extracted_json?: Json
          extracted_net_charges?: number | null
          extracted_reservation_id?: string | null
          extracted_sailing_date?: string | null
          extracted_ship?: string | null
          extracted_stateroom?: string | null
          gross_variance?: number
          id?: string
          net_variance?: number
          pdf_filename?: string | null
          recon_notes?: string | null
          recon_status?: string
          reconciled_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_id?: string
          commission_variance?: number
          created_at?: string
          extracted_at?: string | null
          extracted_commission_amount?: number | null
          extracted_commission_rate?: number | null
          extracted_cruise_line?: string | null
          extracted_gross_charges?: number | null
          extracted_guests?: number | null
          extracted_itinerary?: string | null
          extracted_json?: Json
          extracted_net_charges?: number | null
          extracted_reservation_id?: string | null
          extracted_sailing_date?: string | null
          extracted_ship?: string | null
          extracted_stateroom?: string | null
          gross_variance?: number
          id?: string
          net_variance?: number
          pdf_filename?: string | null
          recon_notes?: string | null
          recon_status?: string
          reconciled_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_confirmations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_margin_audit: {
        Row: {
          advisor_margin_amount: number
          advisor_split_pct: number
          agency_gross_margin: number
          agency_margin_amount: number
          agency_split_pct: number
          booking_id: string
          calculated_by: string | null
          created_at: string
          id: string
          margin_version: number
          pricing_mode: string
          source: string
          total_cost: number
          total_sell: number
          triggered_by: string
        }
        Insert: {
          advisor_margin_amount?: number
          advisor_split_pct?: number
          agency_gross_margin?: number
          agency_margin_amount?: number
          agency_split_pct?: number
          booking_id: string
          calculated_by?: string | null
          created_at?: string
          id?: string
          margin_version: number
          pricing_mode?: string
          source?: string
          total_cost?: number
          total_sell?: number
          triggered_by?: string
        }
        Update: {
          advisor_margin_amount?: number
          advisor_split_pct?: number
          agency_gross_margin?: number
          agency_margin_amount?: number
          agency_split_pct?: number
          booking_id?: string
          calculated_by?: string | null
          created_at?: string
          id?: string
          margin_version?: number
          pricing_mode?: string
          source?: string
          total_cost?: number
          total_sell?: number
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_margin_audit_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_margin_lines: {
        Row: {
          booking_id: string
          created_at: string
          deposit_amount: number
          description: string
          id: string
          is_internal: boolean
          is_optional: boolean
          is_pass_through: boolean
          line_type: string
          margin_amount: number | null
          margin_rule_id: string | null
          quantity: number
          sort_order: number
          source: string
          total_cost: number | null
          total_sell: number | null
          unit_cost: number
          unit_sell: number
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          deposit_amount?: number
          description?: string
          id?: string
          is_internal?: boolean
          is_optional?: boolean
          is_pass_through?: boolean
          line_type?: string
          margin_amount?: number | null
          margin_rule_id?: string | null
          quantity?: number
          sort_order?: number
          source?: string
          total_cost?: number | null
          total_sell?: number | null
          unit_cost?: number
          unit_sell?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          deposit_amount?: number
          description?: string
          id?: string
          is_internal?: boolean
          is_optional?: boolean
          is_pass_through?: boolean
          line_type?: string
          margin_amount?: number | null
          margin_rule_id?: string | null
          quantity?: number
          sort_order?: number
          source?: string
          total_cost?: number | null
          total_sell?: number | null
          unit_cost?: number
          unit_sell?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_margin_lines_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_payer_shares: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          notes: string | null
          payer_email: string | null
          payer_name: string
          share_amount: number
          traveler_id: string | null
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payer_email?: string | null
          payer_name: string
          share_amount?: number
          traveler_id?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payer_email?: string | null
          payer_name?: string
          share_amount?: number
          traveler_id?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_payer_shares_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payer_shares_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "trip_travelers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payer_shares_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
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
          linked_client_id: string | null
          user_id: string
        }
        Insert: {
          booking_id: string
          companion_id: string
          created_at?: string
          id?: string
          linked_client_id?: string | null
          user_id: string
        }
        Update: {
          booking_id?: string
          companion_id?: string
          created_at?: string
          id?: string
          linked_client_id?: string | null
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
          {
            foreignKeyName: "booking_travelers_linked_client_id_fkey"
            columns: ["linked_client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_travelers_linked_client_id_fkey"
            columns: ["linked_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          advisor_margin_amount: number
          advisor_split_pct: number
          agency_gross_margin: number
          agency_margin_amount: number
          agency_split_pct: number
          calculated_commission: number | null
          client_selection_locked_at: string | null
          commission_estimate: number | null
          commission_override_amount: number | null
          commission_revenue: number
          commissionable_amount: number
          confirmation_number: string
          created_at: string
          duffel_offer_id: string | null
          gross_sales: number
          id: string
          margin_locked: boolean
          margin_version: number
          net_sales: number
          override_approved: boolean | null
          override_approved_at: string | null
          override_approved_by: string | null
          override_notes: string | null
          override_pending_approval: boolean | null
          pricing_mode: string
          source: string
          status: string
          supplier_confirmation_number: string | null
          supplier_id: string | null
          supplier_paid_amount: number | null
          supplier_paid_date: string | null
          supplier_paid_method: string | null
          supplier_paid_reference: string | null
          supplier_paid_status: string
          supplier_payout: number | null
          total_price: number
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          advisor_margin_amount?: number
          advisor_split_pct?: number
          agency_gross_margin?: number
          agency_margin_amount?: number
          agency_split_pct?: number
          calculated_commission?: number | null
          client_selection_locked_at?: string | null
          commission_estimate?: number | null
          commission_override_amount?: number | null
          commission_revenue?: number
          commissionable_amount?: number
          confirmation_number: string
          created_at?: string
          duffel_offer_id?: string | null
          gross_sales?: number
          id?: string
          margin_locked?: boolean
          margin_version?: number
          net_sales?: number
          override_approved?: boolean | null
          override_approved_at?: string | null
          override_approved_by?: string | null
          override_notes?: string | null
          override_pending_approval?: boolean | null
          pricing_mode?: string
          source?: string
          status?: string
          supplier_confirmation_number?: string | null
          supplier_id?: string | null
          supplier_paid_amount?: number | null
          supplier_paid_date?: string | null
          supplier_paid_method?: string | null
          supplier_paid_reference?: string | null
          supplier_paid_status?: string
          supplier_payout?: number | null
          total_price?: number
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          advisor_margin_amount?: number
          advisor_split_pct?: number
          agency_gross_margin?: number
          agency_margin_amount?: number
          agency_split_pct?: number
          calculated_commission?: number | null
          client_selection_locked_at?: string | null
          commission_estimate?: number | null
          commission_override_amount?: number | null
          commission_revenue?: number
          commissionable_amount?: number
          confirmation_number?: string
          created_at?: string
          duffel_offer_id?: string | null
          gross_sales?: number
          id?: string
          margin_locked?: boolean
          margin_version?: number
          net_sales?: number
          override_approved?: boolean | null
          override_approved_at?: string | null
          override_approved_by?: string | null
          override_notes?: string | null
          override_pending_approval?: boolean | null
          pricing_mode?: string
          source?: string
          status?: string
          supplier_confirmation_number?: string | null
          supplier_id?: string | null
          supplier_paid_amount?: number | null
          supplier_paid_date?: string | null
          supplier_paid_method?: string | null
          supplier_paid_reference?: string | null
          supplier_paid_status?: string
          supplier_payout?: number | null
          total_price?: number
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_suppliers_view"
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
      bookkeeper_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          metadata: Json | null
          resource: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          resource?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          resource?: string | null
        }
        Relationships: []
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
      business_contacts: {
        Row: {
          ai_company_research: string | null
          ai_crm_notes: string | null
          ai_inferred_needs: string | null
          ai_recommended_services: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          email: string | null
          employee_count: string | null
          follow_up_date: string | null
          id: string
          industry: string | null
          job_title: string | null
          lead_source: string | null
          lead_status: string
          linkedin_url: string | null
          notes: string | null
          outreach_email_body: string | null
          outreach_sent_at: string | null
          outreach_status: string | null
          outreach_subject: string | null
          phone: string | null
          revenue_size: string | null
          tags: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          ai_company_research?: string | null
          ai_crm_notes?: string | null
          ai_inferred_needs?: string | null
          ai_recommended_services?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          employee_count?: string | null
          follow_up_date?: string | null
          id?: string
          industry?: string | null
          job_title?: string | null
          lead_source?: string | null
          lead_status?: string
          linkedin_url?: string | null
          notes?: string | null
          outreach_email_body?: string | null
          outreach_sent_at?: string | null
          outreach_status?: string | null
          outreach_subject?: string | null
          phone?: string | null
          revenue_size?: string | null
          tags?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          ai_company_research?: string | null
          ai_crm_notes?: string | null
          ai_inferred_needs?: string | null
          ai_recommended_services?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          employee_count?: string | null
          follow_up_date?: string | null
          id?: string
          industry?: string | null
          job_title?: string | null
          lead_source?: string | null
          lead_status?: string
          linkedin_url?: string | null
          notes?: string | null
          outreach_email_body?: string | null
          outreach_sent_at?: string | null
          outreach_status?: string | null
          outreach_subject?: string | null
          phone?: string | null
          revenue_size?: string | null
          tags?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      campaign_audiences: {
        Row: {
          contact_count: number | null
          created_at: string
          created_by: string | null
          description: string | null
          filter: Json
          id: string
          last_counted_at: string | null
          name: string
          updated_at: string
        }
        Insert: {
          contact_count?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter?: Json
          id?: string
          last_counted_at?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          contact_count?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter?: Json
          id?: string
          last_counted_at?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaign_events: {
        Row: {
          campaign_id: string | null
          event_type: string
          id: string
          payload: Json
          received_at: string
          recipient_id: string | null
          resend_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          event_type: string
          id?: string
          payload: Json
          received_at?: string
          recipient_id?: string | null
          resend_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          event_type?: string
          id?: string
          payload?: Json
          received_at?: string
          recipient_id?: string | null
          resend_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          bounce_reason: string | null
          bounced_at: string | null
          campaign_id: string
          click_count: number
          complained_at: string | null
          contact_id: string | null
          contact_source: string | null
          created_at: string
          delivered_at: string | null
          email: string
          error_message: string | null
          first_clicked_at: string | null
          first_opened_at: string | null
          id: string
          merge_data: Json | null
          open_count: number
          resend_id: string | null
          sent_at: string | null
          status: string
          unsubscribed_at: string | null
        }
        Insert: {
          bounce_reason?: string | null
          bounced_at?: string | null
          campaign_id: string
          click_count?: number
          complained_at?: string | null
          contact_id?: string | null
          contact_source?: string | null
          created_at?: string
          delivered_at?: string | null
          email: string
          error_message?: string | null
          first_clicked_at?: string | null
          first_opened_at?: string | null
          id?: string
          merge_data?: Json | null
          open_count?: number
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          unsubscribed_at?: string | null
        }
        Update: {
          bounce_reason?: string | null
          bounced_at?: string | null
          campaign_id?: string
          click_count?: number
          complained_at?: string | null
          contact_id?: string | null
          contact_source?: string | null
          created_at?: string
          delivered_at?: string | null
          email?: string
          error_message?: string | null
          first_clicked_at?: string | null
          first_opened_at?: string | null
          id?: string
          merge_data?: Json | null
          open_count?: number
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          audience_id: string | null
          body_html: string
          body_text: string | null
          created_at: string
          created_by: string | null
          from_email: string
          from_name: string
          id: string
          name: string
          preheader: string | null
          reply_to: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string
          total_bounced: number
          total_clicked: number
          total_complained: number
          total_delivered: number
          total_opened: number
          total_recipients: number
          total_sent: number
          total_suppressed: number
          total_unsubscribed: number
          updated_at: string
        }
        Insert: {
          audience_id?: string | null
          body_html: string
          body_text?: string | null
          created_at?: string
          created_by?: string | null
          from_email?: string
          from_name?: string
          id?: string
          name: string
          preheader?: string | null
          reply_to?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          total_bounced?: number
          total_clicked?: number
          total_complained?: number
          total_delivered?: number
          total_opened?: number
          total_recipients?: number
          total_sent?: number
          total_suppressed?: number
          total_unsubscribed?: number
          updated_at?: string
        }
        Update: {
          audience_id?: string | null
          body_html?: string
          body_text?: string | null
          created_at?: string
          created_by?: string | null
          from_email?: string
          from_name?: string
          id?: string
          name?: string
          preheader?: string | null
          reply_to?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          total_bounced?: number
          total_clicked?: number
          total_complained?: number
          total_delivered?: number
          total_opened?: number
          total_recipients?: number
          total_sent?: number
          total_suppressed?: number
          total_unsubscribed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "campaign_audiences"
            referencedColumns: ["id"]
          },
        ]
      }
      car_rental_requests: {
        Row: {
          actual_total: number | null
          additional_drivers: number | null
          agent_notes: string | null
          assigned_agent: string | null
          cc_auth_billing_zip: string | null
          cc_auth_cardholder_name: string | null
          cc_auth_exp_month: string | null
          cc_auth_exp_year: string | null
          cc_auth_last_four: string | null
          cc_auth_stripe_pm_id: string | null
          cc_authorized: boolean | null
          cc_authorized_at: string | null
          cc_cardholder_name: string | null
          cc_collected_at: string | null
          cc_collected_by: string | null
          cc_collection_method: string | null
          cc_full_collected: boolean | null
          cc_notes: string | null
          cc_stripe_pm_id: string | null
          client_id: string | null
          confirmation_number: string | null
          created_at: string | null
          driver_age_range: string
          driver_email: string
          driver_name: string
          driver_phone: string | null
          dropoff_location: string | null
          estimated_total: number | null
          flight_number: string | null
          id: string
          loyalty_number: string | null
          notes: string | null
          pickup_date: string
          pickup_location: string
          pickup_time: string
          provider: string
          provider_booking_ref: string | null
          quote_accepted_at: string | null
          quote_sent_at: string | null
          quoted_price: number | null
          return_date: string | null
          return_time: string | null
          source: string | null
          status: string | null
          trip_id: string | null
          trip_type: string
          updated_at: string | null
          vehicle_class: string
        }
        Insert: {
          actual_total?: number | null
          additional_drivers?: number | null
          agent_notes?: string | null
          assigned_agent?: string | null
          cc_auth_billing_zip?: string | null
          cc_auth_cardholder_name?: string | null
          cc_auth_exp_month?: string | null
          cc_auth_exp_year?: string | null
          cc_auth_last_four?: string | null
          cc_auth_stripe_pm_id?: string | null
          cc_authorized?: boolean | null
          cc_authorized_at?: string | null
          cc_cardholder_name?: string | null
          cc_collected_at?: string | null
          cc_collected_by?: string | null
          cc_collection_method?: string | null
          cc_full_collected?: boolean | null
          cc_notes?: string | null
          cc_stripe_pm_id?: string | null
          client_id?: string | null
          confirmation_number?: string | null
          created_at?: string | null
          driver_age_range: string
          driver_email: string
          driver_name: string
          driver_phone?: string | null
          dropoff_location?: string | null
          estimated_total?: number | null
          flight_number?: string | null
          id?: string
          loyalty_number?: string | null
          notes?: string | null
          pickup_date: string
          pickup_location: string
          pickup_time: string
          provider: string
          provider_booking_ref?: string | null
          quote_accepted_at?: string | null
          quote_sent_at?: string | null
          quoted_price?: number | null
          return_date?: string | null
          return_time?: string | null
          source?: string | null
          status?: string | null
          trip_id?: string | null
          trip_type: string
          updated_at?: string | null
          vehicle_class: string
        }
        Update: {
          actual_total?: number | null
          additional_drivers?: number | null
          agent_notes?: string | null
          assigned_agent?: string | null
          cc_auth_billing_zip?: string | null
          cc_auth_cardholder_name?: string | null
          cc_auth_exp_month?: string | null
          cc_auth_exp_year?: string | null
          cc_auth_last_four?: string | null
          cc_auth_stripe_pm_id?: string | null
          cc_authorized?: boolean | null
          cc_authorized_at?: string | null
          cc_cardholder_name?: string | null
          cc_collected_at?: string | null
          cc_collected_by?: string | null
          cc_collection_method?: string | null
          cc_full_collected?: boolean | null
          cc_notes?: string | null
          cc_stripe_pm_id?: string | null
          client_id?: string | null
          confirmation_number?: string | null
          created_at?: string | null
          driver_age_range?: string
          driver_email?: string
          driver_name?: string
          driver_phone?: string | null
          dropoff_location?: string | null
          estimated_total?: number | null
          flight_number?: string | null
          id?: string
          loyalty_number?: string | null
          notes?: string | null
          pickup_date?: string
          pickup_location?: string
          pickup_time?: string
          provider?: string
          provider_booking_ref?: string | null
          quote_accepted_at?: string | null
          quote_sent_at?: string | null
          quoted_price?: number | null
          return_date?: string | null
          return_time?: string | null
          source?: string | null
          status?: string | null
          trip_id?: string | null
          trip_type?: string
          updated_at?: string | null
          vehicle_class?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_rental_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_rental_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_rental_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "bookkeeper_clients_view"
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
      checkout_payments: {
        Row: {
          affirm_charge_id: string | null
          agent_user_id: string | null
          amount_cents: number
          booking_id: string | null
          booking_ref: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string | null
          currency: string | null
          customer_email: string
          customer_name: string
          customer_phone: string | null
          id: string
          late_fees_applied: number | null
          late_fees_charged: number | null
          metadata: Json | null
          missed_payments: number | null
          months_paid: number | null
          notes: string | null
          payment_method: string
          payment_type: string | null
          plan_cancelled: boolean | null
          plan_cancelled_at: string | null
          plan_cancelled_reason: string | null
          plan_months: number | null
          status: string | null
          stripe_client_secret: string | null
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
          total_months: number | null
          travel_date: string | null
          trip_id: string | null
          trip_name: string | null
          trip_payment_id: string | null
          updated_at: string | null
        }
        Insert: {
          affirm_charge_id?: string | null
          agent_user_id?: string | null
          amount_cents: number
          booking_id?: string | null
          booking_ref?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          late_fees_applied?: number | null
          late_fees_charged?: number | null
          metadata?: Json | null
          missed_payments?: number | null
          months_paid?: number | null
          notes?: string | null
          payment_method: string
          payment_type?: string | null
          plan_cancelled?: boolean | null
          plan_cancelled_at?: string | null
          plan_cancelled_reason?: string | null
          plan_months?: number | null
          status?: string | null
          stripe_client_secret?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          total_months?: number | null
          travel_date?: string | null
          trip_id?: string | null
          trip_name?: string | null
          trip_payment_id?: string | null
          updated_at?: string | null
        }
        Update: {
          affirm_charge_id?: string | null
          agent_user_id?: string | null
          amount_cents?: number
          booking_id?: string | null
          booking_ref?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          late_fees_applied?: number | null
          late_fees_charged?: number | null
          metadata?: Json | null
          missed_payments?: number | null
          months_paid?: number | null
          notes?: string | null
          payment_method?: string
          payment_type?: string | null
          plan_cancelled?: boolean | null
          plan_cancelled_at?: string | null
          plan_cancelled_reason?: string | null
          plan_months?: number | null
          status?: string | null
          stripe_client_secret?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          total_months?: number | null
          travel_date?: string | null
          trip_id?: string | null
          trip_name?: string | null
          trip_payment_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_payments_trip_payment_id_fkey"
            columns: ["trip_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_payments_trip_payment_id_fkey"
            columns: ["trip_payment_id"]
            isOneToOne: false
            referencedRelation: "trip_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_briefings: {
        Row: {
          booking_window: string | null
          coming_up: string | null
          created_at: string
          from_the_circle: string | null
          id: string
          issue_number: number
          scheduled_for: string | null
          sent_at: string | null
          sent_to_count: number | null
          status: string
          subject: string
          the_port: string | null
          updated_at: string
        }
        Insert: {
          booking_window?: string | null
          coming_up?: string | null
          created_at?: string
          from_the_circle?: string | null
          id?: string
          issue_number: number
          scheduled_for?: string | null
          sent_at?: string | null
          sent_to_count?: number | null
          status?: string
          subject: string
          the_port?: string | null
          updated_at?: string
        }
        Update: {
          booking_window?: string | null
          coming_up?: string | null
          created_at?: string
          from_the_circle?: string | null
          id?: string
          issue_number?: number
          scheduled_for?: string | null
          sent_at?: string | null
          sent_to_count?: number | null
          status?: string
          subject?: string
          the_port?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      circle_invitations: {
        Row: {
          client_id: string | null
          created_at: string
          email: string | null
          id: string
          sent_at: string | null
          subject_variant: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          sent_at?: string | null
          subject_variant?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          sent_at?: string | null
          subject_variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "circle_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_members: {
        Row: {
          client_id: string | null
          created_at: string
          email: string
          founding_member: boolean
          id: string
          joined_at: string
          name: string | null
          notes: string | null
          source: string | null
          status: string
          tier: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email: string
          founding_member?: boolean
          id?: string
          joined_at?: string
          name?: string | null
          notes?: string | null
          source?: string | null
          status?: string
          tier?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string
          founding_member?: boolean
          id?: string
          joined_at?: string
          name?: string | null
          notes?: string | null
          source?: string | null
          status?: string
          tier?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_call_notes: {
        Row: {
          action_items: Json
          call_date: string
          call_type: string
          client_id: string
          created_at: string
          follow_up_date: string | null
          id: string
          key_points: Json
          sentiment: string | null
          summary: string | null
          title: string
          transcript: string | null
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_items?: Json
          call_date?: string
          call_type?: string
          client_id: string
          created_at?: string
          follow_up_date?: string | null
          id?: string
          key_points?: Json
          sentiment?: string | null
          summary?: string | null
          title?: string
          transcript?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_items?: Json
          call_date?: string
          call_type?: string
          client_id?: string
          created_at?: string
          follow_up_date?: string | null
          id?: string
          key_points?: Json
          sentiment?: string | null
          summary?: string | null
          title?: string
          transcript?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_call_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_call_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_call_notes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
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
          linked_client_id: string | null
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
          linked_client_id?: string | null
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
          linked_client_id?: string | null
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
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_companions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_companions_linked_client_id_fkey"
            columns: ["linked_client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_companions_linked_client_id_fkey"
            columns: ["linked_client_id"]
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
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
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
      client_document_uploads: {
        Row: {
          client_id: string | null
          created_at: string | null
          description: string | null
          doc_key: string
          file_name: string
          file_size: number | null
          id: string
          label: string | null
          mime_type: string | null
          reviewed: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          storage_path: string
          trip_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          doc_key: string
          file_name: string
          file_size?: number | null
          id?: string
          label?: string | null
          mime_type?: string | null
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path: string
          trip_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          doc_key?: string
          file_name?: string
          file_size?: number | null
          id?: string
          label?: string | null
          mime_type?: string | null
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path?: string
          trip_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_document_uploads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_document_uploads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_document_uploads_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      client_line_selections: {
        Row: {
          booking_id: string
          client_id: string | null
          created_at: string
          id: string
          locked_at: string | null
          margin_line_id: string
          selected: boolean
          trip_id: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          client_id?: string | null
          created_at?: string
          id?: string
          locked_at?: string | null
          margin_line_id: string
          selected?: boolean
          trip_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          client_id?: string | null
          created_at?: string
          id?: string
          locked_at?: string | null
          margin_line_id?: string
          selected?: boolean
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_line_selections_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_line_selections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_line_selections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_line_selections_margin_line_id_fkey"
            columns: ["margin_line_id"]
            isOneToOne: false
            referencedRelation: "booking_margin_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_line_selections_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notifications: {
        Row: {
          body: string
          client_id: string
          created_at: string
          id: string
          read_at: string | null
          title: string
          trip_id: string | null
          type: string
        }
        Insert: {
          body: string
          client_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          trip_id?: string | null
          type: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          trip_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notifications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      client_option_selections: {
        Row: {
          agent_confirmed: boolean
          agent_confirmed_at: string | null
          client_id: string
          created_at: string
          id: string
          option_block_id: string
          selected_item_id: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          agent_confirmed?: boolean
          agent_confirmed_at?: string | null
          client_id: string
          created_at?: string
          id?: string
          option_block_id: string
          selected_item_id: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          agent_confirmed?: boolean
          agent_confirmed_at?: string | null
          client_id?: string
          created_at?: string
          id?: string
          option_block_id?: string
          selected_item_id?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_option_selections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_option_selections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_option_selections_option_block_id_fkey"
            columns: ["option_block_id"]
            isOneToOne: false
            referencedRelation: "option_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_option_selections_selected_item_id_fkey"
            columns: ["selected_item_id"]
            isOneToOne: false
            referencedRelation: "itinerary_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_option_selections_trip_id_fkey"
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
          unread_message_count: number | null
          verified_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token: string
          unread_message_count?: number | null
          verified_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          unread_message_count?: number | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles: {
        Row: {
          auth_user_id: string
          client_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          client_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          client_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_push_tokens: {
        Row: {
          client_id: string
          created_at: string
          id: string
          last_seen_at: string
          platform: string | null
          token: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string | null
          token: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_push_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_push_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_update_tokens: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_update_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_update_tokens_client_id_fkey"
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
          advisor_id: string | null
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
          membership_tier: Database["public"]["Enums"]["client_tier"]
          name: string
          notes: string | null
          passport_date_of_birth: string | null
          passport_expiry: string | null
          passport_full_name: string | null
          passport_info: string | null
          passport_issuing_country: string | null
          passport_nationality: string | null
          passport_number: string | null
          passport_sex: string | null
          phone: string | null
          preferred_first_name: string | null
          redress_number: string | null
          secondary_email: string | null
          secondary_phone: string | null
          source: string
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
          advisor_id?: string | null
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
          membership_tier?: Database["public"]["Enums"]["client_tier"]
          name: string
          notes?: string | null
          passport_date_of_birth?: string | null
          passport_expiry?: string | null
          passport_full_name?: string | null
          passport_info?: string | null
          passport_issuing_country?: string | null
          passport_nationality?: string | null
          passport_number?: string | null
          passport_sex?: string | null
          phone?: string | null
          preferred_first_name?: string | null
          redress_number?: string | null
          secondary_email?: string | null
          secondary_phone?: string | null
          source?: string
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
          advisor_id?: string | null
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
          membership_tier?: Database["public"]["Enums"]["client_tier"]
          name?: string
          notes?: string | null
          passport_date_of_birth?: string | null
          passport_expiry?: string | null
          passport_full_name?: string | null
          passport_info?: string | null
          passport_issuing_country?: string | null
          passport_nationality?: string | null
          passport_number?: string | null
          passport_sex?: string | null
          phone?: string | null
          preferred_first_name?: string | null
          redress_number?: string | null
          secondary_email?: string | null
          secondary_phone?: string | null
          source?: string
          status?: string
          tags?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      commission_payments: {
        Row: {
          amount: number
          booking_id: string
          commission_id: string
          created_at: string
          id: string
          notes: string | null
          paid_date: string
          payment_method: string | null
          payment_reference: string | null
          supplier_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          booking_id: string
          commission_id: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_date: string
          payment_method?: string | null
          payment_reference?: string | null
          supplier_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string
          commission_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_date?: string
          payment_method?: string | null
          payment_reference?: string | null
          supplier_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payments_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_splits: {
        Row: {
          amount: number
          commission_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          paid_date: string | null
          percent: number | null
          recipient_user_id: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          commission_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          percent?: number | null
          recipient_user_id?: string | null
          role: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          commission_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          percent?: number | null
          recipient_user_id?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_splits_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          expected_commission: number | null
          holdback_amount: number | null
          holdback_released: boolean | null
          holdback_released_at: string | null
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
          holdback_amount?: number | null
          holdback_released?: boolean | null
          holdback_released_at?: string | null
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
          holdback_amount?: number | null
          holdback_released?: boolean | null
          holdback_released_at?: string | null
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
      compliance_audit_log: {
        Row: {
          client_name: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          signature: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          signature?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          signature?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string | null
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          referral_source: string | null
          status: string | null
          subject: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          referral_source?: string | null
          status?: string | null
          subject: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          referral_source?: string | null
          status?: string | null
          subject?: string
        }
        Relationships: []
      }
      cruise_ships: {
        Row: {
          cover_image: string | null
          id: string
          operator: string | null
          profile_image: string | null
          ship_class: string | null
          size: string | null
          synced_at: string
          title: string
          widgety_slug: string
        }
        Insert: {
          cover_image?: string | null
          id?: string
          operator?: string | null
          profile_image?: string | null
          ship_class?: string | null
          size?: string | null
          synced_at?: string
          title: string
          widgety_slug: string
        }
        Update: {
          cover_image?: string | null
          id?: string
          operator?: string | null
          profile_image?: string | null
          ship_class?: string | null
          size?: string | null
          synced_at?: string
          title?: string
          widgety_slug?: string
        }
        Relationships: []
      }
      cruises: {
        Row: {
          active: boolean
          created_at: string
          cruise_nights: number | null
          cruise_theme: string | null
          cruise_type: string[] | null
          description: string | null
          ends_at: string | null
          ends_on: string | null
          id: string
          image_url: string | null
          name: string
          official_link: string | null
          operator: string | null
          operator_title: string | null
          price_currency: string | null
          price_from: number | null
          price_pp: boolean | null
          rating: string | null
          regions: string[] | null
          ship: string | null
          ship_title: string | null
          starts_at: string | null
          starts_on: string | null
          synced_at: string
          updated_at: string
          vacation_days: number | null
          vendor_id: string | null
          widgety_ref: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cruise_nights?: number | null
          cruise_theme?: string | null
          cruise_type?: string[] | null
          description?: string | null
          ends_at?: string | null
          ends_on?: string | null
          id?: string
          image_url?: string | null
          name: string
          official_link?: string | null
          operator?: string | null
          operator_title?: string | null
          price_currency?: string | null
          price_from?: number | null
          price_pp?: boolean | null
          rating?: string | null
          regions?: string[] | null
          ship?: string | null
          ship_title?: string | null
          starts_at?: string | null
          starts_on?: string | null
          synced_at?: string
          updated_at?: string
          vacation_days?: number | null
          vendor_id?: string | null
          widgety_ref: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cruise_nights?: number | null
          cruise_theme?: string | null
          cruise_type?: string[] | null
          description?: string | null
          ends_at?: string | null
          ends_on?: string | null
          id?: string
          image_url?: string | null
          name?: string
          official_link?: string | null
          operator?: string | null
          operator_title?: string | null
          price_currency?: string | null
          price_from?: number | null
          price_pp?: boolean | null
          rating?: string | null
          regions?: string[] | null
          ship?: string | null
          ship_title?: string | null
          starts_at?: string | null
          starts_on?: string | null
          synced_at?: string
          updated_at?: string
          vacation_days?: number | null
          vendor_id?: string | null
          widgety_ref?: string
        }
        Relationships: []
      }
      destinations: {
        Row: {
          code: string
          country_code: string
          name: string
          updated_at: string
          zone_count: number | null
        }
        Insert: {
          code: string
          country_code: string
          name: string
          updated_at?: string
          zone_count?: number | null
        }
        Update: {
          code?: string
          country_code?: string
          name?: string
          updated_at?: string
          zone_count?: number | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          attempt_count: number
          client_id: string | null
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string | null
          metadata: Json | null
          provider_message_id: string | null
          sent_at: string
          status: string
          subject: string
          template: string
          to_email: string
          user_id: string | null
        }
        Insert: {
          attempt_count?: number
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          provider_message_id?: string | null
          sent_at?: string
          status?: string
          subject: string
          template: string
          to_email: string
          user_id?: string | null
        }
        Update: {
          attempt_count?: number
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          provider_message_id?: string | null
          sent_at?: string
          status?: string
          subject?: string
          template?: string
          to_email?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_suppressions: {
        Row: {
          email: string
          notes: string | null
          reason: string
          source: string | null
          suppressed_at: string
        }
        Insert: {
          email: string
          notes?: string | null
          reason: string
          source?: string | null
          suppressed_at?: string
        }
        Update: {
          email?: string
          notes?: string | null
          reason?: string
          source?: string | null
          suppressed_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          category: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body_html: string
          category?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body_html?: string
          category?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exception_queue: {
        Row: {
          amount: number | null
          assigned_to: string | null
          created_at: string | null
          description: string | null
          exception_type: string
          id: string
          recon_match_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          source_record_id: string | null
          source_record_type: string | null
          source_system: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          exception_type: string
          id?: string
          recon_match_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_record_id?: string | null
          source_record_type?: string | null
          source_system?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          exception_type?: string
          id?: string
          recon_match_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_record_id?: string | null
          source_record_type?: string | null
          source_system?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exception_queue_recon_match_id_fkey"
            columns: ["recon_match_id"]
            isOneToOne: false
            referencedRelation: "recon_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      excursion_requests: {
        Row: {
          agent_notes: string | null
          agent_user_id: string | null
          client_id: string
          client_notes: string | null
          created_at: string
          currency: string
          destination: string | null
          estimated_commission: number | null
          estimated_total: number | null
          id: string
          image_url: string | null
          price_per_person: number | null
          product_code: string
          product_title: string | null
          product_url: string | null
          status: string
          travel_date: string | null
          travelers: number
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          agent_notes?: string | null
          agent_user_id?: string | null
          client_id: string
          client_notes?: string | null
          created_at?: string
          currency?: string
          destination?: string | null
          estimated_commission?: number | null
          estimated_total?: number | null
          id?: string
          image_url?: string | null
          price_per_person?: number | null
          product_code: string
          product_title?: string | null
          product_url?: string | null
          status?: string
          travel_date?: string | null
          travelers?: number
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_notes?: string | null
          agent_user_id?: string | null
          client_id?: string
          client_notes?: string | null
          created_at?: string
          currency?: string
          destination?: string | null
          estimated_commission?: number | null
          estimated_total?: number | null
          id?: string
          image_url?: string | null
          price_per_person?: number | null
          product_code?: string
          product_title?: string | null
          product_url?: string | null
          status?: string
          travel_date?: string | null
          travelers?: number
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "excursion_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excursion_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excursion_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_trips: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          destination: string
          difficulty: string | null
          duration: string | null
          excluded: string[] | null
          gallery_images: string[] | null
          group_size: string | null
          highlights: string[] | null
          id: string
          included: string[] | null
          itinerary: Json | null
          overview: string | null
          popular: boolean | null
          published: boolean | null
          rating: number | null
          review_count: number | null
          slug: string | null
          starting_from: string | null
          tagline: string | null
          trip_name: string
          trip_type: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          destination: string
          difficulty?: string | null
          duration?: string | null
          excluded?: string[] | null
          gallery_images?: string[] | null
          group_size?: string | null
          highlights?: string[] | null
          id?: string
          included?: string[] | null
          itinerary?: Json | null
          overview?: string | null
          popular?: boolean | null
          published?: boolean | null
          rating?: number | null
          review_count?: number | null
          slug?: string | null
          starting_from?: string | null
          tagline?: string | null
          trip_name: string
          trip_type?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          destination?: string
          difficulty?: string | null
          duration?: string | null
          excluded?: string[] | null
          gallery_images?: string[] | null
          group_size?: string | null
          highlights?: string[] | null
          id?: string
          included?: string[] | null
          itinerary?: Json | null
          overview?: string | null
          popular?: boolean | null
          published?: boolean | null
          rating?: number | null
          review_count?: number | null
          slug?: string | null
          starting_from?: string | null
          tagline?: string | null
          trip_name?: string
          trip_type?: string | null
        }
        Relationships: []
      }
      financial_packets: {
        Row: {
          created_at: string | null
          generated_by: string | null
          id: string
          period_month: number
          period_year: number
          status: string | null
          storage_path: string | null
        }
        Insert: {
          created_at?: string | null
          generated_by?: string | null
          id?: string
          period_month: number
          period_year: number
          status?: string | null
          storage_path?: string | null
        }
        Update: {
          created_at?: string | null
          generated_by?: string | null
          id?: string
          period_month?: number
          period_year?: number
          status?: string | null
          storage_path?: string | null
        }
        Relationships: []
      }
      flight_orders: {
        Row: {
          airline_name: string | null
          arrival_at: string | null
          booking_reference: string | null
          client_id: string | null
          created_at: string | null
          departure_at: string | null
          destination_iata: string | null
          duffel_order_id: string
          eticket_data: Json | null
          eticket_numbers: string[] | null
          event_log: Json | null
          flight_numbers: string[] | null
          id: string
          last_event_at: string | null
          last_event_type: string | null
          order_status: string | null
          origin_iata: string | null
          passenger_emails: string[] | null
          passenger_names: string[] | null
          total_amount: number | null
          total_currency: string | null
          trip_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          airline_name?: string | null
          arrival_at?: string | null
          booking_reference?: string | null
          client_id?: string | null
          created_at?: string | null
          departure_at?: string | null
          destination_iata?: string | null
          duffel_order_id: string
          eticket_data?: Json | null
          eticket_numbers?: string[] | null
          event_log?: Json | null
          flight_numbers?: string[] | null
          id?: string
          last_event_at?: string | null
          last_event_type?: string | null
          order_status?: string | null
          origin_iata?: string | null
          passenger_emails?: string[] | null
          passenger_names?: string[] | null
          total_amount?: number | null
          total_currency?: string | null
          trip_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          airline_name?: string | null
          arrival_at?: string | null
          booking_reference?: string | null
          client_id?: string | null
          created_at?: string | null
          departure_at?: string | null
          destination_iata?: string | null
          duffel_order_id?: string
          eticket_data?: Json | null
          eticket_numbers?: string[] | null
          event_log?: Json | null
          flight_numbers?: string[] | null
          id?: string
          last_event_at?: string | null
          last_event_type?: string | null
          order_status?: string | null
          origin_iata?: string | null
          passenger_emails?: string[] | null
          passenger_names?: string[] | null
          total_amount?: number | null
          total_currency?: string | null
          trip_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      group_signups: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string | null
          notes: string | null
          number_of_travelers: number
          phone: string | null
          status: string
          sub_trip_id: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name?: string | null
          notes?: string | null
          number_of_travelers?: number
          phone?: string | null
          status?: string
          sub_trip_id?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string | null
          notes?: string | null
          number_of_travelers?: number
          phone?: string | null
          status?: string
          sub_trip_id?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_signups_sub_trip_id_fkey"
            columns: ["sub_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_signups_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      hotelbeds_api_usage: {
        Row: {
          day: string
          search_calls: number
          updated_at: string
        }
        Insert: {
          day: string
          search_calls?: number
          updated_at?: string
        }
        Update: {
          day?: string
          search_calls?: number
          updated_at?: string
        }
        Relationships: []
      }
      hotelbeds_hotels: {
        Row: {
          accommodation_type_code: string | null
          address: string | null
          category_code: string | null
          category_name: string | null
          chain_code: string | null
          city: string | null
          code: number
          country_code: string | null
          created_at: string
          description: string | null
          destination_code: string | null
          destination_name: string | null
          email: string | null
          facilities: Json | null
          images: Json | null
          last_synced_at: string
          latitude: number | null
          longitude: number | null
          name: string
          phones: Json | null
          postal_code: string | null
          raw: Json | null
          state_code: string | null
          updated_at: string
          web: string | null
          zone_code: string | null
        }
        Insert: {
          accommodation_type_code?: string | null
          address?: string | null
          category_code?: string | null
          category_name?: string | null
          chain_code?: string | null
          city?: string | null
          code: number
          country_code?: string | null
          created_at?: string
          description?: string | null
          destination_code?: string | null
          destination_name?: string | null
          email?: string | null
          facilities?: Json | null
          images?: Json | null
          last_synced_at?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          phones?: Json | null
          postal_code?: string | null
          raw?: Json | null
          state_code?: string | null
          updated_at?: string
          web?: string | null
          zone_code?: string | null
        }
        Update: {
          accommodation_type_code?: string | null
          address?: string | null
          category_code?: string | null
          category_name?: string | null
          chain_code?: string | null
          city?: string | null
          code?: number
          country_code?: string | null
          created_at?: string
          description?: string | null
          destination_code?: string | null
          destination_name?: string | null
          email?: string | null
          facilities?: Json | null
          images?: Json | null
          last_synced_at?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          phones?: Json | null
          postal_code?: string | null
          raw?: Json | null
          state_code?: string | null
          updated_at?: string
          web?: string | null
          zone_code?: string | null
        }
        Relationships: []
      }
      hotelbeds_search_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          payload: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          payload: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          payload?: Json
        }
        Relationships: []
      }
      hotelbeds_sync_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          hotels_processed: number
          hotels_upserted: number
          id: string
          pages_fetched: number
          started_at: string
          status: string
          triggered_by: string | null
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          hotels_processed?: number
          hotels_upserted?: number
          id?: string
          pages_fetched?: number
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          hotels_processed?: number
          hotels_upserted?: number
          id?: string
          pages_fetched?: number
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      ic_onboarding: {
        Row: {
          account_number: string | null
          address: string | null
          agent_dash_synced_at: string | null
          annual_sales_volume: string | null
          arc_number: string | null
          backup_advisor: string | null
          bank_name: string | null
          bio: string | null
          business_entity: string | null
          business_name: string | null
          city: string | null
          clia_number: string | null
          code_of_ethics_signed: boolean | null
          created_at: string
          crm_preference: string | null
          current_host: string | null
          data_consent_signed: boolean | null
          directory_consent: boolean | null
          dob: string | null
          ein: string | null
          email: string | null
          email_domain_preference: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          eo_carrier: string | null
          eo_expiry: string | null
          eo_policy_number: string | null
          facebook: string | null
          first_name: string | null
          has_eo: string | null
          has_transfer_bookings: string | null
          headshot_url: string | null
          hotel_programs: string | null
          iata_number: string | null
          ic_agreement_signed: boolean | null
          id: string
          id_number: string | null
          id_type: string | null
          instagram: string | null
          last_name: string | null
          marketing_consent: boolean | null
          media_release_signed: boolean | null
          needs_website: string | null
          own_domain: string | null
          payment_method: string | null
          phone: string | null
          routing_number: string | null
          seller_of_travel_number: string | null
          seller_of_travel_states: string | null
          signature: string | null
          signature_date: string | null
          specialties: string | null
          state: string | null
          status: string
          submitted_at: string
          supplier_notes: string | null
          supplier_portals: string | null
          top_destinations: string | null
          updated_at: string
          w9_submitted: boolean | null
          website: string | null
          years_experience: string | null
          zip: string | null
        }
        Insert: {
          account_number?: string | null
          address?: string | null
          agent_dash_synced_at?: string | null
          annual_sales_volume?: string | null
          arc_number?: string | null
          backup_advisor?: string | null
          bank_name?: string | null
          bio?: string | null
          business_entity?: string | null
          business_name?: string | null
          city?: string | null
          clia_number?: string | null
          code_of_ethics_signed?: boolean | null
          created_at?: string
          crm_preference?: string | null
          current_host?: string | null
          data_consent_signed?: boolean | null
          directory_consent?: boolean | null
          dob?: string | null
          ein?: string | null
          email?: string | null
          email_domain_preference?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          eo_carrier?: string | null
          eo_expiry?: string | null
          eo_policy_number?: string | null
          facebook?: string | null
          first_name?: string | null
          has_eo?: string | null
          has_transfer_bookings?: string | null
          headshot_url?: string | null
          hotel_programs?: string | null
          iata_number?: string | null
          ic_agreement_signed?: boolean | null
          id?: string
          id_number?: string | null
          id_type?: string | null
          instagram?: string | null
          last_name?: string | null
          marketing_consent?: boolean | null
          media_release_signed?: boolean | null
          needs_website?: string | null
          own_domain?: string | null
          payment_method?: string | null
          phone?: string | null
          routing_number?: string | null
          seller_of_travel_number?: string | null
          seller_of_travel_states?: string | null
          signature?: string | null
          signature_date?: string | null
          specialties?: string | null
          state?: string | null
          status?: string
          submitted_at?: string
          supplier_notes?: string | null
          supplier_portals?: string | null
          top_destinations?: string | null
          updated_at?: string
          w9_submitted?: boolean | null
          website?: string | null
          years_experience?: string | null
          zip?: string | null
        }
        Update: {
          account_number?: string | null
          address?: string | null
          agent_dash_synced_at?: string | null
          annual_sales_volume?: string | null
          arc_number?: string | null
          backup_advisor?: string | null
          bank_name?: string | null
          bio?: string | null
          business_entity?: string | null
          business_name?: string | null
          city?: string | null
          clia_number?: string | null
          code_of_ethics_signed?: boolean | null
          created_at?: string
          crm_preference?: string | null
          current_host?: string | null
          data_consent_signed?: boolean | null
          directory_consent?: boolean | null
          dob?: string | null
          ein?: string | null
          email?: string | null
          email_domain_preference?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          eo_carrier?: string | null
          eo_expiry?: string | null
          eo_policy_number?: string | null
          facebook?: string | null
          first_name?: string | null
          has_eo?: string | null
          has_transfer_bookings?: string | null
          headshot_url?: string | null
          hotel_programs?: string | null
          iata_number?: string | null
          ic_agreement_signed?: boolean | null
          id?: string
          id_number?: string | null
          id_type?: string | null
          instagram?: string | null
          last_name?: string | null
          marketing_consent?: boolean | null
          media_release_signed?: boolean | null
          needs_website?: string | null
          own_domain?: string | null
          payment_method?: string | null
          phone?: string | null
          routing_number?: string | null
          seller_of_travel_number?: string | null
          seller_of_travel_states?: string | null
          signature?: string | null
          signature_date?: string | null
          specialties?: string | null
          state?: string | null
          status?: string
          submitted_at?: string
          supplier_notes?: string | null
          supplier_portals?: string | null
          top_destinations?: string | null
          updated_at?: string
          w9_submitted?: boolean | null
          website?: string | null
          years_experience?: string | null
          zip?: string | null
        }
        Relationships: []
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
      inbox_processed_messages: {
        Row: {
          body_text: string | null
          classification: string | null
          error_message: string | null
          from_email: string | null
          from_name: string | null
          id: string
          itinerary_imported_at: string | null
          linked_booking_id: string | null
          linked_lead_id: string | null
          linked_trip_id: string | null
          processed_at: string
          proposed_action_id: string | null
          provider: string
          provider_message_id: string
          received_at: string | null
          subject: string | null
          thread_id: string | null
          user_id: string
        }
        Insert: {
          body_text?: string | null
          classification?: string | null
          error_message?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          itinerary_imported_at?: string | null
          linked_booking_id?: string | null
          linked_lead_id?: string | null
          linked_trip_id?: string | null
          processed_at?: string
          proposed_action_id?: string | null
          provider?: string
          provider_message_id: string
          received_at?: string | null
          subject?: string | null
          thread_id?: string | null
          user_id: string
        }
        Update: {
          body_text?: string | null
          classification?: string | null
          error_message?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          itinerary_imported_at?: string | null
          linked_booking_id?: string | null
          linked_lead_id?: string | null
          linked_trip_id?: string | null
          processed_at?: string
          proposed_action_id?: string | null
          provider?: string
          provider_message_id?: string
          received_at?: string | null
          subject?: string | null
          thread_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_processed_messages_proposed_action_id_fkey"
            columns: ["proposed_action_id"]
            isOneToOne: false
            referencedRelation: "ai_proposed_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_watched_mailboxes: {
        Row: {
          connection_id: string | null
          created_at: string
          email_address: string | null
          id: string
          is_active: boolean
          last_history_id: string | null
          last_synced_at: string | null
          paused_at: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          email_address?: string | null
          id?: string
          is_active?: boolean
          last_history_id?: string | null
          last_synced_at?: string | null
          paused_at?: string | null
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          email_address?: string | null
          id?: string
          is_active?: boolean
          last_history_id?: string | null
          last_synced_at?: string | null
          paused_at?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      intake_form_responses: {
        Row: {
          answers: Json
          client_id: string | null
          created_at: string
          form_id: string
          id: string
          submitter_email: string | null
          submitter_name: string | null
          trip_id: string | null
        }
        Insert: {
          answers?: Json
          client_id?: string | null
          created_at?: string
          form_id: string
          id?: string
          submitter_email?: string | null
          submitter_name?: string | null
          trip_id?: string | null
        }
        Update: {
          answers?: Json
          client_id?: string | null
          created_at?: string
          form_id?: string
          id?: string
          submitter_email?: string | null
          submitter_name?: string | null
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_form_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_form_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "intake_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_form_responses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_forms: {
        Row: {
          created_at: string
          description: string | null
          fields: Json
          id: string
          is_active: boolean
          slug: string
          thank_you_message: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          slug: string
          thank_you_message?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          slug?: string
          thank_you_message?: string | null
          title?: string
          updated_at?: string
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
      invoice_email_log: {
        Row: {
          amount: number | null
          client_id: string | null
          created_at: string
          due_date: string | null
          email_kind: string
          id: string
          invoice_id: string | null
          meta: Json | null
          qbo_invoice_id: string
          recipient_email: string
          resend_id: string | null
          sent_at: string
          trip_id: string | null
        }
        Insert: {
          amount?: number | null
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          email_kind: string
          id?: string
          invoice_id?: string | null
          meta?: Json | null
          qbo_invoice_id: string
          recipient_email: string
          resend_id?: string | null
          sent_at?: string
          trip_id?: string | null
        }
        Update: {
          amount?: number | null
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          email_kind?: string
          id?: string
          invoice_id?: string | null
          meta?: Json | null
          qbo_invoice_id?: string
          recipient_email?: string
          resend_id?: string | null
          sent_at?: string
          trip_id?: string | null
        }
        Relationships: []
      }
      invoice_line_items: {
        Row: {
          amount: number
          booking_id: string | null
          booking_name: string | null
          created_at: string
          description: string
          id: string
          invoice_id: string
          is_optional: boolean
          sort_order: number
        }
        Insert: {
          amount?: number
          booking_id?: string | null
          booking_name?: string | null
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          is_optional?: boolean
          sort_order?: number
        }
        Update: {
          amount?: number
          booking_id?: string | null
          booking_name?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          is_optional?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
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
      issued_cards: {
        Row: {
          agent_email: string
          agent_name: string
          amount_spent_cents: number | null
          booking_id: string | null
          booking_ref: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          card_type: string | null
          created_at: string | null
          currency: string | null
          expires_at: string
          id: string
          last_transaction_at: string | null
          purpose: string | null
          raw_stripe_response: Json | null
          spend_limit_cents: number
          status: string | null
          stripe_card_id: string
          stripe_card_number: string | null
          stripe_cardholder_id: string | null
          supplier_category: string | null
          supplier_name: string | null
          transaction_count: number | null
          trip_name: string | null
          updated_at: string | null
        }
        Insert: {
          agent_email: string
          agent_name: string
          amount_spent_cents?: number | null
          booking_id?: string | null
          booking_ref?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          card_type?: string | null
          created_at?: string | null
          currency?: string | null
          expires_at: string
          id?: string
          last_transaction_at?: string | null
          purpose?: string | null
          raw_stripe_response?: Json | null
          spend_limit_cents: number
          status?: string | null
          stripe_card_id: string
          stripe_card_number?: string | null
          stripe_cardholder_id?: string | null
          supplier_category?: string | null
          supplier_name?: string | null
          transaction_count?: number | null
          trip_name?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_email?: string
          agent_name?: string
          amount_spent_cents?: number | null
          booking_id?: string | null
          booking_ref?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          card_type?: string | null
          created_at?: string | null
          currency?: string | null
          expires_at?: string
          id?: string
          last_transaction_at?: string | null
          purpose?: string | null
          raw_stripe_response?: Json | null
          spend_limit_cents?: number
          status?: string | null
          stripe_card_id?: string
          stripe_card_number?: string | null
          stripe_cardholder_id?: string | null
          supplier_category?: string | null
          supplier_name?: string | null
          transaction_count?: number | null
          trip_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      itineraries: {
        Row: {
          cover_image_url: string | null
          created_at: string
          depart_date: string | null
          font_style: string | null
          header_style: string | null
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
          font_style?: string | null
          header_style?: string | null
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
          font_style?: string | null
          header_style?: string | null
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
          arrival_city_code: string | null
          booking_id: string | null
          booking_status: string | null
          category: string
          commission_amount: number | null
          confirmation_number: string | null
          created_at: string
          day_number: number
          departure_city_code: string | null
          description: string | null
          end_time: string | null
          flight_number: string | null
          flight_status: string | null
          gallery_urls: Json
          id: string
          image_url: string | null
          is_hidden: boolean
          item_date: string | null
          item_price: number | null
          itinerary_id: string | null
          location: string | null
          notes: string | null
          option_block_id: string | null
          sort_order: number
          start_time: string | null
          supplier_cost: number | null
          supplier_name: string | null
          thumbnail_url: string | null
          title: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arrival_city_code?: string | null
          booking_id?: string | null
          booking_status?: string | null
          category?: string
          commission_amount?: number | null
          confirmation_number?: string | null
          created_at?: string
          day_number: number
          departure_city_code?: string | null
          description?: string | null
          end_time?: string | null
          flight_number?: string | null
          flight_status?: string | null
          gallery_urls?: Json
          id?: string
          image_url?: string | null
          is_hidden?: boolean
          item_date?: string | null
          item_price?: number | null
          itinerary_id?: string | null
          location?: string | null
          notes?: string | null
          option_block_id?: string | null
          sort_order?: number
          start_time?: string | null
          supplier_cost?: number | null
          supplier_name?: string | null
          thumbnail_url?: string | null
          title: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arrival_city_code?: string | null
          booking_id?: string | null
          booking_status?: string | null
          category?: string
          commission_amount?: number | null
          confirmation_number?: string | null
          created_at?: string
          day_number?: number
          departure_city_code?: string | null
          description?: string | null
          end_time?: string | null
          flight_number?: string | null
          flight_status?: string | null
          gallery_urls?: Json
          id?: string
          image_url?: string | null
          is_hidden?: boolean
          item_date?: string | null
          item_price?: number | null
          itinerary_id?: string | null
          location?: string | null
          notes?: string | null
          option_block_id?: string | null
          sort_order?: number
          start_time?: string | null
          supplier_cost?: number | null
          supplier_name?: string | null
          thumbnail_url?: string | null
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
            foreignKeyName: "itinerary_items_option_block_id_fkey"
            columns: ["option_block_id"]
            isOneToOne: false
            referencedRelation: "option_blocks"
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
      lead_followups: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          resend_id: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          step: number
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          resend_id?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string
          step?: number
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          resend_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_magnet_subscribers: {
        Row: {
          city: string | null
          created_at: string | null
          email: string
          id: string
          name: string | null
          source: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          source?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          source?: string | null
        }
        Relationships: []
      }
      library_templates: {
        Row: {
          content: string | null
          created_at: string
          created_by: string
          description: string | null
          destination: string | null
          duration_days: number | null
          id: string
          is_archived: boolean
          is_shared: boolean
          kind: string
          name: string
          tags: string[]
          template_data: Json
          trip_type: string | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          destination?: string | null
          duration_days?: number | null
          id?: string
          is_archived?: boolean
          is_shared?: boolean
          kind?: string
          name: string
          tags?: string[]
          template_data?: Json
          trip_type?: string | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          destination?: string | null
          duration_days?: number | null
          id?: string
          is_archived?: boolean
          is_shared?: boolean
          kind?: string
          name?: string
          tags?: string[]
          template_data?: Json
          trip_type?: string | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      line_conversations: {
        Row: {
          assigned_agent_id: string | null
          client_id: string | null
          created_at: string
          display_name: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          line_user_id: string
          picture_url: string | null
          unread_count: number
        }
        Insert: {
          assigned_agent_id?: string | null
          client_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          line_user_id: string
          picture_url?: string | null
          unread_count?: number
        }
        Update: {
          assigned_agent_id?: string | null
          client_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          line_user_id?: string
          picture_url?: string | null
          unread_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "line_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      line_messages: {
        Row: {
          conversation_id: string
          created_at: string
          direction: string
          id: string
          message_type: string
          raw_line_message_id: string | null
          sent_by_agent_id: string | null
          text: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          message_type?: string
          raw_line_message_id?: string | null
          sent_by_agent_id?: string | null
          text?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          message_type?: string
          raw_line_message_id?: string | null
          sent_by_agent_id?: string | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "line_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "line_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_applications: {
        Row: {
          address_line1: string
          address_line2: string | null
          agent_notes: string | null
          alt_phone: string | null
          application_number: string | null
          approved_amount: number | null
          approved_rate: number | null
          approved_term_months: number | null
          assigned_to: string | null
          autopay_active: boolean | null
          autopay_esignature: string | null
          autopay_method: string | null
          autopay_signed_at: string | null
          autopay_start_date: string | null
          badge_color: string | null
          bankruptcy_details: string | null
          bankruptcy_history: boolean | null
          checking_account: boolean | null
          city: string
          client_message: string | null
          consent_autopay: boolean | null
          consent_credit_check: boolean
          consent_terms: boolean
          created_at: string | null
          date_of_birth: string
          decision: string | null
          decision_date: string | null
          decision_notes: string | null
          down_payment: number | null
          email: string
          employer_name: string | null
          employment_status: string
          environment: string | null
          equifax_checked_at: string | null
          equifax_client_message: string | null
          equifax_decision: string | null
          equifax_error: string | null
          equifax_raw: Json | null
          equifax_raw_response: Json | null
          equifax_reasons: Json | null
          equifax_score: number | null
          esignature: string | null
          first_name: string
          housing_status: string | null
          id: string
          ip_address: string | null
          job_title: string | null
          last_name: string
          loan_amount_requested: number
          loan_purpose: string | null
          monthly_car_payment: number | null
          monthly_income: number | null
          monthly_other_debt: number | null
          monthly_rent_mortgage: number | null
          other_income: number | null
          other_income_source: string | null
          phone: string | null
          preferred_term_months: number | null
          qbo_customer_id: string | null
          qbo_synced_at: string | null
          reference1_name: string | null
          reference1_phone: string | null
          reference1_relation: string | null
          reference2_name: string | null
          reference2_phone: string | null
          reference2_relation: string | null
          savings_account: boolean | null
          signed_at: string | null
          ssn_last_four: string | null
          state: string
          status: string | null
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          stripe_subscription_id: string | null
          travel_date: string | null
          trip_description: string | null
          updated_at: string | null
          user_agent: string | null
          years_at_address: string | null
          years_employed: string | null
          zip_code: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          agent_notes?: string | null
          alt_phone?: string | null
          application_number?: string | null
          approved_amount?: number | null
          approved_rate?: number | null
          approved_term_months?: number | null
          assigned_to?: string | null
          autopay_active?: boolean | null
          autopay_esignature?: string | null
          autopay_method?: string | null
          autopay_signed_at?: string | null
          autopay_start_date?: string | null
          badge_color?: string | null
          bankruptcy_details?: string | null
          bankruptcy_history?: boolean | null
          checking_account?: boolean | null
          city: string
          client_message?: string | null
          consent_autopay?: boolean | null
          consent_credit_check?: boolean
          consent_terms?: boolean
          created_at?: string | null
          date_of_birth: string
          decision?: string | null
          decision_date?: string | null
          decision_notes?: string | null
          down_payment?: number | null
          email: string
          employer_name?: string | null
          employment_status: string
          environment?: string | null
          equifax_checked_at?: string | null
          equifax_client_message?: string | null
          equifax_decision?: string | null
          equifax_error?: string | null
          equifax_raw?: Json | null
          equifax_raw_response?: Json | null
          equifax_reasons?: Json | null
          equifax_score?: number | null
          esignature?: string | null
          first_name: string
          housing_status?: string | null
          id?: string
          ip_address?: string | null
          job_title?: string | null
          last_name: string
          loan_amount_requested: number
          loan_purpose?: string | null
          monthly_car_payment?: number | null
          monthly_income?: number | null
          monthly_other_debt?: number | null
          monthly_rent_mortgage?: number | null
          other_income?: number | null
          other_income_source?: string | null
          phone?: string | null
          preferred_term_months?: number | null
          qbo_customer_id?: string | null
          qbo_synced_at?: string | null
          reference1_name?: string | null
          reference1_phone?: string | null
          reference1_relation?: string | null
          reference2_name?: string | null
          reference2_phone?: string | null
          reference2_relation?: string | null
          savings_account?: boolean | null
          signed_at?: string | null
          ssn_last_four?: string | null
          state: string
          status?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_subscription_id?: string | null
          travel_date?: string | null
          trip_description?: string | null
          updated_at?: string | null
          user_agent?: string | null
          years_at_address?: string | null
          years_employed?: string | null
          zip_code: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          agent_notes?: string | null
          alt_phone?: string | null
          application_number?: string | null
          approved_amount?: number | null
          approved_rate?: number | null
          approved_term_months?: number | null
          assigned_to?: string | null
          autopay_active?: boolean | null
          autopay_esignature?: string | null
          autopay_method?: string | null
          autopay_signed_at?: string | null
          autopay_start_date?: string | null
          badge_color?: string | null
          bankruptcy_details?: string | null
          bankruptcy_history?: boolean | null
          checking_account?: boolean | null
          city?: string
          client_message?: string | null
          consent_autopay?: boolean | null
          consent_credit_check?: boolean
          consent_terms?: boolean
          created_at?: string | null
          date_of_birth?: string
          decision?: string | null
          decision_date?: string | null
          decision_notes?: string | null
          down_payment?: number | null
          email?: string
          employer_name?: string | null
          employment_status?: string
          environment?: string | null
          equifax_checked_at?: string | null
          equifax_client_message?: string | null
          equifax_decision?: string | null
          equifax_error?: string | null
          equifax_raw?: Json | null
          equifax_raw_response?: Json | null
          equifax_reasons?: Json | null
          equifax_score?: number | null
          esignature?: string | null
          first_name?: string
          housing_status?: string | null
          id?: string
          ip_address?: string | null
          job_title?: string | null
          last_name?: string
          loan_amount_requested?: number
          loan_purpose?: string | null
          monthly_car_payment?: number | null
          monthly_income?: number | null
          monthly_other_debt?: number | null
          monthly_rent_mortgage?: number | null
          other_income?: number | null
          other_income_source?: string | null
          phone?: string | null
          preferred_term_months?: number | null
          qbo_customer_id?: string | null
          qbo_synced_at?: string | null
          reference1_name?: string | null
          reference1_phone?: string | null
          reference1_relation?: string | null
          reference2_name?: string | null
          reference2_phone?: string | null
          reference2_relation?: string | null
          savings_account?: boolean | null
          signed_at?: string | null
          ssn_last_four?: string | null
          state?: string
          status?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_subscription_id?: string | null
          travel_date?: string | null
          trip_description?: string | null
          updated_at?: string | null
          user_agent?: string | null
          years_at_address?: string | null
          years_employed?: string | null
          zip_code?: string
        }
        Relationships: []
      }
      loan_payment_schedules: {
        Row: {
          created_at: string
          due_date: string
          id: string
          interest_amount: number
          loan_application_id: string
          paid_date: string | null
          payment_number: number
          principal_amount: number
          qbo_interest_deposit_id: string | null
          qbo_invoice_id: string | null
          qbo_principal_deposit_id: string | null
          qbo_synced_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          total_payment: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          interest_amount?: number
          loan_application_id: string
          paid_date?: string | null
          payment_number: number
          principal_amount?: number
          qbo_interest_deposit_id?: string | null
          qbo_invoice_id?: string | null
          qbo_principal_deposit_id?: string | null
          qbo_synced_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          total_payment?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          interest_amount?: number
          loan_application_id?: string
          paid_date?: string | null
          payment_number?: number
          principal_amount?: number
          qbo_interest_deposit_id?: string | null
          qbo_invoice_id?: string | null
          qbo_principal_deposit_id?: string | null
          qbo_synced_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          total_payment?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_payment_schedules_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_image_assets: {
        Row: {
          alt_text: string | null
          created_at: string
          filename: string
          height: number | null
          id: string
          is_shared: boolean
          mime_type: string | null
          public_url: string
          size_bytes: number | null
          storage_path: string
          tags: string[] | null
          user_id: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          filename: string
          height?: number | null
          id?: string
          is_shared?: boolean
          mime_type?: string | null
          public_url: string
          size_bytes?: number | null
          storage_path: string
          tags?: string[] | null
          user_id: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          filename?: string
          height?: number | null
          id?: string
          is_shared?: boolean
          mime_type?: string | null
          public_url?: string
          size_bytes?: number | null
          storage_path?: string
          tags?: string[] | null
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      mentor_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean
          mentee_user_id: string
          mentor_user_id: string
          notes: string | null
          split_percent: number
          updated_at: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          mentee_user_id: string
          mentor_user_id: string
          notes?: string | null
          split_percent?: number
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          mentee_user_id?: string
          mentor_user_id?: string
          notes?: string | null
          split_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      msc_cabin_details: {
        Row: {
          category_code: string
          category_name: string | null
          created_at: string
          deck: string | null
          description: string | null
          experience: string | null
          id: string
          occupancy_max: number | null
          occupancy_min: number | null
          raw: Json | null
          ship_code: string
          updated_at: string
        }
        Insert: {
          category_code: string
          category_name?: string | null
          created_at?: string
          deck?: string | null
          description?: string | null
          experience?: string | null
          id?: string
          occupancy_max?: number | null
          occupancy_min?: number | null
          raw?: Json | null
          ship_code: string
          updated_at?: string
        }
        Update: {
          category_code?: string
          category_name?: string | null
          created_at?: string
          deck?: string | null
          description?: string | null
          experience?: string | null
          id?: string
          occupancy_max?: number | null
          occupancy_min?: number | null
          raw?: Json | null
          ship_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      msc_cruises: {
        Row: {
          area_code: string | null
          created_at: string
          cruise_id: string
          disembark_port_code: string | null
          embark_port_code: string | null
          id: string
          is_closed: boolean
          itinerary_name: string | null
          market_code: string
          nights: number | null
          raw: Json | null
          region_code: string | null
          return_date: string | null
          sail_date: string | null
          ship_code: string | null
          updated_at: string
        }
        Insert: {
          area_code?: string | null
          created_at?: string
          cruise_id: string
          disembark_port_code?: string | null
          embark_port_code?: string | null
          id?: string
          is_closed?: boolean
          itinerary_name?: string | null
          market_code?: string
          nights?: number | null
          raw?: Json | null
          region_code?: string | null
          return_date?: string | null
          sail_date?: string | null
          ship_code?: string | null
          updated_at?: string
        }
        Update: {
          area_code?: string | null
          created_at?: string
          cruise_id?: string
          disembark_port_code?: string | null
          embark_port_code?: string | null
          id?: string
          is_closed?: boolean
          itinerary_name?: string | null
          market_code?: string
          nights?: number | null
          raw?: Json | null
          region_code?: string | null
          return_date?: string | null
          sail_date?: string | null
          ship_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      msc_fares: {
        Row: {
          agency_code: string | null
          cabin_price: number | null
          category_code: string | null
          created_at: string
          cruise_id: string
          cruise_only: boolean
          currency_code: string
          fare_code: string
          fare_description: string | null
          gft_adult: number | null
          gft_child: number | null
          gft_infant: number | null
          id: string
          is_closed: boolean
          market_code: string
          ncf_included: boolean
          now_available: boolean
          occupancy_key: string
          price_type: string | null
          raw: Json | null
          service_charge_adult_promo: number | null
          service_charge_adult_standard: number | null
          service_charge_child_promo: number | null
          service_charge_child_standard: number | null
          source: string
          updated_at: string
        }
        Insert: {
          agency_code?: string | null
          cabin_price?: number | null
          category_code?: string | null
          created_at?: string
          cruise_id: string
          cruise_only?: boolean
          currency_code?: string
          fare_code: string
          fare_description?: string | null
          gft_adult?: number | null
          gft_child?: number | null
          gft_infant?: number | null
          id?: string
          is_closed?: boolean
          market_code?: string
          ncf_included?: boolean
          now_available?: boolean
          occupancy_key: string
          price_type?: string | null
          raw?: Json | null
          service_charge_adult_promo?: number | null
          service_charge_adult_standard?: number | null
          service_charge_child_promo?: number | null
          service_charge_child_standard?: number | null
          source?: string
          updated_at?: string
        }
        Update: {
          agency_code?: string | null
          cabin_price?: number | null
          category_code?: string | null
          created_at?: string
          cruise_id?: string
          cruise_only?: boolean
          currency_code?: string
          fare_code?: string
          fare_description?: string | null
          gft_adult?: number | null
          gft_child?: number | null
          gft_infant?: number | null
          id?: string
          is_closed?: boolean
          market_code?: string
          ncf_included?: boolean
          now_available?: boolean
          occupancy_key?: string
          price_type?: string | null
          raw?: Json | null
          service_charge_adult_promo?: number | null
          service_charge_adult_standard?: number | null
          service_charge_child_promo?: number | null
          service_charge_child_standard?: number | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      msc_flatfile_sync_runs: {
        Row: {
          created_at: string
          details: Json | null
          error_message: string | null
          file_name: string | null
          finished_at: string | null
          id: string
          market_code: string
          rows_processed: number
          rows_upserted: number
          source: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          error_message?: string | null
          file_name?: string | null
          finished_at?: string | null
          id?: string
          market_code?: string
          rows_processed?: number
          rows_upserted?: number
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          error_message?: string | null
          file_name?: string | null
          finished_at?: string | null
          id?: string
          market_code?: string
          rows_processed?: number
          rows_upserted?: number
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      msc_items: {
        Row: {
          applicability: string | null
          created_at: string
          cruise_id: string
          currency_code: string | null
          fare_code: string | null
          id: string
          item_code: string
          item_name: string | null
          item_type: string
          package_code: string | null
          pax_applicability: string | null
          price: number | null
          raw: Json | null
          updated_at: string
        }
        Insert: {
          applicability?: string | null
          created_at?: string
          cruise_id: string
          currency_code?: string | null
          fare_code?: string | null
          id?: string
          item_code: string
          item_name?: string | null
          item_type: string
          package_code?: string | null
          pax_applicability?: string | null
          price?: number | null
          raw?: Json | null
          updated_at?: string
        }
        Update: {
          applicability?: string | null
          created_at?: string
          cruise_id?: string
          currency_code?: string | null
          fare_code?: string | null
          id?: string
          item_code?: string
          item_name?: string | null
          item_type?: string
          package_code?: string | null
          pax_applicability?: string | null
          price?: number | null
          raw?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      msc_itineraries: {
        Row: {
          arrival_time: string | null
          at_sea: boolean
          created_at: string
          cruise_id: string
          day_date: string | null
          day_number: number
          departure_time: string | null
          id: string
          port_code: string | null
          raw: Json | null
          updated_at: string
        }
        Insert: {
          arrival_time?: string | null
          at_sea?: boolean
          created_at?: string
          cruise_id: string
          day_date?: string | null
          day_number: number
          departure_time?: string | null
          id?: string
          port_code?: string | null
          raw?: Json | null
          updated_at?: string
        }
        Update: {
          arrival_time?: string | null
          at_sea?: boolean
          created_at?: string
          cruise_id?: string
          day_date?: string | null
          day_number?: number
          departure_time?: string | null
          id?: string
          port_code?: string | null
          raw?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      msc_ports: {
        Row: {
          city_name: string | null
          country_code: string | null
          country_name: string | null
          created_at: string
          id: string
          language_code: string | null
          latitude: number | null
          longitude: number | null
          port_code: string
          port_name: string | null
          raw: Json | null
          region_code: string | null
          updated_at: string
        }
        Insert: {
          city_name?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          id?: string
          language_code?: string | null
          latitude?: number | null
          longitude?: number | null
          port_code: string
          port_name?: string | null
          raw?: Json | null
          region_code?: string | null
          updated_at?: string
        }
        Update: {
          city_name?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          id?: string
          language_code?: string | null
          latitude?: number | null
          longitude?: number | null
          port_code?: string
          port_name?: string | null
          raw?: Json | null
          region_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      msc_ships: {
        Row: {
          brand: string | null
          capacity: number | null
          created_at: string
          id: string
          raw: Json | null
          ship_code: string
          ship_name: string | null
          tonnage: number | null
          updated_at: string
          year_built: number | null
        }
        Insert: {
          brand?: string | null
          capacity?: number | null
          created_at?: string
          id?: string
          raw?: Json | null
          ship_code: string
          ship_name?: string | null
          tonnage?: number | null
          updated_at?: string
          year_built?: number | null
        }
        Update: {
          brand?: string | null
          capacity?: number | null
          created_at?: string
          id?: string
          raw?: Json | null
          ship_code?: string
          ship_name?: string | null
          tonnage?: number | null
          updated_at?: string
          year_built?: number | null
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          active: boolean | null
          created_at: string | null
          email: string
          id: string
          source: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          source?: string | null
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
      option_blocks: {
        Row: {
          created_at: string
          day_number: number
          id: string
          itinerary_id: string | null
          sort_order: number
          title: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_number?: number
          id?: string
          itinerary_id?: string | null
          sort_order?: number
          title?: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_number?: number
          id?: string
          itinerary_id?: string | null
          sort_order?: number
          title?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "option_blocks_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "option_blocks_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_ip_logs: {
        Row: {
          amount_cents: number | null
          booking_id: string | null
          checkout_payment_id: string | null
          client_id: string | null
          country: string | null
          created_at: string
          currency: string | null
          customer_email: string | null
          failure_reason: string | null
          flag_reason: string | null
          flagged: boolean | null
          id: string
          ip_address: unknown
          last_four: string | null
          metadata: Json
          outcome: string | null
          page: string | null
          referer: string | null
          risk_flags: string[]
          risk_score: number
          stripe_payment_intent_id: string | null
          stripe_payment_method_id: string | null
          stripe_pm_id: string | null
          trip_id: string | null
          user_agent: string | null
        }
        Insert: {
          amount_cents?: number | null
          booking_id?: string | null
          checkout_payment_id?: string | null
          client_id?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          failure_reason?: string | null
          flag_reason?: string | null
          flagged?: boolean | null
          id?: string
          ip_address?: unknown
          last_four?: string | null
          metadata?: Json
          outcome?: string | null
          page?: string | null
          referer?: string | null
          risk_flags?: string[]
          risk_score?: number
          stripe_payment_intent_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_pm_id?: string | null
          trip_id?: string | null
          user_agent?: string | null
        }
        Update: {
          amount_cents?: number | null
          booking_id?: string | null
          checkout_payment_id?: string | null
          client_id?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          failure_reason?: string | null
          flag_reason?: string | null
          flagged?: boolean | null
          id?: string
          ip_address?: unknown
          last_four?: string | null
          metadata?: Json
          outcome?: string | null
          page?: string | null
          referer?: string | null
          risk_flags?: string[]
          risk_score?: number
          stripe_payment_intent_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_pm_id?: string | null
          trip_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      period_locks: {
        Row: {
          created_at: string | null
          id: string
          locked_at: string
          locked_by: string | null
          notes: string | null
          period_month: number
          period_year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          locked_at?: string
          locked_by?: string | null
          notes?: string | null
          period_month: number
          period_year: number
        }
        Update: {
          created_at?: string | null
          id?: string
          locked_at?: string
          locked_by?: string | null
          notes?: string | null
          period_month?: number
          period_year?: number
        }
        Relationships: []
      }
      portal_client_settings: {
        Row: {
          client_id: string
          created_at: string
          id: string
          portal_enabled: boolean
          updated_at: string
          user_id: string
          visible_sections: string[]
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          portal_enabled?: boolean
          updated_at?: string
          user_id: string
          visible_sections?: string[]
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          portal_enabled?: boolean
          updated_at?: string
          user_id?: string
          visible_sections?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "portal_client_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_client_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
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
          address_city: string | null
          address_line1: string | null
          address_state: string | null
          address_zip: string | null
          agency_name: string | null
          asta_number: string | null
          avatar_url: string | null
          booking_contact_phone: string | null
          booking_enabled: boolean
          booking_instructions: string | null
          booking_slug: string | null
          booking_timezone: string
          ccra_number: string | null
          clia_number: string | null
          commission_rate: number | null
          commission_tier: Database["public"]["Enums"]["commission_tier"] | null
          created_at: string
          date_of_birth: string | null
          default_split_payers: number
          default_split_payments: boolean
          embarc_number: string | null
          full_name: string | null
          id: string
          job_title: string | null
          legal_first_name: string | null
          legal_last_name: string | null
          phone: string | null
          storefront_bio: string | null
          storefront_email: string | null
          storefront_enabled: boolean
          storefront_headline: string | null
          storefront_logo_url: string | null
          storefront_slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_city?: string | null
          address_line1?: string | null
          address_state?: string | null
          address_zip?: string | null
          agency_name?: string | null
          asta_number?: string | null
          avatar_url?: string | null
          booking_contact_phone?: string | null
          booking_enabled?: boolean
          booking_instructions?: string | null
          booking_slug?: string | null
          booking_timezone?: string
          ccra_number?: string | null
          clia_number?: string | null
          commission_rate?: number | null
          commission_tier?:
            | Database["public"]["Enums"]["commission_tier"]
            | null
          created_at?: string
          date_of_birth?: string | null
          default_split_payers?: number
          default_split_payments?: boolean
          embarc_number?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          legal_first_name?: string | null
          legal_last_name?: string | null
          phone?: string | null
          storefront_bio?: string | null
          storefront_email?: string | null
          storefront_enabled?: boolean
          storefront_headline?: string | null
          storefront_logo_url?: string | null
          storefront_slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_city?: string | null
          address_line1?: string | null
          address_state?: string | null
          address_zip?: string | null
          agency_name?: string | null
          asta_number?: string | null
          avatar_url?: string | null
          booking_contact_phone?: string | null
          booking_enabled?: boolean
          booking_instructions?: string | null
          booking_slug?: string | null
          booking_timezone?: string
          ccra_number?: string | null
          clia_number?: string | null
          commission_rate?: number | null
          commission_tier?:
            | Database["public"]["Enums"]["commission_tier"]
            | null
          created_at?: string
          date_of_birth?: string | null
          default_split_payers?: number
          default_split_payments?: boolean
          embarc_number?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          legal_first_name?: string | null
          legal_last_name?: string | null
          phone?: string | null
          storefront_bio?: string | null
          storefront_email?: string | null
          storefront_enabled?: boolean
          storefront_headline?: string | null
          storefront_logo_url?: string | null
          storefront_slug?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_expedition_bookings: {
        Row: {
          agent_id: string
          client_id: string | null
          commission: number | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          destination: string | null
          id: string
          net_price: number | null
          notes: string | null
          pe_booking_ref: string | null
          pe_product_id: string
          product_title: string
          raw_response: Json | null
          status: string
          total_price: number
          travel_date: string | null
          travelers: number
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string
          client_id?: string | null
          commission?: number | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          destination?: string | null
          id?: string
          net_price?: number | null
          notes?: string | null
          pe_booking_ref?: string | null
          pe_product_id: string
          product_title: string
          raw_response?: Json | null
          status?: string
          total_price?: number
          travel_date?: string | null
          travelers?: number
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          client_id?: string | null
          commission?: number | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          destination?: string | null
          id?: string
          net_price?: number | null
          notes?: string | null
          pe_booking_ref?: string | null
          pe_product_id?: string
          product_title?: string
          raw_response?: Json | null
          status?: string
          total_price?: number
          travel_date?: string | null
          travelers?: number
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_expedition_bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expedition_bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expedition_bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_account_mappings: {
        Row: {
          qbo_account_id: string
          qbo_account_name: string | null
          role: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          qbo_account_id: string
          qbo_account_name?: string | null
          role: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          qbo_account_id?: string
          qbo_account_name?: string | null
          role?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      qbo_accounts: {
        Row: {
          account_sub_type: string | null
          account_type: string | null
          active: boolean | null
          created_at: string | null
          id: string
          name: string | null
          qbo_id: string
          raw_payload: Json | null
          synced_at: string | null
        }
        Insert: {
          account_sub_type?: string | null
          account_type?: string | null
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string | null
          qbo_id: string
          raw_payload?: Json | null
          synced_at?: string | null
        }
        Update: {
          account_sub_type?: string | null
          account_type?: string | null
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string | null
          qbo_id?: string
          raw_payload?: Json | null
          synced_at?: string | null
        }
        Relationships: []
      }
      qbo_agent_vendor_mappings: {
        Row: {
          agent_user_id: string
          created_at: string
          id: string
          last_synced_at: string | null
          qbo_realm_id: string | null
          qbo_vendor_id: string
          updated_at: string
          vendor_display_name: string | null
        }
        Insert: {
          agent_user_id: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          qbo_realm_id?: string | null
          qbo_vendor_id: string
          updated_at?: string
          vendor_display_name?: string | null
        }
        Update: {
          agent_user_id?: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          qbo_realm_id?: string | null
          qbo_vendor_id?: string
          updated_at?: string
          vendor_display_name?: string | null
        }
        Relationships: []
      }
      qbo_bill_payments: {
        Row: {
          created_at: string | null
          id: string
          payment_ref_num: string | null
          qbo_bill_id: string | null
          qbo_id: string
          qbo_vendor_id: string | null
          raw_payload: Json | null
          sync_token: string | null
          synced_at: string | null
          total_amt: number | null
          trigger_managed: boolean | null
          txn_date: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          payment_ref_num?: string | null
          qbo_bill_id?: string | null
          qbo_id: string
          qbo_vendor_id?: string | null
          raw_payload?: Json | null
          sync_token?: string | null
          synced_at?: string | null
          total_amt?: number | null
          trigger_managed?: boolean | null
          txn_date?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          payment_ref_num?: string | null
          qbo_bill_id?: string | null
          qbo_id?: string
          qbo_vendor_id?: string | null
          raw_payload?: Json | null
          sync_token?: string | null
          synced_at?: string | null
          total_amt?: number | null
          trigger_managed?: boolean | null
          txn_date?: string | null
        }
        Relationships: []
      }
      qbo_bills: {
        Row: {
          balance: number | null
          created_at: string | null
          crm_supplier_payment_id: string | null
          doc_number: string | null
          due_date: string | null
          id: string
          qbo_id: string
          qbo_vendor_id: string | null
          raw_payload: Json | null
          status: string | null
          sync_token: string | null
          synced_at: string | null
          total_amt: number | null
          trigger_managed: boolean | null
          txn_date: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          crm_supplier_payment_id?: string | null
          doc_number?: string | null
          due_date?: string | null
          id?: string
          qbo_id: string
          qbo_vendor_id?: string | null
          raw_payload?: Json | null
          status?: string | null
          sync_token?: string | null
          synced_at?: string | null
          total_amt?: number | null
          trigger_managed?: boolean | null
          txn_date?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          crm_supplier_payment_id?: string | null
          doc_number?: string | null
          due_date?: string | null
          id?: string
          qbo_id?: string
          qbo_vendor_id?: string | null
          raw_payload?: Json | null
          status?: string | null
          sync_token?: string | null
          synced_at?: string | null
          total_amt?: number | null
          trigger_managed?: boolean | null
          txn_date?: string | null
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
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
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
          default_bank_account_id: string | null
          default_bank_account_name: string | null
          default_cc_account_id: string | null
          default_cc_account_name: string | null
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
          default_bank_account_id?: string | null
          default_bank_account_name?: string | null
          default_cc_account_id?: string | null
          default_cc_account_name?: string | null
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
          default_bank_account_id?: string | null
          default_bank_account_name?: string | null
          default_cc_account_id?: string | null
          default_cc_account_name?: string | null
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
      qbo_customers: {
        Row: {
          active: boolean | null
          created_at: string | null
          crm_client_id: string | null
          display_name: string | null
          email: string | null
          id: string
          qbo_id: string
          raw_payload: Json | null
          sync_token: string | null
          synced_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          crm_client_id?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          qbo_id: string
          raw_payload?: Json | null
          sync_token?: string | null
          synced_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          crm_client_id?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          qbo_id?: string
          raw_payload?: Json | null
          sync_token?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qbo_customers_crm_client_id_fkey"
            columns: ["crm_client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qbo_customers_crm_client_id_fkey"
            columns: ["crm_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_deposits: {
        Row: {
          created_at: string | null
          deposit_to_account_id: string | null
          id: string
          memo: string | null
          qbo_id: string
          raw_payload: Json | null
          sync_token: string | null
          synced_at: string | null
          total_amt: number | null
          trigger_managed: boolean | null
          txn_date: string | null
        }
        Insert: {
          created_at?: string | null
          deposit_to_account_id?: string | null
          id?: string
          memo?: string | null
          qbo_id: string
          raw_payload?: Json | null
          sync_token?: string | null
          synced_at?: string | null
          total_amt?: number | null
          trigger_managed?: boolean | null
          txn_date?: string | null
        }
        Update: {
          created_at?: string | null
          deposit_to_account_id?: string | null
          id?: string
          memo?: string | null
          qbo_id?: string
          raw_payload?: Json | null
          sync_token?: string | null
          synced_at?: string | null
          total_amt?: number | null
          trigger_managed?: boolean | null
          txn_date?: string | null
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
      qbo_invoices: {
        Row: {
          balance: number | null
          created_at: string | null
          crm_booking_id: string | null
          doc_number: string | null
          due_date: string | null
          id: string
          qbo_customer_id: string | null
          qbo_id: string
          raw_payload: Json | null
          status: string | null
          sync_token: string | null
          synced_at: string | null
          total_amt: number | null
          trigger_managed: boolean | null
          txn_date: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          crm_booking_id?: string | null
          doc_number?: string | null
          due_date?: string | null
          id?: string
          qbo_customer_id?: string | null
          qbo_id: string
          raw_payload?: Json | null
          status?: string | null
          sync_token?: string | null
          synced_at?: string | null
          total_amt?: number | null
          trigger_managed?: boolean | null
          txn_date?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          crm_booking_id?: string | null
          doc_number?: string | null
          due_date?: string | null
          id?: string
          qbo_customer_id?: string | null
          qbo_id?: string
          raw_payload?: Json | null
          status?: string | null
          sync_token?: string | null
          synced_at?: string | null
          total_amt?: number | null
          trigger_managed?: boolean | null
          txn_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qbo_invoices_crm_booking_id_fkey"
            columns: ["crm_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_payment_review_decisions: {
        Row: {
          created_at: string
          decision: string
          id: string
          notes: string | null
          qbo_payment_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          target_qbo_invoice_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision?: string
          id?: string
          notes?: string | null
          qbo_payment_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          target_qbo_invoice_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          notes?: string | null
          qbo_payment_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          target_qbo_invoice_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qbo_payments: {
        Row: {
          created_at: string | null
          crm_payment_id: string | null
          id: string
          payment_ref_num: string | null
          qbo_customer_id: string | null
          qbo_id: string
          qbo_invoice_id: string | null
          raw_payload: Json | null
          sync_token: string | null
          synced_at: string | null
          total_amt: number | null
          trigger_managed: boolean | null
          txn_date: string | null
        }
        Insert: {
          created_at?: string | null
          crm_payment_id?: string | null
          id?: string
          payment_ref_num?: string | null
          qbo_customer_id?: string | null
          qbo_id: string
          qbo_invoice_id?: string | null
          raw_payload?: Json | null
          sync_token?: string | null
          synced_at?: string | null
          total_amt?: number | null
          trigger_managed?: boolean | null
          txn_date?: string | null
        }
        Update: {
          created_at?: string | null
          crm_payment_id?: string | null
          id?: string
          payment_ref_num?: string | null
          qbo_customer_id?: string | null
          qbo_id?: string
          qbo_invoice_id?: string | null
          raw_payload?: Json | null
          sync_token?: string | null
          synced_at?: string | null
          total_amt?: number | null
          trigger_managed?: boolean | null
          txn_date?: string | null
        }
        Relationships: []
      }
      qbo_report_cache: {
        Row: {
          created_at: string
          data: Json
          fetched_at: string
          id: string
          period_month: number
          period_year: number
          report_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          fetched_at?: string
          id?: string
          period_month: number
          period_year: number
          report_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          fetched_at?: string
          id?: string
          period_month?: number
          period_year?: number
          report_type?: string
          user_id?: string
        }
        Relationships: []
      }
      qbo_supplier_mappings: {
        Row: {
          created_at: string
          id: string
          qbo_vendor_id: string
          supplier_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          qbo_vendor_id: string
          supplier_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          qbo_vendor_id?: string
          supplier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qbo_supplier_mappings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_suppliers_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qbo_supplier_mappings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
          idempotency_key: string | null
          linked_log_id: string | null
          records_processed: number
          retry_count: number
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
          idempotency_key?: string | null
          linked_log_id?: string | null
          records_processed?: number
          retry_count?: number
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
          idempotency_key?: string | null
          linked_log_id?: string | null
          records_processed?: number
          retry_count?: number
          status?: string
          sync_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qbo_sync_logs_linked_log_id_fkey"
            columns: ["linked_log_id"]
            isOneToOne: false
            referencedRelation: "qbo_sync_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_vendors: {
        Row: {
          active: boolean | null
          created_at: string | null
          crm_supplier_id: string | null
          display_name: string | null
          email: string | null
          id: string
          qbo_id: string
          raw_payload: Json | null
          sync_token: string | null
          synced_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          crm_supplier_id?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          qbo_id: string
          raw_payload?: Json | null
          sync_token?: string | null
          synced_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          crm_supplier_id?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          qbo_id?: string
          raw_payload?: Json | null
          sync_token?: string | null
          synced_at?: string | null
        }
        Relationships: []
      }
      quote_requests: {
        Row: {
          ai_next_action: string | null
          ai_processed_at: string | null
          ai_score: number | null
          ai_stage: string | null
          ai_summary: string | null
          ai_tags: string[] | null
          assigned_agent_id: string | null
          assigned_at: string | null
          budget: string | null
          converted_trip_id: string | null
          created_at: string | null
          departure_date: string | null
          destination: string | null
          email: string
          first_name: string
          flexibility: string | null
          funnel_id: string | null
          funnel_name: string | null
          funnel_slug: string | null
          gclid: string | null
          group_type: string | null
          id: string
          last_name: string
          lead_source: string | null
          message: string | null
          phone: string | null
          proposal_approved_at: string | null
          proposal_draft: string | null
          proposal_expires_at: string | null
          proposal_options: Json | null
          proposal_sent_at: string | null
          proposal_status: string | null
          proposal_token: string | null
          proposal_viewed_at: string | null
          raw_answers: Json | null
          referral_source: string | null
          selected_option: string | null
          sequence_paused: boolean | null
          sequence_started: boolean | null
          status: string | null
          travelers_adults: number
          travelers_children: number
          trip_type: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          wants_financing: boolean | null
        }
        Insert: {
          ai_next_action?: string | null
          ai_processed_at?: string | null
          ai_score?: number | null
          ai_stage?: string | null
          ai_summary?: string | null
          ai_tags?: string[] | null
          assigned_agent_id?: string | null
          assigned_at?: string | null
          budget?: string | null
          converted_trip_id?: string | null
          created_at?: string | null
          departure_date?: string | null
          destination?: string | null
          email: string
          first_name: string
          flexibility?: string | null
          funnel_id?: string | null
          funnel_name?: string | null
          funnel_slug?: string | null
          gclid?: string | null
          group_type?: string | null
          id?: string
          last_name: string
          lead_source?: string | null
          message?: string | null
          phone?: string | null
          proposal_approved_at?: string | null
          proposal_draft?: string | null
          proposal_expires_at?: string | null
          proposal_options?: Json | null
          proposal_sent_at?: string | null
          proposal_status?: string | null
          proposal_token?: string | null
          proposal_viewed_at?: string | null
          raw_answers?: Json | null
          referral_source?: string | null
          selected_option?: string | null
          sequence_paused?: boolean | null
          sequence_started?: boolean | null
          status?: string | null
          travelers_adults?: number
          travelers_children?: number
          trip_type: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          wants_financing?: boolean | null
        }
        Update: {
          ai_next_action?: string | null
          ai_processed_at?: string | null
          ai_score?: number | null
          ai_stage?: string | null
          ai_summary?: string | null
          ai_tags?: string[] | null
          assigned_agent_id?: string | null
          assigned_at?: string | null
          budget?: string | null
          converted_trip_id?: string | null
          created_at?: string | null
          departure_date?: string | null
          destination?: string | null
          email?: string
          first_name?: string
          flexibility?: string | null
          funnel_id?: string | null
          funnel_name?: string | null
          funnel_slug?: string | null
          gclid?: string | null
          group_type?: string | null
          id?: string
          last_name?: string
          lead_source?: string | null
          message?: string | null
          phone?: string | null
          proposal_approved_at?: string | null
          proposal_draft?: string | null
          proposal_expires_at?: string | null
          proposal_options?: Json | null
          proposal_sent_at?: string | null
          proposal_status?: string | null
          proposal_token?: string | null
          proposal_viewed_at?: string | null
          raw_answers?: Json | null
          referral_source?: string | null
          selected_option?: string | null
          sequence_paused?: boolean | null
          sequence_started?: boolean | null
          status?: string | null
          travelers_adults?: number
          travelers_children?: number
          trip_type?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          wants_financing?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_converted_trip_id_fkey"
            columns: ["converted_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          approved_at: string | null
          created_at: string
          currency: string
          id: string
          price: number
          sent_at: string | null
          status: string
          supplier_id: string | null
          trip_id: string | null
          updated_at: string
          user_id: string
          view_count: number
          viewed_at: string | null
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          price?: number
          sent_at?: string | null
          status?: string
          supplier_id?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id: string
          view_count?: number
          viewed_at?: string | null
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          price?: number
          sent_at?: string | null
          status?: string
          supplier_id?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id?: string
          view_count?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_suppliers_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      recon_account_config: {
        Row: {
          allow_auto_post: boolean | null
          amount_tolerance: number | null
          ap_account_id: string | null
          approval_required_above: number | null
          ar_account_id: string | null
          auto_match_threshold: number | null
          closed_period_cutoff: string | null
          company_id: string | null
          date_window_days: number | null
          default_vendor_payment_account_id: string | null
          id: string
          qbo_bank_account_id: string | null
          stripe_clearing_account_id: string | null
          stripe_fees_account_id: string | null
          undeposited_funds_account_id: string | null
          updated_at: string | null
        }
        Insert: {
          allow_auto_post?: boolean | null
          amount_tolerance?: number | null
          ap_account_id?: string | null
          approval_required_above?: number | null
          ar_account_id?: string | null
          auto_match_threshold?: number | null
          closed_period_cutoff?: string | null
          company_id?: string | null
          date_window_days?: number | null
          default_vendor_payment_account_id?: string | null
          id?: string
          qbo_bank_account_id?: string | null
          stripe_clearing_account_id?: string | null
          stripe_fees_account_id?: string | null
          undeposited_funds_account_id?: string | null
          updated_at?: string | null
        }
        Update: {
          allow_auto_post?: boolean | null
          amount_tolerance?: number | null
          ap_account_id?: string | null
          approval_required_above?: number | null
          ar_account_id?: string | null
          auto_match_threshold?: number | null
          closed_period_cutoff?: string | null
          company_id?: string | null
          date_window_days?: number | null
          default_vendor_payment_account_id?: string | null
          id?: string
          qbo_bank_account_id?: string | null
          stripe_clearing_account_id?: string | null
          stripe_fees_account_id?: string | null
          undeposited_funds_account_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      recon_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string | null
          id: string
          ip_address: string | null
          qbo_object_id: string | null
          qbo_response_id: string | null
          record_id: string | null
          record_type: string | null
          source_event_id: string | null
          source_system: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          qbo_object_id?: string | null
          qbo_response_id?: string | null
          record_id?: string | null
          record_type?: string | null
          source_event_id?: string | null
          source_system?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          qbo_object_id?: string | null
          qbo_response_id?: string | null
          record_id?: string | null
          record_type?: string | null
          source_event_id?: string | null
          source_system?: string | null
        }
        Relationships: []
      }
      recon_dead_letter_queue: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string | null
          id: string
          last_retry_at: string | null
          max_retries: number | null
          payload: Json | null
          retry_count: number | null
          source_system: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number | null
          payload?: Json | null
          retry_count?: number | null
          source_system?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number | null
          payload?: Json | null
          retry_count?: number | null
          source_system?: string | null
          status?: string | null
        }
        Relationships: []
      }
      recon_entity_mappings: {
        Row: {
          created_at: string | null
          crm_id: string | null
          id: string
          mapping_type: string
          qbo_id: string | null
          stripe_id: string | null
          updated_at: string | null
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          crm_id?: string | null
          id?: string
          mapping_type: string
          qbo_id?: string | null
          stripe_id?: string | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          crm_id?: string | null
          id?: string
          mapping_type?: string
          qbo_id?: string | null
          stripe_id?: string | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      recon_matches: {
        Row: {
          amount_variance: number | null
          approved_at: string | null
          approved_by: string | null
          auto_matched: boolean | null
          confidence_score: number | null
          created_at: string | null
          crm_amount: number | null
          crm_booking_id: string | null
          crm_date: string | null
          crm_payment_id: string | null
          crm_supplier_payment_id: string | null
          date_variance_days: number | null
          id: string
          match_explanation: string | null
          match_type: string
          qbo_amount: number | null
          qbo_bill_id: string | null
          qbo_bill_payment_id: string | null
          qbo_date: string | null
          qbo_deposit_id: string | null
          qbo_invoice_id: string | null
          qbo_payment_id: string | null
          recommended_action: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          score_breakdown: Json | null
          status: string | null
          stripe_amount: number | null
          stripe_date: string | null
          stripe_payment_id: string | null
          stripe_payout_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount_variance?: number | null
          approved_at?: string | null
          approved_by?: string | null
          auto_matched?: boolean | null
          confidence_score?: number | null
          created_at?: string | null
          crm_amount?: number | null
          crm_booking_id?: string | null
          crm_date?: string | null
          crm_payment_id?: string | null
          crm_supplier_payment_id?: string | null
          date_variance_days?: number | null
          id?: string
          match_explanation?: string | null
          match_type: string
          qbo_amount?: number | null
          qbo_bill_id?: string | null
          qbo_bill_payment_id?: string | null
          qbo_date?: string | null
          qbo_deposit_id?: string | null
          qbo_invoice_id?: string | null
          qbo_payment_id?: string | null
          recommended_action?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score_breakdown?: Json | null
          status?: string | null
          stripe_amount?: number | null
          stripe_date?: string | null
          stripe_payment_id?: string | null
          stripe_payout_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_variance?: number | null
          approved_at?: string | null
          approved_by?: string | null
          auto_matched?: boolean | null
          confidence_score?: number | null
          created_at?: string | null
          crm_amount?: number | null
          crm_booking_id?: string | null
          crm_date?: string | null
          crm_payment_id?: string | null
          crm_supplier_payment_id?: string | null
          date_variance_days?: number | null
          id?: string
          match_explanation?: string | null
          match_type?: string
          qbo_amount?: number | null
          qbo_bill_id?: string | null
          qbo_bill_payment_id?: string | null
          qbo_date?: string | null
          qbo_deposit_id?: string | null
          qbo_invoice_id?: string | null
          qbo_payment_id?: string | null
          recommended_action?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score_breakdown?: Json | null
          status?: string | null
          stripe_amount?: number | null
          stripe_date?: string | null
          stripe_payment_id?: string | null
          stripe_payout_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recon_matches_crm_booking_id_fkey"
            columns: ["crm_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recon_matches_qbo_bill_id_fkey"
            columns: ["qbo_bill_id"]
            isOneToOne: false
            referencedRelation: "qbo_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recon_matches_qbo_bill_payment_id_fkey"
            columns: ["qbo_bill_payment_id"]
            isOneToOne: false
            referencedRelation: "qbo_bill_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recon_matches_qbo_deposit_id_fkey"
            columns: ["qbo_deposit_id"]
            isOneToOne: false
            referencedRelation: "qbo_deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recon_matches_qbo_invoice_id_fkey"
            columns: ["qbo_invoice_id"]
            isOneToOne: false
            referencedRelation: "qbo_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recon_matches_qbo_payment_id_fkey"
            columns: ["qbo_payment_id"]
            isOneToOne: false
            referencedRelation: "qbo_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recon_matches_stripe_payment_id_fkey"
            columns: ["stripe_payment_id"]
            isOneToOne: false
            referencedRelation: "stripe_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recon_matches_stripe_payout_id_fkey"
            columns: ["stripe_payout_id"]
            isOneToOne: false
            referencedRelation: "stripe_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_alerts: {
        Row: {
          alert_type: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rental_payment_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          rental_id: string
          token: string
          used: boolean
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          rental_id: string
          token: string
          used?: boolean
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          rental_id?: string
          token?: string
          used?: boolean
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_payment_tokens_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "car_rental_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      secure_links: {
        Row: {
          active: boolean | null
          agent_user_id: string | null
          amount: number | null
          booking_ref: string | null
          client_email: string
          client_name: string
          created_at: string | null
          created_by: string | null
          expires_at: string
          id: string
          link_type: string
          notes: string | null
          payment_type: string | null
          single_use: boolean | null
          token: string
          trip_name: string | null
          trip_payment_id: string | null
          used_at: string | null
          used_ip: string | null
        }
        Insert: {
          active?: boolean | null
          agent_user_id?: string | null
          amount?: number | null
          booking_ref?: string | null
          client_email: string
          client_name: string
          created_at?: string | null
          created_by?: string | null
          expires_at: string
          id?: string
          link_type: string
          notes?: string | null
          payment_type?: string | null
          single_use?: boolean | null
          token: string
          trip_name?: string | null
          trip_payment_id?: string | null
          used_at?: string | null
          used_ip?: string | null
        }
        Update: {
          active?: boolean | null
          agent_user_id?: string | null
          amount?: number | null
          booking_ref?: string | null
          client_email?: string
          client_name?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          link_type?: string
          notes?: string | null
          payment_type?: string | null
          single_use?: boolean | null
          token?: string
          trip_name?: string | null
          trip_payment_id?: string | null
          used_at?: string | null
          used_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secure_links_trip_payment_id_fkey"
            columns: ["trip_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secure_links_trip_payment_id_fkey"
            columns: ["trip_payment_id"]
            isOneToOne: false
            referencedRelation: "trip_payments"
            referencedColumns: ["id"]
          },
        ]
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
      stripe_disputes: {
        Row: {
          amount: number | null
          created_at: string | null
          id: string
          raw_payload: Json | null
          reason: string | null
          status: string | null
          stripe_charge_id: string | null
          stripe_dispute_id: string
          stripe_payment_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          id?: string
          raw_payload?: Json | null
          reason?: string | null
          status?: string | null
          stripe_charge_id?: string | null
          stripe_dispute_id: string
          stripe_payment_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          id?: string
          raw_payload?: Json | null
          reason?: string | null
          status?: string | null
          stripe_charge_id?: string | null
          stripe_dispute_id?: string
          stripe_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_disputes_stripe_payment_id_fkey"
            columns: ["stripe_payment_id"]
            isOneToOne: false
            referencedRelation: "stripe_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_payments: {
        Row: {
          created_at: string | null
          crm_booking_id: string | null
          crm_client_id: string | null
          currency: string | null
          customer_email: string | null
          customer_name: string | null
          gross_amount: number | null
          id: string
          invoice_number: string | null
          net_amount: number | null
          payment_method: string | null
          raw_payload: Json | null
          status: string | null
          stripe_available_at: string | null
          stripe_charge_id: string | null
          stripe_created_at: string | null
          stripe_customer_id: string | null
          stripe_fee: number | null
          stripe_payment_intent_id: string
        }
        Insert: {
          created_at?: string | null
          crm_booking_id?: string | null
          crm_client_id?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          gross_amount?: number | null
          id?: string
          invoice_number?: string | null
          net_amount?: number | null
          payment_method?: string | null
          raw_payload?: Json | null
          status?: string | null
          stripe_available_at?: string | null
          stripe_charge_id?: string | null
          stripe_created_at?: string | null
          stripe_customer_id?: string | null
          stripe_fee?: number | null
          stripe_payment_intent_id: string
        }
        Update: {
          created_at?: string | null
          crm_booking_id?: string | null
          crm_client_id?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          gross_amount?: number | null
          id?: string
          invoice_number?: string | null
          net_amount?: number | null
          payment_method?: string | null
          raw_payload?: Json | null
          status?: string | null
          stripe_available_at?: string | null
          stripe_charge_id?: string | null
          stripe_created_at?: string | null
          stripe_customer_id?: string | null
          stripe_fee?: number | null
          stripe_payment_intent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_payments_crm_booking_id_fkey"
            columns: ["crm_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payments_crm_client_id_fkey"
            columns: ["crm_client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payments_crm_client_id_fkey"
            columns: ["crm_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_payout_payments: {
        Row: {
          created_at: string | null
          fee_amount: number | null
          gross_amount: number | null
          id: string
          net_contribution: number | null
          stripe_payment_id: string | null
          stripe_payout_id: string | null
        }
        Insert: {
          created_at?: string | null
          fee_amount?: number | null
          gross_amount?: number | null
          id?: string
          net_contribution?: number | null
          stripe_payment_id?: string | null
          stripe_payout_id?: string | null
        }
        Update: {
          created_at?: string | null
          fee_amount?: number | null
          gross_amount?: number | null
          id?: string
          net_contribution?: number | null
          stripe_payment_id?: string | null
          stripe_payout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_payout_payments_stripe_payment_id_fkey"
            columns: ["stripe_payment_id"]
            isOneToOne: false
            referencedRelation: "stripe_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payout_payments_stripe_payout_id_fkey"
            columns: ["stripe_payout_id"]
            isOneToOne: false
            referencedRelation: "stripe_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_payouts: {
        Row: {
          amount: number | null
          arrival_date: string | null
          breakdown: Json | null
          created_at: string | null
          fee_total: number | null
          id: string
          net_amount: number | null
          qbo_deposit_id: string | null
          qbo_loan_interest_transfer_id: string | null
          qbo_loan_principal_transfer_id: string | null
          qbo_synced_at: string | null
          qbo_trip_transfer_id: string | null
          raw_payload: Json | null
          reconciled: boolean | null
          refund_total: number | null
          status: string | null
          stripe_payout_id: string
        }
        Insert: {
          amount?: number | null
          arrival_date?: string | null
          breakdown?: Json | null
          created_at?: string | null
          fee_total?: number | null
          id?: string
          net_amount?: number | null
          qbo_deposit_id?: string | null
          qbo_loan_interest_transfer_id?: string | null
          qbo_loan_principal_transfer_id?: string | null
          qbo_synced_at?: string | null
          qbo_trip_transfer_id?: string | null
          raw_payload?: Json | null
          reconciled?: boolean | null
          refund_total?: number | null
          status?: string | null
          stripe_payout_id: string
        }
        Update: {
          amount?: number | null
          arrival_date?: string | null
          breakdown?: Json | null
          created_at?: string | null
          fee_total?: number | null
          id?: string
          net_amount?: number | null
          qbo_deposit_id?: string | null
          qbo_loan_interest_transfer_id?: string | null
          qbo_loan_principal_transfer_id?: string | null
          qbo_synced_at?: string | null
          qbo_trip_transfer_id?: string | null
          raw_payload?: Json | null
          reconciled?: boolean | null
          refund_total?: number | null
          status?: string | null
          stripe_payout_id?: string
        }
        Relationships: []
      }
      stripe_refunds: {
        Row: {
          amount: number | null
          created_at: string | null
          id: string
          raw_payload: Json | null
          reason: string | null
          status: string | null
          stripe_charge_id: string | null
          stripe_payment_id: string | null
          stripe_payment_intent_id: string | null
          stripe_refund_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          id?: string
          raw_payload?: Json | null
          reason?: string | null
          status?: string | null
          stripe_charge_id?: string | null
          stripe_payment_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          id?: string
          raw_payload?: Json | null
          reason?: string | null
          status?: string | null
          stripe_charge_id?: string | null
          stripe_payment_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_refunds_stripe_payment_id_fkey"
            columns: ["stripe_payment_id"]
            isOneToOne: false
            referencedRelation: "stripe_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          created_at: string | null
          error: string | null
          event_type: string
          id: string
          processed: boolean | null
          processed_at: string | null
          raw_payload: Json
          stripe_event_id: string
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          event_type: string
          id?: string
          processed?: boolean | null
          processed_at?: string | null
          raw_payload: Json
          stripe_event_id: string
        }
        Update: {
          created_at?: string | null
          error?: string | null
          event_type?: string
          id?: string
          processed?: boolean | null
          processed_at?: string | null
          raw_payload?: Json
          stripe_event_id?: string
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
          multi_line_commission: boolean
          name: string
          notes: string | null
          override_commission: boolean
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
          multi_line_commission?: boolean
          name: string
          notes?: string | null
          override_commission?: boolean
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
          multi_line_commission?: boolean
          name?: string
          notes?: string | null
          override_commission?: boolean
          supplier_type?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      task_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          metadata: Json | null
          result_summary: string | null
          started_at: string
          status: string
          task_name: string
          task_type: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          result_summary?: string | null
          started_at?: string
          status?: string
          task_name: string
          task_type?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          result_summary?: string | null
          started_at?: string
          status?: string
          task_name?: string
          task_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      training_announcements: {
        Row: {
          audience: string
          body: string | null
          created_at: string
          created_by: string
          end_date: string | null
          id: string
          is_pinned: boolean
          start_date: string
          status: string
          title: string
        }
        Insert: {
          audience?: string
          body?: string | null
          created_at?: string
          created_by: string
          end_date?: string | null
          id?: string
          is_pinned?: boolean
          start_date?: string
          status?: string
          title: string
        }
        Update: {
          audience?: string
          body?: string | null
          created_at?: string
          created_by?: string
          end_date?: string | null
          id?: string
          is_pinned?: boolean
          start_date?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      training_badges: {
        Row: {
          badge_type: string
          created_at: string
          criteria_id: string | null
          criteria_type: string | null
          description: string | null
          icon: string | null
          id: string
          title: string
        }
        Insert: {
          badge_type?: string
          created_at?: string
          criteria_id?: string | null
          criteria_type?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          title: string
        }
        Update: {
          badge_type?: string
          created_at?: string
          criteria_id?: string | null
          criteria_type?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      training_lessons: {
        Row: {
          checklist_items: Json | null
          content_body: string | null
          created_at: string
          created_by: string
          description: string | null
          estimated_minutes: number | null
          external_url: string | null
          file_attachments: Json | null
          id: string
          is_required: boolean
          lesson_type: string
          module_id: string
          quiz_id: string | null
          sort_order: number
          status: string
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          checklist_items?: Json | null
          content_body?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          estimated_minutes?: number | null
          external_url?: string | null
          file_attachments?: Json | null
          id?: string
          is_required?: boolean
          lesson_type?: string
          module_id: string
          quiz_id?: string | null
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          checklist_items?: Json | null
          content_body?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          estimated_minutes?: number | null
          external_url?: string | null
          file_attachments?: Json | null
          id?: string
          is_required?: boolean
          lesson_type?: string
          module_id?: string
          quiz_id?: string | null
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_lessons_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "training_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      training_modules: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string | null
          estimated_minutes: number | null
          id: string
          is_required: boolean
          resource_url: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          is_required?: boolean
          resource_url?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          is_required?: boolean
          resource_url?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_modules_v2: {
        Row: {
          badge_id: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string
          description: string | null
          estimated_minutes: number | null
          id: string
          is_required: boolean
          phase_id: string
          sort_order: number
          status: string
          title: string
          unlock_rule: string
          updated_at: string
        }
        Insert: {
          badge_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          is_required?: boolean
          phase_id: string
          sort_order?: number
          status?: string
          title: string
          unlock_rule?: string
          updated_at?: string
        }
        Update: {
          badge_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          is_required?: boolean
          phase_id?: string
          sort_order?: number
          status?: string
          title?: string
          unlock_rule?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_modules_v2_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "training_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_modules_v2_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "training_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      training_phases: {
        Row: {
          badge_id: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string
          description: string | null
          estimated_minutes: number | null
          id: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          badge_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          badge_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_phases_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "training_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      training_quiz_attempts: {
        Row: {
          answers: Json | null
          id: string
          passed: boolean
          quiz_id: string
          score: number
          submitted_at: string
          user_id: string
        }
        Insert: {
          answers?: Json | null
          id?: string
          passed?: boolean
          quiz_id: string
          score?: number
          submitted_at?: string
          user_id: string
        }
        Update: {
          answers?: Json | null
          id?: string
          passed?: boolean
          quiz_id?: string
          score?: number
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "training_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      training_quiz_questions: {
        Row: {
          answer_options: Json
          correct_answer: string
          explanation: string | null
          id: string
          question_text: string
          quiz_id: string
          sort_order: number
        }
        Insert: {
          answer_options?: Json
          correct_answer: string
          explanation?: string | null
          id?: string
          question_text: string
          quiz_id: string
          sort_order?: number
        }
        Update: {
          answer_options?: Json
          correct_answer?: string
          explanation?: string | null
          id?: string
          question_text?: string
          quiz_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "training_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      training_quizzes: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          passing_score: number
          retry_limit: number
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          passing_score?: number
          retry_limit?: number
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          passing_score?: number
          retry_limit?: number
          status?: string
          title?: string
        }
        Relationships: []
      }
      training_user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          issued_by: string | null
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          issued_by?: string | null
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          issued_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "training_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      training_user_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          last_viewed_at: string | null
          lesson_id: string | null
          module_id: string | null
          notes: string | null
          percent_complete: number
          phase_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_viewed_at?: string | null
          lesson_id?: string | null
          module_id?: string | null
          notes?: string | null
          percent_complete?: number
          phase_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_viewed_at?: string | null
          lesson_id?: string | null
          module_id?: string | null
          notes?: string | null
          percent_complete?: number
          phase_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_user_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "training_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_user_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_user_progress_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "training_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_cabin_options: {
        Row: {
          capacity: number | null
          category_name: string
          created_at: string
          deposit_amount: number | null
          description: string | null
          id: string
          image_url: string | null
          price_per_person: number
          price_period: string
          sort_order: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          category_name: string
          created_at?: string
          deposit_amount?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          price_per_person?: number
          price_period?: string
          sort_order?: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          category_name?: string
          created_at?: string
          deposit_amount?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          price_per_person?: number
          price_period?: string
          sort_order?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_cabin_options_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_feedback: {
        Row: {
          accommodations_rating: number | null
          activities_rating: number | null
          allow_public_use: boolean | null
          client_id: string | null
          communication_rating: number | null
          created_at: string
          id: string
          overall_rating: number | null
          private_comments: string | null
          review_text: string | null
          submitted_at: string | null
          token: string
          trip_id: string
          updated_at: string
          user_id: string | null
          value_rating: number | null
          would_recommend: boolean | null
        }
        Insert: {
          accommodations_rating?: number | null
          activities_rating?: number | null
          allow_public_use?: boolean | null
          client_id?: string | null
          communication_rating?: number | null
          created_at?: string
          id?: string
          overall_rating?: number | null
          private_comments?: string | null
          review_text?: string | null
          submitted_at?: string | null
          token?: string
          trip_id: string
          updated_at?: string
          user_id?: string | null
          value_rating?: number | null
          would_recommend?: boolean | null
        }
        Update: {
          accommodations_rating?: number | null
          activities_rating?: number | null
          allow_public_use?: boolean | null
          client_id?: string | null
          communication_rating?: number | null
          created_at?: string
          id?: string
          overall_rating?: number | null
          private_comments?: string | null
          review_text?: string | null
          submitted_at?: string | null
          token?: string
          trip_id?: string
          updated_at?: string
          user_id?: string | null
          value_rating?: number | null
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_feedback_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_feedback_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_feedback_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_insurance_quotes: {
        Row: {
          coverage_amount: number | null
          coverage_details: string | null
          created_at: string
          id: string
          is_recommended: boolean | null
          plan_name: string | null
          premium_amount: number
          provider_name: string
          quote_url: string | null
          sort_order: number | null
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coverage_amount?: number | null
          coverage_details?: string | null
          created_at?: string
          id?: string
          is_recommended?: boolean | null
          plan_name?: string | null
          premium_amount?: number
          provider_name: string
          quote_url?: string | null
          sort_order?: number | null
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coverage_amount?: number | null
          coverage_details?: string | null
          created_at?: string
          id?: string
          is_recommended?: boolean | null
          plan_name?: string | null
          premium_amount?: number
          provider_name?: string
          quote_url?: string | null
          sort_order?: number | null
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_insurance_quotes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_insurance_responses: {
        Row: {
          acknowledgment_text: string | null
          client_id: string
          created_at: string
          id: string
          ip_address: string | null
          responded_at: string
          response_type: string
          selected_quote_id: string | null
          trip_id: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          acknowledgment_text?: string | null
          client_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          responded_at?: string
          response_type: string
          selected_quote_id?: string | null
          trip_id: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          acknowledgment_text?: string | null
          client_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          responded_at?: string
          response_type?: string
          selected_quote_id?: string | null
          trip_id?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_insurance_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_insurance_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_insurance_responses_selected_quote_id_fkey"
            columns: ["selected_quote_id"]
            isOneToOne: false
            referencedRelation: "trip_insurance_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_insurance_responses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_insurance_settings: {
        Row: {
          agency_disclaimer: string | null
          allow_skip_selection: boolean | null
          amount_to_insure: number | null
          created_at: string
          id: string
          ready_for_client_review: boolean | null
          trip_id: string
          updated_at: string
          use_full_trip_cost: boolean | null
          user_id: string
        }
        Insert: {
          agency_disclaimer?: string | null
          allow_skip_selection?: boolean | null
          amount_to_insure?: number | null
          created_at?: string
          id?: string
          ready_for_client_review?: boolean | null
          trip_id: string
          updated_at?: string
          use_full_trip_cost?: boolean | null
          user_id: string
        }
        Update: {
          agency_disclaimer?: string | null
          allow_skip_selection?: boolean | null
          amount_to_insure?: number | null
          created_at?: string
          id?: string
          ready_for_client_review?: boolean | null
          trip_id?: string
          updated_at?: string
          use_full_trip_cost?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_insurance_settings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_nurture_log: {
        Row: {
          created_at: string
          id: string
          label: string
          lead_id: string
          resend_id: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          step: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          lead_id: string
          resend_id?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string
          step: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          lead_id?: string
          resend_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "trip_nurture_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_nurture_steps: {
        Row: {
          created_at: string
          id: string
          resend_id: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          step: string
          trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          resend_id?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string
          step: string
          trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          resend_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          step?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_nurture_steps_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
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
          payer_email: string | null
          payer_name: string | null
          payer_traveler_id: string | null
          payment_date: string | null
          payment_method: string | null
          payment_method_choice: string | null
          payment_type: string
          status: string
          stripe_fee: number | null
          stripe_payment_intent_id: string | null
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
          payer_email?: string | null
          payer_name?: string | null
          payer_traveler_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_method_choice?: string | null
          payment_type?: string
          status?: string
          stripe_fee?: number | null
          stripe_payment_intent_id?: string | null
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
          payer_email?: string | null
          payer_name?: string | null
          payer_traveler_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_method_choice?: string | null
          payment_type?: string
          status?: string
          stripe_fee?: number | null
          stripe_payment_intent_id?: string | null
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
            foreignKeyName: "trip_payments_payer_traveler_id_fkey"
            columns: ["payer_traveler_id"]
            isOneToOne: false
            referencedRelation: "trip_travelers"
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
      trip_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trip_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string | null
          destination: string | null
          duration_days: number | null
          id: string
          is_public: boolean
          name: string
          template_data: Json
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          description?: string | null
          destination?: string | null
          duration_days?: number | null
          id?: string
          is_public?: boolean
          name: string
          template_data?: Json
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          destination?: string | null
          duration_days?: number | null
          id?: string
          is_public?: boolean
          name?: string
          template_data?: Json
          updated_at?: string
        }
        Relationships: []
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
          linked_client_id: string | null
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
          linked_client_id?: string | null
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
          linked_client_id?: string | null
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
            foreignKeyName: "trip_travelers_linked_client_id_fkey"
            columns: ["linked_client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_travelers_linked_client_id_fkey"
            columns: ["linked_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
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
          advisor_id: string | null
          allow_pdf_downloads: boolean
          approved_itinerary_id: string | null
          budget_change_request_message: string | null
          budget_change_requested: boolean | null
          budget_change_requested_at: string | null
          budget_change_requested_by_client_id: string | null
          budget_confirmation_ip: string | null
          budget_confirmation_signature: string | null
          budget_confirmation_user_agent: string | null
          budget_confirmed: boolean | null
          budget_confirmed_at: string | null
          budget_confirmed_by_client_id: string | null
          budget_range: string | null
          cabin_photos: string[]
          cabin_selection: string | null
          client_id: string | null
          cover_image_url: string | null
          created_at: string
          currency: string
          depart_date: string | null
          departure_date: string | null
          deposit_amount: number | null
          deposit_override: boolean
          deposit_required: boolean | null
          destination: string | null
          follow_up_due_at: string | null
          group_landing_content: Json | null
          group_landing_description: string | null
          group_landing_enabled: boolean
          group_landing_headline: string | null
          group_landing_hero_url: string | null
          hotel_name: string | null
          id: string
          itinerary_approved_at: string | null
          itinerary_approved_by_client_id: string | null
          itinerary_style: string
          notes: string | null
          nurture_paused: boolean | null
          nurture_started: boolean | null
          parent_trip_id: string | null
          payment_mode: string
          post_trip_email_sent: boolean | null
          pricing_visibility: string
          proposal_sent_at: string | null
          published_at: string | null
          published_snapshot: Json | null
          readiness_score: Json | null
          return_date: string | null
          selected_cabin_option_id: string | null
          share_token: string
          ship_name: string | null
          source: string
          status: string
          tags: string[] | null
          title: string | null
          total_commission_revenue: number
          total_commissionable_amount: number
          total_gross_sales: number
          total_net_sales: number
          total_supplier_payout: number
          trip_name: string
          trip_page_url: string | null
          trip_subtype: string | null
          trip_type: string | null
          updated_at: string
          upgrade_notes: string | null
          user_id: string
        }
        Insert: {
          advisor_id?: string | null
          allow_pdf_downloads?: boolean
          approved_itinerary_id?: string | null
          budget_change_request_message?: string | null
          budget_change_requested?: boolean | null
          budget_change_requested_at?: string | null
          budget_change_requested_by_client_id?: string | null
          budget_confirmation_ip?: string | null
          budget_confirmation_signature?: string | null
          budget_confirmation_user_agent?: string | null
          budget_confirmed?: boolean | null
          budget_confirmed_at?: string | null
          budget_confirmed_by_client_id?: string | null
          budget_range?: string | null
          cabin_photos?: string[]
          cabin_selection?: string | null
          client_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          depart_date?: string | null
          departure_date?: string | null
          deposit_amount?: number | null
          deposit_override?: boolean
          deposit_required?: boolean | null
          destination?: string | null
          follow_up_due_at?: string | null
          group_landing_content?: Json | null
          group_landing_description?: string | null
          group_landing_enabled?: boolean
          group_landing_headline?: string | null
          group_landing_hero_url?: string | null
          hotel_name?: string | null
          id?: string
          itinerary_approved_at?: string | null
          itinerary_approved_by_client_id?: string | null
          itinerary_style?: string
          notes?: string | null
          nurture_paused?: boolean | null
          nurture_started?: boolean | null
          parent_trip_id?: string | null
          payment_mode?: string
          post_trip_email_sent?: boolean | null
          pricing_visibility?: string
          proposal_sent_at?: string | null
          published_at?: string | null
          published_snapshot?: Json | null
          readiness_score?: Json | null
          return_date?: string | null
          selected_cabin_option_id?: string | null
          share_token?: string
          ship_name?: string | null
          source?: string
          status?: string
          tags?: string[] | null
          title?: string | null
          total_commission_revenue?: number
          total_commissionable_amount?: number
          total_gross_sales?: number
          total_net_sales?: number
          total_supplier_payout?: number
          trip_name: string
          trip_page_url?: string | null
          trip_subtype?: string | null
          trip_type?: string | null
          updated_at?: string
          upgrade_notes?: string | null
          user_id: string
        }
        Update: {
          advisor_id?: string | null
          allow_pdf_downloads?: boolean
          approved_itinerary_id?: string | null
          budget_change_request_message?: string | null
          budget_change_requested?: boolean | null
          budget_change_requested_at?: string | null
          budget_change_requested_by_client_id?: string | null
          budget_confirmation_ip?: string | null
          budget_confirmation_signature?: string | null
          budget_confirmation_user_agent?: string | null
          budget_confirmed?: boolean | null
          budget_confirmed_at?: string | null
          budget_confirmed_by_client_id?: string | null
          budget_range?: string | null
          cabin_photos?: string[]
          cabin_selection?: string | null
          client_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          depart_date?: string | null
          departure_date?: string | null
          deposit_amount?: number | null
          deposit_override?: boolean
          deposit_required?: boolean | null
          destination?: string | null
          follow_up_due_at?: string | null
          group_landing_content?: Json | null
          group_landing_description?: string | null
          group_landing_enabled?: boolean
          group_landing_headline?: string | null
          group_landing_hero_url?: string | null
          hotel_name?: string | null
          id?: string
          itinerary_approved_at?: string | null
          itinerary_approved_by_client_id?: string | null
          itinerary_style?: string
          notes?: string | null
          nurture_paused?: boolean | null
          nurture_started?: boolean | null
          parent_trip_id?: string | null
          payment_mode?: string
          post_trip_email_sent?: boolean | null
          pricing_visibility?: string
          proposal_sent_at?: string | null
          published_at?: string | null
          published_snapshot?: Json | null
          readiness_score?: Json | null
          return_date?: string | null
          selected_cabin_option_id?: string | null
          share_token?: string
          ship_name?: string | null
          source?: string
          status?: string
          tags?: string[] | null
          title?: string | null
          total_commission_revenue?: number
          total_commissionable_amount?: number
          total_gross_sales?: number
          total_net_sales?: number
          total_supplier_payout?: number
          trip_name?: string
          trip_page_url?: string | null
          trip_subtype?: string | null
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
            foreignKeyName: "trips_budget_change_requested_by_client_id_fkey"
            columns: ["budget_change_requested_by_client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_budget_change_requested_by_client_id_fkey"
            columns: ["budget_change_requested_by_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_budget_confirmed_by_client_id_fkey"
            columns: ["budget_confirmed_by_client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_budget_confirmed_by_client_id_fkey"
            columns: ["budget_confirmed_by_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
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
            referencedRelation: "bookkeeper_clients_view"
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
          {
            foreignKeyName: "trips_selected_cabin_option_id_fkey"
            columns: ["selected_cabin_option_id"]
            isOneToOne: false
            referencedRelation: "trip_cabin_options"
            referencedColumns: ["id"]
          },
        ]
      }
      txtya_sync_log: {
        Row: {
          client_id: string | null
          companion_id: string | null
          created_at: string
          error_message: string | null
          id: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
          traveler_kind: string
          trip_id: string | null
          txtya_traveler_id: string | null
          txtya_trip_id: string | null
        }
        Insert: {
          client_id?: string | null
          companion_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status: string
          traveler_kind: string
          trip_id?: string | null
          txtya_traveler_id?: string | null
          txtya_trip_id?: string | null
        }
        Update: {
          client_id?: string | null
          companion_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          traveler_kind?: string
          trip_id?: string | null
          txtya_traveler_id?: string | null
          txtya_trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "txtya_sync_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "bookkeeper_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "txtya_sync_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "txtya_sync_log_companion_id_fkey"
            columns: ["companion_id"]
            isOneToOne: false
            referencedRelation: "client_companions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "txtya_sync_log_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feature_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          feature_key: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          feature_key: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          feature_key?: string
          id?: string
          updated_at?: string
          user_id?: string
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
      viator_bookings: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string | null
          currency: string | null
          customer_email: string | null
          customer_name: string | null
          id: string
          notes: string | null
          pax_mix: Json | null
          product_code: string
          product_option_code: string | null
          product_title: string | null
          raw_response: Json | null
          start_time: string | null
          status: string | null
          total_price: number | null
          travel_date: string | null
          updated_at: string | null
          viator_booking_ref: string | null
          viator_cart_ref: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          pax_mix?: Json | null
          product_code: string
          product_option_code?: string | null
          product_title?: string | null
          raw_response?: Json | null
          start_time?: string | null
          status?: string | null
          total_price?: number | null
          travel_date?: string | null
          updated_at?: string | null
          viator_booking_ref?: string | null
          viator_cart_ref?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          pax_mix?: Json | null
          product_code?: string
          product_option_code?: string | null
          product_title?: string | null
          raw_response?: Json | null
          start_time?: string | null
          status?: string | null
          total_price?: number | null
          travel_date?: string | null
          updated_at?: string | null
          viator_booking_ref?: string | null
          viator_cart_ref?: string | null
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
      widgety_cruise_prices: {
        Row: {
          currency: string | null
          holiday_ref: string
          name: string | null
          operating_season: string | null
          operator_title: string | null
          price_from_double: number | null
          price_from_single: number | null
          price_from_triple: number | null
          updated_at: string | null
        }
        Insert: {
          currency?: string | null
          holiday_ref: string
          name?: string | null
          operating_season?: string | null
          operator_title?: string | null
          price_from_double?: number | null
          price_from_single?: number | null
          price_from_triple?: number | null
          updated_at?: string | null
        }
        Update: {
          currency?: string | null
          holiday_ref?: string
          name?: string | null
          operating_season?: string | null
          operator_title?: string | null
          price_from_double?: number | null
          price_from_single?: number | null
          price_from_triple?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      win_entries: {
        Row: {
          budget: string | null
          city: string | null
          created_at: string | null
          destination: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          party_size: string | null
          phone: string | null
          source: string | null
          timeline: string | null
        }
        Insert: {
          budget?: string | null
          city?: string | null
          created_at?: string | null
          destination?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          party_size?: string | null
          phone?: string | null
          source?: string | null
          timeline?: string | null
        }
        Update: {
          budget?: string | null
          city?: string | null
          created_at?: string | null
          destination?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          party_size?: string | null
          phone?: string | null
          source?: string | null
          timeline?: string | null
        }
        Relationships: []
      }
      workflow_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          status: string
          task_type: string
          title: string
          trip_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          status?: string
          task_type?: string
          title: string
          trip_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          status?: string
          task_type?: string
          title?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_tasks_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      bookkeeper_clients_view: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bookkeeper_profiles_view: {
        Row: {
          commission_tier: Database["public"]["Enums"]["commission_tier"] | null
          created_at: string | null
          full_name: string | null
          id: string | null
          user_id: string | null
        }
        Insert: {
          commission_tier?:
            | Database["public"]["Enums"]["commission_tier"]
            | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          user_id?: string | null
        }
        Update: {
          commission_tier?:
            | Database["public"]["Enums"]["commission_tier"]
            | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bookkeeper_suppliers_view: {
        Row: {
          contact_email: string | null
          created_at: string | null
          id: string | null
          name: string | null
          user_id: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          user_id?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_contacts: {
        Row: {
          contact_id: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          last_name: string | null
          lifecycle_stage: string | null
          source: string | null
          tags: string[] | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          acceptance_signature: string | null
          amount: number | null
          booking_id: string | null
          created_at: string | null
          details: string | null
          due_date: string | null
          id: string | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          payment_method_choice: string | null
          payment_type: string | null
          status: string | null
          stripe_payment_url: string | null
          stripe_receipt_url: string | null
          stripe_session_id: string | null
          terms_accepted_at: string | null
          trip_id: string | null
          updated_at: string | null
          user_id: string | null
          virtual_card_id: string | null
          virtual_card_status: string | null
        }
        Insert: {
          acceptance_signature?: string | null
          amount?: number | null
          booking_id?: string | null
          created_at?: string | null
          details?: string | null
          due_date?: string | null
          id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_method_choice?: string | null
          payment_type?: string | null
          status?: string | null
          stripe_payment_url?: string | null
          stripe_receipt_url?: string | null
          stripe_session_id?: string | null
          terms_accepted_at?: string | null
          trip_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          virtual_card_id?: string | null
          virtual_card_status?: string | null
        }
        Update: {
          acceptance_signature?: string | null
          amount?: number | null
          booking_id?: string | null
          created_at?: string | null
          details?: string | null
          due_date?: string | null
          id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_method_choice?: string | null
          payment_type?: string | null
          status?: string | null
          stripe_payment_url?: string | null
          stripe_receipt_url?: string | null
          stripe_session_id?: string | null
          terms_accepted_at?: string | null
          trip_id?: string | null
          updated_at?: string | null
          user_id?: string | null
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
      public_storefronts: {
        Row: {
          agency_name: string | null
          avatar_url: string | null
          full_name: string | null
          job_title: string | null
          storefront_bio: string | null
          storefront_email: string | null
          storefront_headline: string | null
          storefront_logo_url: string | null
          storefront_slug: string | null
          user_id: string | null
        }
        Insert: {
          agency_name?: string | null
          avatar_url?: string | null
          full_name?: string | null
          job_title?: string | null
          storefront_bio?: string | null
          storefront_email?: string | null
          storefront_headline?: string | null
          storefront_logo_url?: string | null
          storefront_slug?: string | null
          user_id?: string | null
        }
        Update: {
          agency_name?: string | null
          avatar_url?: string | null
          full_name?: string | null
          job_title?: string | null
          storefront_bio?: string | null
          storefront_email?: string | null
          storefront_headline?: string | null
          storefront_logo_url?: string | null
          storefront_slug?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_at: string | null
          id: string | null
          status: string | null
          task_type: string | null
          title: string | null
          trip_id: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string | null
          status?: string | null
          task_type?: string | null
          title?: string | null
          trip_id?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string | null
          status?: string | null
          task_type?: string | null
          title?: string | null
          trip_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_tasks_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _post_qbo_sync_trigger: {
        Args: { p_old?: Json; p_record: Json; p_trigger_type: string }
        Returns: undefined
      }
      accept_invitation: {
        Args: { accepting_user_id: string; invitation_token: string }
        Returns: boolean
      }
      approve_proposal: {
        Args: { p_option: string; p_token: string }
        Returns: string
      }
      calculate_booking_margin: {
        Args: {
          p_advisor_split?: number
          p_booking_id: string
          p_force_recalc?: boolean
        }
        Returns: Json
      }
      check_upcoming_payment_deadlines: { Args: never; Returns: undefined }
      confirm_commission_payout: { Args: { p_edits: Json }; Returns: Json }
      get_advisor_split_pct: { Args: { p_user_id: string }; Returns: number }
      get_next_invoice_number: { Args: { p_user_id: string }; Returns: string }
      get_proposal: {
        Args: { p_token: string }
        Returns: {
          departure_date: string
          destination: string
          first_name: string
          proposal_draft: string
          proposal_expires_at: string
          proposal_options: Json
          proposal_status: string
          selected_option: string
          travelers_adults: number
          travelers_children: number
          trip_type: string
        }[]
      }
      get_qualify: {
        Args: { p_token: string }
        Returns: {
          departure_date: string
          destination: string
          first_name: string
          proposal_status: string
          trip_type: string
        }[]
      }
      has_feature_permission: {
        Args: { _feature_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hotelbeds_increment_search_usage: {
        Args: { _cap: number }
        Returns: number
      }
      increment_campaign_stat: {
        Args: { p_campaign_id: string; p_delta?: number; p_field: string }
        Returns: undefined
      }
      is_authenticated: { Args: never; Returns: boolean }
      is_bookkeeper: { Args: { _user_id: string }; Returns: boolean }
      is_invoice_cash_payment: {
        Args: { p: Database["public"]["Tables"]["trip_payments"]["Row"] }
        Returns: boolean
      }
      is_recon_admin: { Args: never; Returns: boolean }
      mark_proposal_viewed: { Args: { p_token: string }; Returns: undefined }
      reveal_cw_agent_secret: { Args: never; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_qualify: {
        Args: { p_answers: Json; p_token: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "office_admin" | "bookkeeper"
      client_tier: "explorer" | "voyager" | "platinum" | "elite"
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
      app_role: ["admin", "moderator", "user", "office_admin", "bookkeeper"],
      client_tier: ["explorer", "voyager", "platinum", "elite"],
      commission_tier: ["tier_1", "tier_2", "tier_3", "none"],
    },
  },
} as const
