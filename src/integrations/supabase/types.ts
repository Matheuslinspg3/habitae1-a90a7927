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
      activity_log: {
        Row: {
          action_type: string
          created_at: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          metadata: Json | null
          organization_id: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          organization_id: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_accounts: {
        Row: {
          auth_payload: Json | null
          created_at: string
          external_account_id: string | null
          id: string
          is_active: boolean
          name: string | null
          organization_id: string
          provider: Database["public"]["Enums"]["ad_provider"]
          status: string
          updated_at: string
        }
        Insert: {
          auth_payload?: Json | null
          created_at?: string
          external_account_id?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          organization_id: string
          provider?: Database["public"]["Enums"]["ad_provider"]
          status?: string
          updated_at?: string
        }
        Update: {
          auth_payload?: Json | null
          created_at?: string
          external_account_id?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          organization_id?: string
          provider?: Database["public"]["Enums"]["ad_provider"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_entities: {
        Row: {
          created_at: string
          entity_type: Database["public"]["Enums"]["ad_entity_type"]
          external_id: string
          id: string
          name: string
          organization_id: string
          parent_external_id: string | null
          provider: Database["public"]["Enums"]["ad_provider"]
          status: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_type?: Database["public"]["Enums"]["ad_entity_type"]
          external_id: string
          id?: string
          name: string
          organization_id: string
          parent_external_id?: string | null
          provider?: Database["public"]["Enums"]["ad_provider"]
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: Database["public"]["Enums"]["ad_entity_type"]
          external_id?: string
          id?: string
          name?: string
          organization_id?: string
          parent_external_id?: string | null
          provider?: Database["public"]["Enums"]["ad_provider"]
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_entities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_insights_daily: {
        Row: {
          clicks: number
          cpc: number | null
          cpl: number | null
          created_at: string
          ctr: number | null
          date: string
          entity_type: Database["public"]["Enums"]["ad_entity_type"]
          external_id: string
          id: string
          impressions: number
          leads: number
          organization_id: string
          provider: Database["public"]["Enums"]["ad_provider"]
          spend: number
          updated_at: string
        }
        Insert: {
          clicks?: number
          cpc?: number | null
          cpl?: number | null
          created_at?: string
          ctr?: number | null
          date: string
          entity_type?: Database["public"]["Enums"]["ad_entity_type"]
          external_id: string
          id?: string
          impressions?: number
          leads?: number
          organization_id: string
          provider?: Database["public"]["Enums"]["ad_provider"]
          spend?: number
          updated_at?: string
        }
        Update: {
          clicks?: number
          cpc?: number | null
          cpl?: number | null
          created_at?: string
          ctr?: number | null
          date?: string
          entity_type?: Database["public"]["Enums"]["ad_entity_type"]
          external_id?: string
          id?: string
          impressions?: number
          leads?: number
          organization_id?: string
          provider?: Database["public"]["Enums"]["ad_provider"]
          spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_insights_daily_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_leads: {
        Row: {
          created_at: string
          created_time: string
          crm_record_id: string | null
          email: string | null
          external_ad_id: string
          external_form_id: string | null
          external_lead_id: string
          id: string
          name: string | null
          organization_id: string
          phone: string | null
          provider: Database["public"]["Enums"]["ad_provider"]
          raw_payload: Json | null
          status: Database["public"]["Enums"]["ad_lead_status"]
          status_reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_time?: string
          crm_record_id?: string | null
          email?: string | null
          external_ad_id: string
          external_form_id?: string | null
          external_lead_id: string
          id?: string
          name?: string | null
          organization_id: string
          phone?: string | null
          provider?: Database["public"]["Enums"]["ad_provider"]
          raw_payload?: Json | null
          status?: Database["public"]["Enums"]["ad_lead_status"]
          status_reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_time?: string
          crm_record_id?: string | null
          email?: string | null
          external_ad_id?: string
          external_form_id?: string | null
          external_lead_id?: string
          id?: string
          name?: string | null
          organization_id?: string
          phone?: string | null
          provider?: Database["public"]["Enums"]["ad_provider"]
          raw_payload?: Json | null
          status?: Database["public"]["Enums"]["ad_lead_status"]
          status_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_settings: {
        Row: {
          auto_send_to_crm: boolean
          created_at: string
          crm_stage_id: string | null
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          auto_send_to_crm?: boolean
          created_at?: string
          crm_stage_id?: string | null
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          auto_send_to_crm?: boolean
          created_at?: string
          crm_stage_id?: string | null
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_settings_crm_stage_id_fkey"
            columns: ["crm_stage_id"]
            isOneToOne: false
            referencedRelation: "lead_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_allowlist: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          assigned_to: string | null
          completed: boolean | null
          created_at: string
          created_by: string
          description: string | null
          end_time: string
          id: string
          interaction_id: string | null
          lead_id: string | null
          location: string | null
          organization_id: string
          property_id: string | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed?: boolean | null
          created_at?: string
          created_by: string
          description?: string | null
          end_time: string
          id?: string
          interaction_id?: string | null
          lead_id?: string | null
          location?: string | null
          organization_id: string
          property_id?: string | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed?: boolean | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_time?: string
          id?: string
          interaction_id?: string | null
          lead_id?: string | null
          location?: string | null
          organization_id?: string
          property_id?: string | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "lead_interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_ids: string[]
          entity_type: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_ids: string[]
          entity_type: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_ids?: string[]
          entity_type?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payments: {
        Row: {
          amount_cents: number
          created_at: string
          description: string | null
          id: string
          invoice_url: string | null
          method: string | null
          organization_id: string
          paid_at: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          provider: string
          provider_payment_id: string | null
          status: string
          subscription_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description?: string | null
          id?: string
          invoice_url?: string | null
          method?: string | null
          organization_id: string
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          provider?: string
          provider_payment_id?: string | null
          status?: string
          subscription_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string | null
          id?: string
          invoice_url?: string | null
          method?: string | null
          organization_id?: string
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          provider?: string
          provider_payment_id?: string | null
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_status: string | null
          event_type: string
          id: string
          payload: Json
          payload_hash: string | null
          processed: boolean
          provider: string
          provider_event_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_status?: string | null
          event_type: string
          id?: string
          payload: Json
          payload_hash?: string | null
          processed?: boolean
          provider?: string
          provider_event_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_status?: string | null
          event_type?: string
          id?: string
          payload?: Json
          payload_hash?: string | null
          processed?: boolean
          provider?: string
          provider_event_id?: string | null
        }
        Relationships: []
      }
      city_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
          organization_id: string | null
          state: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
          organization_id?: string | null
          state?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "city_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          broker_id: string
          contract_id: string
          created_at: string
          id: string
          organization_id: string
          paid: boolean | null
          paid_at: string | null
          percentage: number
        }
        Insert: {
          amount: number
          broker_id: string
          contract_id: string
          created_at?: string
          id?: string
          organization_id: string
          paid?: boolean | null
          paid_at?: string | null
          percentage: number
        }
        Update: {
          amount?: number
          broker_id?: string
          contract_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          paid?: boolean | null
          paid_at?: string | null
          percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "commissions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consumer_favorites: {
        Row: {
          created_at: string
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumer_favorites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumer_favorites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties_public"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_documents: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          name: string
          uploaded_by: string
          url: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          name: string
          uploaded_by: string
          url: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          name?: string
          uploaded_by?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          broker_id: string | null
          code: string
          commission_percentage: number | null
          created_at: string
          created_by: string
          end_date: string | null
          id: string
          lead_id: string | null
          notes: string | null
          organization_id: string
          payment_day: number | null
          property_id: string | null
          readjustment_index: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          type: Database["public"]["Enums"]["contract_type"]
          updated_at: string
          value: number
        }
        Insert: {
          broker_id?: string | null
          code: string
          commission_percentage?: number | null
          created_at?: string
          created_by: string
          end_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id: string
          payment_day?: number | null
          property_id?: string | null
          readjustment_index?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          type: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
          value: number
        }
        Update: {
          broker_id?: string | null
          code?: string
          commission_percentage?: number | null
          created_at?: string
          created_by?: string
          end_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id?: string
          payment_day?: number | null
          property_id?: string | null
          readjustment_index?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          type?: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "contracts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_import_logs: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          import_type: string
          organization_id: string
          report: Json | null
          settings: Json | null
          total_duplicates: number
          total_errors: number
          total_imported: number
          total_processed: number
          total_updated: number
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          import_type: string
          organization_id: string
          report?: Json | null
          settings?: Json | null
          total_duplicates?: number
          total_errors?: number
          total_imported?: number
          total_processed?: number
          total_updated?: number
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          import_type?: string
          organization_id?: string
          report?: Json | null
          settings?: Json | null
          total_duplicates?: number
          total_errors?: number
          total_imported?: number
          total_processed?: number
          total_updated?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_import_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_property_media: {
        Row: {
          cleaned_at: string | null
          cleanup_error: string | null
          cloudinary_public_id: string | null
          cloudinary_url: string
          deleted_at: string
          id: string
          organization_id: string
          original_property_id: string
          storage_path: string | null
        }
        Insert: {
          cleaned_at?: string | null
          cleanup_error?: string | null
          cloudinary_public_id?: string | null
          cloudinary_url: string
          deleted_at?: string
          id?: string
          organization_id: string
          original_property_id: string
          storage_path?: string | null
        }
        Update: {
          cleaned_at?: string | null
          cleanup_error?: string | null
          cloudinary_public_id?: string | null
          cloudinary_url?: string
          deleted_at?: string
          id?: string
          organization_id?: string
          original_property_id?: string
          storage_path?: string | null
        }
        Relationships: []
      }
      imobzi_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "imobzi_api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      imobzi_settings: {
        Row: {
          api_key_encrypted: string | null
          created_at: string | null
          id: string
          last_cursor: string | null
          last_sync_at: string | null
          organization_id: string
          scrape_cache_ttl_hours: number | null
          scraper_concurrency: number | null
          scraping_enabled: boolean | null
          scraping_min_photos: number | null
          smart_list: string | null
          sync_mode: string | null
          updated_at: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          created_at?: string | null
          id?: string
          last_cursor?: string | null
          last_sync_at?: string | null
          organization_id: string
          scrape_cache_ttl_hours?: number | null
          scraper_concurrency?: number | null
          scraping_enabled?: boolean | null
          scraping_min_photos?: number | null
          smart_list?: string | null
          sync_mode?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          created_at?: string | null
          id?: string
          last_cursor?: string | null
          last_sync_at?: string | null
          organization_id?: string
          scrape_cache_ttl_hours?: number | null
          scraper_concurrency?: number | null
          scraping_enabled?: boolean | null
          scraping_min_photos?: number | null
          smart_list?: string | null
          sync_mode?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imobzi_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      import_run_items: {
        Row: {
          created_at: string
          detail_fetched: boolean | null
          error_message: string | null
          id: string
          photos_expected: number | null
          photos_fetched: boolean | null
          photos_imported: number | null
          property_id: string | null
          retry_count: number | null
          run_id: string
          scrape_attempted: boolean | null
          scrape_images_found: number | null
          source_property_id: string
          source_title: string | null
          status: string
          updated_at: string
          warnings: Json | null
        }
        Insert: {
          created_at?: string
          detail_fetched?: boolean | null
          error_message?: string | null
          id?: string
          photos_expected?: number | null
          photos_fetched?: boolean | null
          photos_imported?: number | null
          property_id?: string | null
          retry_count?: number | null
          run_id: string
          scrape_attempted?: boolean | null
          scrape_images_found?: number | null
          source_property_id: string
          source_title?: string | null
          status?: string
          updated_at?: string
          warnings?: Json | null
        }
        Update: {
          created_at?: string
          detail_fetched?: boolean | null
          error_message?: string | null
          id?: string
          photos_expected?: number | null
          photos_fetched?: boolean | null
          photos_imported?: number | null
          property_id?: string | null
          retry_count?: number | null
          run_id?: string
          scrape_attempted?: boolean | null
          scrape_images_found?: number | null
          source_property_id?: string
          source_title?: string | null
          status?: string
          updated_at?: string
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_run_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_runs: {
        Row: {
          created_at: string
          error_message: string | null
          errors: number | null
          finished_at: string | null
          id: string
          images_failed: number | null
          images_processed: number | null
          images_scraped: number | null
          imported: number | null
          marketplace_property_ids: string[] | null
          organization_id: string
          pending_property_ids: string[] | null
          scrape_failed: number | null
          skipped: number | null
          source_provider: string
          started_at: string
          status: string
          total_properties: number | null
          updated: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          errors?: number | null
          finished_at?: string | null
          id?: string
          images_failed?: number | null
          images_processed?: number | null
          images_scraped?: number | null
          imported?: number | null
          marketplace_property_ids?: string[] | null
          organization_id: string
          pending_property_ids?: string[] | null
          scrape_failed?: number | null
          skipped?: number | null
          source_provider?: string
          started_at?: string
          status?: string
          total_properties?: number | null
          updated?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          errors?: number | null
          finished_at?: string | null
          id?: string
          images_failed?: number | null
          images_processed?: number | null
          images_scraped?: number | null
          imported?: number | null
          marketplace_property_ids?: string[] | null
          organization_id?: string
          pending_property_ids?: string[] | null
          scrape_failed?: number | null
          skipped?: number | null
          source_provider?: string
          started_at?: string
          status?: string
          total_properties?: number | null
          updated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      import_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          organization_id: string
          source_property_ids: string[]
          used: boolean | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string
          id?: string
          organization_id: string
          source_property_ids: string[]
          used?: boolean | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          organization_id?: string
          source_property_ids?: string[]
          used?: boolean | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          contract_id: string | null
          created_at: string
          created_by: string
          description: string
          due_date: string
          id: string
          lead_id: string | null
          notes: string | null
          organization_id: string
          paid_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          contract_id?: string | null
          created_at?: string
          created_by: string
          description: string
          due_date: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_interactions: {
        Row: {
          appointment_id: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          lead_id: string
          occurred_at: string
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          lead_id: string
          occurred_at?: string
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          lead_id?: string
          occurred_at?: string
          type?: Database["public"]["Enums"]["interaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_interactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_default: boolean
          is_loss: boolean
          is_win: boolean
          name: string
          organization_id: string | null
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_loss?: boolean
          is_win?: boolean
          name: string
          organization_id?: string | null
          position?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_loss?: boolean
          is_win?: boolean
          name?: string
          organization_id?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_types: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          organization_id: string | null
          position: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          organization_id?: string | null
          position?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          additional_requirements: string | null
          broker_id: string | null
          created_at: string
          created_by: string
          email: string | null
          estimated_value: number | null
          external_id: string | null
          external_source: string | null
          id: string
          imported_at: string | null
          interested_property_type_id: string | null
          interested_property_type_ids: string[] | null
          is_active: boolean
          lead_stage_id: string | null
          lead_type_id: string | null
          max_area: number | null
          max_bathrooms: number | null
          max_bedrooms: number | null
          max_parking: number | null
          min_area: number | null
          min_bathrooms: number | null
          min_bedrooms: number | null
          min_parking: number | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          position: number
          preferred_cities: string[] | null
          preferred_neighborhoods: string[] | null
          property_id: string | null
          source: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          temperature: string | null
          transaction_interest: string | null
          updated_at: string
        }
        Insert: {
          additional_requirements?: string | null
          broker_id?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          estimated_value?: number | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          imported_at?: string | null
          interested_property_type_id?: string | null
          interested_property_type_ids?: string[] | null
          is_active?: boolean
          lead_stage_id?: string | null
          lead_type_id?: string | null
          max_area?: number | null
          max_bathrooms?: number | null
          max_bedrooms?: number | null
          max_parking?: number | null
          min_area?: number | null
          min_bathrooms?: number | null
          min_bedrooms?: number | null
          min_parking?: number | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          position?: number
          preferred_cities?: string[] | null
          preferred_neighborhoods?: string[] | null
          property_id?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          temperature?: string | null
          transaction_interest?: string | null
          updated_at?: string
        }
        Update: {
          additional_requirements?: string | null
          broker_id?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          estimated_value?: number | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          imported_at?: string | null
          interested_property_type_id?: string | null
          interested_property_type_ids?: string[] | null
          is_active?: boolean
          lead_stage_id?: string | null
          lead_type_id?: string | null
          max_area?: number | null
          max_bathrooms?: number | null
          max_bedrooms?: number | null
          max_parking?: number | null
          min_area?: number | null
          min_bathrooms?: number | null
          min_bedrooms?: number | null
          min_parking?: number | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          position?: number
          preferred_cities?: string[] | null
          preferred_neighborhoods?: string[] | null
          property_id?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          temperature?: string | null
          transaction_interest?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_interested_property_type_id_fkey"
            columns: ["interested_property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_lead_stage_id_fkey"
            columns: ["lead_stage_id"]
            isOneToOne: false
            referencedRelation: "lead_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_lead_type_id_fkey"
            columns: ["lead_type_id"]
            isOneToOne: false
            referencedRelation: "lead_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_contact_access: {
        Row: {
          accessed_at: string
          id: string
          marketplace_property_id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          accessed_at?: string
          id?: string
          marketplace_property_id: string
          organization_id: string
          user_id: string
        }
        Update: {
          accessed_at?: string
          id?: string
          marketplace_property_id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_contact_access_marketplace_property_id_fkey"
            columns: ["marketplace_property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_contact_access_marketplace_property_id_fkey"
            columns: ["marketplace_property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_contact_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_properties: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zipcode: string | null
          amenities: string[] | null
          area_built: number | null
          area_total: number | null
          bathrooms: number | null
          bedrooms: number | null
          commission_percentage: number | null
          created_at: string
          description: string | null
          external_code: string | null
          id: string
          images: string[] | null
          is_featured: boolean
          organization_id: string | null
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          parking_spots: number | null
          property_type_id: string | null
          rent_price: number | null
          sale_price: number | null
          status: Database["public"]["Enums"]["property_status"]
          suites: number | null
          title: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          amenities?: string[] | null
          area_built?: number | null
          area_total?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          commission_percentage?: number | null
          created_at?: string
          description?: string | null
          external_code?: string | null
          id?: string
          images?: string[] | null
          is_featured?: boolean
          organization_id?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          parking_spots?: number | null
          property_type_id?: string | null
          rent_price?: number | null
          sale_price?: number | null
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number | null
          title: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          amenities?: string[] | null
          area_built?: number | null
          area_total?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          commission_percentage?: number | null
          created_at?: string
          description?: string | null
          external_code?: string | null
          id?: string
          images?: string[] | null
          is_featured?: boolean
          organization_id?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          parking_spots?: number | null
          property_type_id?: string | null
          rent_price?: number | null
          sale_price?: number | null
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number | null
          title?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_properties_property_type_id_fkey"
            columns: ["property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string | null
          organization_id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          organization_id: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          organization_id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invite_status"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zipcode: string | null
          cnpj: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          invite_code: string
          is_active: boolean
          lead_stages_seeded: boolean
          lead_types_seeded: boolean
          logo_url: string | null
          name: string
          phone: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          type: Database["public"]["Enums"]["organization_type"]
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          invite_code?: string
          is_active?: boolean
          lead_stages_seeded?: boolean
          lead_types_seeded?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          type?: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          invite_code?: string
          is_active?: boolean
          lead_stages_seeded?: boolean
          lead_types_seeded?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          type?: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
        }
        Relationships: []
      }
      owner_aliases: {
        Row: {
          created_at: string
          id: string
          name: string
          occurrence_count: number
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          occurrence_count?: number
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          occurrence_count?: number
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_aliases_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          created_at: string
          document: string | null
          email: string | null
          id: string
          notes: string | null
          organization_id: string
          phone: string
          primary_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          phone: string
          primary_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          phone?: string
          primary_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          invite_email: string | null
          name: string | null
          organization_id: string
          status: string
          used_at: string | null
          used_by_organization_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          invite_email?: string | null
          name?: string | null
          organization_id: string
          status?: string
          used_at?: string | null
          used_by_organization_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          invite_email?: string | null
          name?: string | null
          organization_id?: string
          status?: string
          used_at?: string | null
          used_by_organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_invites_used_by_organization_id_fkey"
            columns: ["used_by_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_feed_logs: {
        Row: {
          duration_ms: number | null
          error_details: Json | null
          errors_count: number
          feed_id: string
          generated_at: string
          id: string
          properties_count: number
        }
        Insert: {
          duration_ms?: number | null
          error_details?: Json | null
          errors_count?: number
          feed_id: string
          generated_at?: string
          id?: string
          properties_count?: number
        }
        Update: {
          duration_ms?: number | null
          error_details?: Json | null
          errors_count?: number
          feed_id?: string
          generated_at?: string
          id?: string
          properties_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "portal_feed_logs_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "portal_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_feeds: {
        Row: {
          created_at: string
          feed_token: string
          feed_url: string | null
          id: string
          is_active: boolean
          last_generated_at: string | null
          organization_id: string
          portal_label: string
          portal_name: string
          property_filter: Json | null
          total_properties_exported: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          feed_token?: string
          feed_url?: string | null
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          organization_id: string
          portal_label: string
          portal_name: string
          property_filter?: Json | null
          total_properties_exported?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          feed_token?: string
          feed_url?: string | null
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          organization_id?: string
          portal_label?: string
          portal_name?: string
          property_filter?: Json | null
          total_properties_exported?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_feeds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          creci: string | null
          creci_verified: boolean
          creci_verified_at: string | null
          creci_verified_name: string | null
          email_verified: boolean | null
          full_name: string
          id: string
          onboarding_completed: boolean | null
          organization_id: string | null
          phone: string | null
          phone_verified: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          creci?: string | null
          creci_verified?: boolean
          creci_verified_at?: string | null
          creci_verified_name?: string | null
          email_verified?: boolean | null
          full_name: string
          id?: string
          onboarding_completed?: boolean | null
          organization_id?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          creci?: string | null
          creci_verified?: boolean
          creci_verified_at?: string | null
          creci_verified_name?: string | null
          email_verified?: boolean | null
          full_name?: string
          id?: string
          onboarding_completed?: boolean | null
          organization_id?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zipcode: string | null
          amenities: string[] | null
          area_built: number | null
          area_total: number | null
          area_useful: number | null
          bathrooms: number | null
          beach_distance_meters: number | null
          bedrooms: number | null
          captador_id: string | null
          commission_type: Database["public"]["Enums"]["commission_type"] | null
          commission_value: number | null
          condominium_fee: number | null
          created_at: string
          created_by: string
          description: string | null
          description_generated: boolean | null
          development_name: string | null
          featured: boolean | null
          floor: number | null
          geocode_error: string | null
          geocode_hash: string | null
          geocode_precision: string | null
          geocode_provider: string | null
          geocode_status: string | null
          geocoded_at: string | null
          id: string
          imobzi_updated_at: string | null
          import_status: string | null
          import_warnings: Json | null
          inspection_fee: number | null
          iptu: number | null
          iptu_monthly: number | null
          latitude: number | null
          launch_stage: Database["public"]["Enums"]["launch_stage"] | null
          longitude: number | null
          organization_id: string
          parking_spots: number | null
          payment_options: string[] | null
          property_code: string | null
          property_condition:
            | Database["public"]["Enums"]["property_condition"]
            | null
          property_type_id: string | null
          raw_payload: Json | null
          rent_price: number | null
          sale_price: number | null
          sale_price_financed: number | null
          source_code: string | null
          source_key_id: string | null
          source_property_id: string | null
          source_provider: string | null
          source_status: string | null
          status: Database["public"]["Enums"]["property_status"]
          suites: number | null
          title: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          amenities?: string[] | null
          area_built?: number | null
          area_total?: number | null
          area_useful?: number | null
          bathrooms?: number | null
          beach_distance_meters?: number | null
          bedrooms?: number | null
          captador_id?: string | null
          commission_type?:
            | Database["public"]["Enums"]["commission_type"]
            | null
          commission_value?: number | null
          condominium_fee?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          description_generated?: boolean | null
          development_name?: string | null
          featured?: boolean | null
          floor?: number | null
          geocode_error?: string | null
          geocode_hash?: string | null
          geocode_precision?: string | null
          geocode_provider?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          id?: string
          imobzi_updated_at?: string | null
          import_status?: string | null
          import_warnings?: Json | null
          inspection_fee?: number | null
          iptu?: number | null
          iptu_monthly?: number | null
          latitude?: number | null
          launch_stage?: Database["public"]["Enums"]["launch_stage"] | null
          longitude?: number | null
          organization_id: string
          parking_spots?: number | null
          payment_options?: string[] | null
          property_code?: string | null
          property_condition?:
            | Database["public"]["Enums"]["property_condition"]
            | null
          property_type_id?: string | null
          raw_payload?: Json | null
          rent_price?: number | null
          sale_price?: number | null
          sale_price_financed?: number | null
          source_code?: string | null
          source_key_id?: string | null
          source_property_id?: string | null
          source_provider?: string | null
          source_status?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number | null
          title?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          amenities?: string[] | null
          area_built?: number | null
          area_total?: number | null
          area_useful?: number | null
          bathrooms?: number | null
          beach_distance_meters?: number | null
          bedrooms?: number | null
          captador_id?: string | null
          commission_type?:
            | Database["public"]["Enums"]["commission_type"]
            | null
          commission_value?: number | null
          condominium_fee?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          description_generated?: boolean | null
          development_name?: string | null
          featured?: boolean | null
          floor?: number | null
          geocode_error?: string | null
          geocode_hash?: string | null
          geocode_precision?: string | null
          geocode_provider?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          id?: string
          imobzi_updated_at?: string | null
          import_status?: string | null
          import_warnings?: Json | null
          inspection_fee?: number | null
          iptu?: number | null
          iptu_monthly?: number | null
          latitude?: number | null
          launch_stage?: Database["public"]["Enums"]["launch_stage"] | null
          longitude?: number | null
          organization_id?: string
          parking_spots?: number | null
          payment_options?: string[] | null
          property_code?: string | null
          property_condition?:
            | Database["public"]["Enums"]["property_condition"]
            | null
          property_type_id?: string | null
          raw_payload?: Json | null
          rent_price?: number | null
          sale_price?: number | null
          sale_price_financed?: number | null
          source_code?: string | null
          source_key_id?: string | null
          source_property_id?: string | null
          source_provider?: string | null
          source_status?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number | null
          title?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_property_type_id_fkey"
            columns: ["property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
        ]
      }
      property_images: {
        Row: {
          cache_status: string | null
          cached_thumbnail_url: string | null
          created_at: string
          display_order: number | null
          drive_file_id: string | null
          id: string
          image_type: Database["public"]["Enums"]["property_image_type"] | null
          is_cover: boolean | null
          phash: string | null
          property_id: string
          scraped_from_url: string | null
          source: string | null
          url: string
        }
        Insert: {
          cache_status?: string | null
          cached_thumbnail_url?: string | null
          created_at?: string
          display_order?: number | null
          drive_file_id?: string | null
          id?: string
          image_type?: Database["public"]["Enums"]["property_image_type"] | null
          is_cover?: boolean | null
          phash?: string | null
          property_id: string
          scraped_from_url?: string | null
          source?: string | null
          url: string
        }
        Update: {
          cache_status?: string | null
          cached_thumbnail_url?: string | null
          created_at?: string
          display_order?: number | null
          drive_file_id?: string | null
          id?: string
          image_type?: Database["public"]["Enums"]["property_image_type"] | null
          is_cover?: boolean | null
          phash?: string | null
          property_id?: string
          scraped_from_url?: string | null
          source?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_landing_content: {
        Row: {
          created_at: string
          cta_primary: string
          cta_secondary: string | null
          description_persuasive: string
          generated_at: string
          headline: string
          id: string
          key_features: Json | null
          model_used: string | null
          property_id: string
          seo_description: string | null
          seo_title: string | null
          subheadline: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_primary: string
          cta_secondary?: string | null
          description_persuasive: string
          generated_at?: string
          headline: string
          id?: string
          key_features?: Json | null
          model_used?: string | null
          property_id: string
          seo_description?: string | null
          seo_title?: string | null
          subheadline?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_primary?: string
          cta_secondary?: string | null
          description_persuasive?: string
          generated_at?: string
          headline?: string
          id?: string
          key_features?: Json | null
          model_used?: string | null
          property_id?: string
          seo_description?: string | null
          seo_title?: string | null
          subheadline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_landing_content_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_landing_overrides: {
        Row: {
          created_at: string
          custom_cta_primary: string | null
          custom_cta_secondary: string | null
          custom_description: string | null
          custom_headline: string | null
          custom_key_features: Json | null
          custom_sections: Json | null
          custom_subheadline: string | null
          hide_exact_address: boolean
          id: string
          map_radius_meters: number
          organization_id: string
          property_id: string
          show_nearby_pois: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_cta_primary?: string | null
          custom_cta_secondary?: string | null
          custom_description?: string | null
          custom_headline?: string | null
          custom_key_features?: Json | null
          custom_sections?: Json | null
          custom_subheadline?: string | null
          hide_exact_address?: boolean
          id?: string
          map_radius_meters?: number
          organization_id: string
          property_id: string
          show_nearby_pois?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_cta_primary?: string | null
          custom_cta_secondary?: string | null
          custom_description?: string | null
          custom_headline?: string | null
          custom_key_features?: Json | null
          custom_sections?: Json | null
          custom_subheadline?: string | null
          hide_exact_address?: boolean
          id?: string
          map_radius_meters?: number
          organization_id?: string
          property_id?: string
          show_nearby_pois?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_landing_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_landing_overrides_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_media: {
        Row: {
          checksum: string | null
          created_at: string | null
          display_order: number | null
          file_size_bytes: number | null
          height: number | null
          id: string
          is_processed: boolean | null
          kind: string
          mime_type: string | null
          organization_id: string
          original_url: string
          phash: string | null
          processing_error: string | null
          property_id: string
          source_media_id: string | null
          storage_path: string | null
          storage_provider: string | null
          stored_url: string | null
          updated_at: string | null
          width: number | null
        }
        Insert: {
          checksum?: string | null
          created_at?: string | null
          display_order?: number | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          is_processed?: boolean | null
          kind: string
          mime_type?: string | null
          organization_id: string
          original_url: string
          phash?: string | null
          processing_error?: string | null
          property_id: string
          source_media_id?: string | null
          storage_path?: string | null
          storage_provider?: string | null
          stored_url?: string | null
          updated_at?: string | null
          width?: number | null
        }
        Update: {
          checksum?: string | null
          created_at?: string | null
          display_order?: number | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          is_processed?: boolean | null
          kind?: string
          mime_type?: string | null
          organization_id?: string
          original_url?: string
          phash?: string | null
          processing_error?: string | null
          property_id?: string
          source_media_id?: string | null
          storage_path?: string | null
          storage_provider?: string | null
          stored_url?: string | null
          updated_at?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_media_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_media_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_owners: {
        Row: {
          created_at: string
          document: string | null
          email: string | null
          id: string
          is_primary: boolean
          name: string
          notes: string | null
          organization_id: string
          owner_id: string | null
          phone: string | null
          property_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          notes?: string | null
          organization_id: string
          owner_id?: string | null
          phone?: string | null
          property_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          owner_id?: string | null
          phone?: string | null
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_owners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_partnerships: {
        Row: {
          commission_split: number
          created_at: string
          expires_at: string | null
          id: string
          notes: string | null
          owner_organization_id: string
          partner_organization_id: string | null
          property_id: string
          status: Database["public"]["Enums"]["partnership_status"]
          updated_at: string
        }
        Insert: {
          commission_split: number
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          owner_organization_id: string
          partner_organization_id?: string | null
          property_id: string
          status?: Database["public"]["Enums"]["partnership_status"]
          updated_at?: string
        }
        Update: {
          commission_split?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          owner_organization_id?: string
          partner_organization_id?: string | null
          property_id?: string
          status?: Database["public"]["Enums"]["partnership_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_partnerships_owner_organization_id_fkey"
            columns: ["owner_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_partnerships_partner_organization_id_fkey"
            columns: ["partner_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_partnerships_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_type_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
          property_type_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
          property_type_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
          property_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_type_codes_property_type_id_fkey"
            columns: ["property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
        ]
      }
      property_types: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_visibility: {
        Row: {
          created_at: string
          id: string
          partnership_commission: number | null
          property_id: string
          show_owner_contact: boolean
          updated_at: string
          visibility: Database["public"]["Enums"]["property_visibility_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          partnership_commission?: number | null
          property_id: string
          show_owner_contact?: boolean
          updated_at?: string
          visibility?: Database["public"]["Enums"]["property_visibility_type"]
        }
        Update: {
          created_at?: string
          id?: string
          partnership_commission?: number | null
          property_id?: string
          show_owner_contact?: boolean
          updated_at?: string
          visibility?: Database["public"]["Enums"]["property_visibility_type"]
        }
        Relationships: [
          {
            foreignKeyName: "property_visibility_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          device_info: Json | null
          fcm_token: string
          id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          fcm_token: string
          id?: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          fcm_token?: string
          id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          notify_new_matches: boolean
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          notify_new_matches?: boolean
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          notify_new_matches?: boolean
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_cache: {
        Row: {
          error_message: string | null
          expires_at: string | null
          id: string
          images: Json | null
          scraped_at: string | null
          status: string | null
          url: string
          url_hash: string
        }
        Insert: {
          error_message?: string | null
          expires_at?: string | null
          id?: string
          images?: Json | null
          scraped_at?: string | null
          status?: string | null
          url: string
          url_hash: string
        }
        Update: {
          error_message?: string | null
          expires_at?: string | null
          id?: string
          images?: Json | null
          scraped_at?: string | null
          status?: string | null
          url?: string
          url_hash?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          features: Json | null
          id: string
          is_active: boolean
          marketplace_access: boolean
          marketplace_views_limit: number | null
          max_leads: number | null
          max_own_properties: number | null
          max_shared_properties: number | null
          max_users: number | null
          name: string
          partnership_access: boolean
          price_monthly: number
          price_yearly: number
          priority_support: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          features?: Json | null
          id?: string
          is_active?: boolean
          marketplace_access?: boolean
          marketplace_views_limit?: number | null
          max_leads?: number | null
          max_own_properties?: number | null
          max_shared_properties?: number | null
          max_users?: number | null
          name: string
          partnership_access?: boolean
          price_monthly: number
          price_yearly: number
          priority_support?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          features?: Json | null
          id?: string
          is_active?: boolean
          marketplace_access?: boolean
          marketplace_views_limit?: number | null
          max_leads?: number | null
          max_own_properties?: number | null
          max_shared_properties?: number | null
          max_users?: number | null
          name?: string
          partnership_access?: boolean
          price_monthly?: number
          price_yearly?: number
          priority_support?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          legacy_stripe_customer_id: string | null
          legacy_stripe_subscription_id: string | null
          organization_id: string
          payment_method: string | null
          plan_id: string
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end: string
          current_period_start?: string
          id?: string
          legacy_stripe_customer_id?: string | null
          legacy_stripe_subscription_id?: string | null
          organization_id: string
          payment_method?: string | null
          plan_id: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          legacy_stripe_customer_id?: string | null
          legacy_stripe_subscription_id?: string | null
          organization_id?: string
          payment_method?: string | null
          plan_id?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          organization_id: string
          priority: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          organization_id: string
          priority?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          priority?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_categories: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          organization_id: string | null
          type: Database["public"]["Enums"]["financial_transaction_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          organization_id?: string | null
          type: Database["public"]["Enums"]["financial_transaction_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string | null
          type?: Database["public"]["Enums"]["financial_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transaction_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          contract_id: string | null
          created_at: string
          created_by: string
          date: string
          description: string
          id: string
          notes: string | null
          organization_id: string
          paid: boolean | null
          paid_at: string | null
          type: Database["public"]["Enums"]["financial_transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by: string
          date: string
          description: string
          id?: string
          notes?: string | null
          organization_id: string
          paid?: boolean | null
          paid_at?: string | null
          type: Database["public"]["Enums"]["financial_transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string
          date?: string
          description?: string
          id?: string
          notes?: string | null
          organization_id?: string
          paid?: boolean | null
          paid_at?: string | null
          type?: Database["public"]["Enums"]["financial_transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          phone: string | null
          type: string
          user_id: string | null
          verified: boolean | null
        }
        Insert: {
          code: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          phone?: string | null
          type: string
          user_id?: string | null
          verified?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          phone?: string | null
          type?: string
          user_id?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      zone_codes: {
        Row: {
          city_code_id: string | null
          code: string
          created_at: string | null
          id: string
          name: string
          neighborhoods: string[] | null
          organization_id: string | null
        }
        Insert: {
          city_code_id?: string | null
          code: string
          created_at?: string | null
          id?: string
          name: string
          neighborhoods?: string[] | null
          organization_id?: string | null
        }
        Update: {
          city_code_id?: string | null
          code?: string
          created_at?: string | null
          id?: string
          name?: string
          neighborhoods?: string[] | null
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zone_codes_city_code_id_fkey"
            columns: ["city_code_id"]
            isOneToOne: false
            referencedRelation: "city_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      marketplace_properties_public: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zipcode: string | null
          amenities: string[] | null
          area_built: number | null
          area_total: number | null
          bathrooms: number | null
          bedrooms: number | null
          created_at: string | null
          description: string | null
          external_code: string | null
          id: string | null
          images: string[] | null
          is_featured: boolean | null
          organization_id: string | null
          parking_spots: number | null
          property_type_id: string | null
          rent_price: number | null
          sale_price: number | null
          status: Database["public"]["Enums"]["property_status"] | null
          suites: number | null
          title: string | null
          transaction_type:
            | Database["public"]["Enums"]["transaction_type"]
            | null
          updated_at: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          amenities?: string[] | null
          area_built?: number | null
          area_total?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string | null
          description?: string | null
          external_code?: string | null
          id?: string | null
          images?: string[] | null
          is_featured?: boolean | null
          organization_id?: string | null
          parking_spots?: number | null
          property_type_id?: string | null
          rent_price?: number | null
          sale_price?: number | null
          status?: Database["public"]["Enums"]["property_status"] | null
          suites?: number | null
          title?: string | null
          transaction_type?:
            | Database["public"]["Enums"]["transaction_type"]
            | null
          updated_at?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          amenities?: string[] | null
          area_built?: number | null
          area_total?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string | null
          description?: string | null
          external_code?: string | null
          id?: string | null
          images?: string[] | null
          is_featured?: boolean | null
          organization_id?: string | null
          parking_spots?: number | null
          property_type_id?: string | null
          rent_price?: number | null
          sale_price?: number | null
          status?: Database["public"]["Enums"]["property_status"] | null
          suites?: number | null
          title?: string | null
          transaction_type?:
            | Database["public"]["Enums"]["transaction_type"]
            | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_properties_property_type_id_fkey"
            columns: ["property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          onboarding_completed: boolean | null
          organization_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          onboarding_completed?: boolean | null
          organization_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          onboarding_completed?: boolean | null
          organization_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_organization_invite: {
        Args: { p_invite_id: string; p_user_email: string; p_user_id: string }
        Returns: Json
      }
      admin_get_growth_metrics: { Args: never; Returns: Json }
      admin_get_org_metrics: { Args: never; Returns: Json }
      admin_get_org_usage: { Args: never; Returns: Json }
      admin_get_properties_by_status: { Args: never; Returns: Json }
      admin_get_system_health: { Args: never; Returns: Json }
      admin_get_table_counts: { Args: never; Returns: Json }
      admin_get_table_sizes: { Args: never; Returns: Json }
      assert_import_run_access: {
        Args: { p_run_id: string; p_user_id: string }
        Returns: boolean
      }
      can_access_marketplace: { Args: { org_id: string }; Returns: boolean }
      can_access_partnerships: { Args: { org_id: string }; Returns: boolean }
      claim_import_chunk: {
        Args: { p_chunk_size: number; p_run_id: string }
        Returns: string[]
      }
      cleanup_expired_import_tokens: { Args: never; Returns: number }
      consume_import_token: {
        Args: { p_org_id: string; p_property_id: string; p_token: string }
        Returns: boolean
      }
      count_new_ad_leads: {
        Args: { p_external_ad_id?: string; p_organization_id: string }
        Returns: number
      }
      create_trial_subscription: { Args: { org_id: string }; Returns: string }
      current_user_has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      fix_user_without_organization: {
        Args: { p_email: string; p_full_name?: string; p_user_id: string }
        Returns: string
      }
      generate_property_code: {
        Args: {
          p_city?: string
          p_neighborhood?: string
          p_organization_id?: string
          p_property_type_id?: string
          p_state?: string
        }
        Returns: string
      }
      get_marketplace_contact: {
        Args: { p_property_id: string }
        Returns: Json
      }
      get_marketplace_properties_safe: {
        Args: { p_organization_id: string }
        Returns: {
          address_city: string
          address_neighborhood: string
          address_number: string
          address_state: string
          address_street: string
          address_zipcode: string
          amenities: string[]
          area_built: number
          area_total: number
          bathrooms: number
          bedrooms: number
          commission_percentage: number
          created_at: string
          description: string
          external_code: string
          id: string
          images: string[]
          is_featured: boolean
          organization_id: string
          parking_spots: number
          property_type_id: string
          rent_price: number
          sale_price: number
          status: Database["public"]["Enums"]["property_status"]
          suites: number
          title: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }[]
      }
      get_org_by_invite_code: {
        Args: { p_invite_code: string }
        Returns: {
          id: string
          invite_code: string
          name: string
        }[]
      }
      get_org_member_emails: {
        Args: { org_id: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_org_name_for_invite: {
        Args: { p_invite_id: string }
        Returns: string
      }
      get_property_cities: {
        Args: { p_organization_id: string }
        Returns: {
          city: string
          count: number
          state: string
        }[]
      }
      get_property_neighborhoods: {
        Args: { p_organization_id: string }
        Returns: {
          city: string
          count: number
          neighborhood: string
        }[]
      }
      get_property_type_name: { Args: { p_type_id: string }; Returns: string }
      get_public_property: {
        Args: { p_id: string }
        Returns: {
          address_city: string
          address_neighborhood: string
          address_state: string
          amenities: string[]
          area_built: number
          area_total: number
          area_useful: number
          bathrooms: number
          bedrooms: number
          condominium_fee: number
          created_at: string
          description: string
          development_name: string
          featured: boolean
          floor: number
          id: string
          iptu: number
          iptu_monthly: number
          latitude: number
          launch_stage: Database["public"]["Enums"]["launch_stage"]
          longitude: number
          organization_id: string
          parking_spots: number
          payment_options: string[]
          property_condition: Database["public"]["Enums"]["property_condition"]
          property_type_id: string
          rent_price: number
          sale_price: number
          status: Database["public"]["Enums"]["property_status"]
          suites: number
          title: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          youtube_url: string
        }[]
      }
      get_public_property_images: {
        Args: { p_property_id: string }
        Returns: {
          display_order: number
          id: string
          image_type: Database["public"]["Enums"]["property_image_type"]
          is_cover: boolean
          source: string
          url: string
        }[]
      }
      get_public_property_media: {
        Args: { p_property_id: string }
        Returns: {
          display_order: number
          id: string
          kind: string
          original_url: string
          stored_url: string
        }[]
      }
      get_subscription_plan_id: { Args: { org_id: string }; Returns: string }
      get_subscription_plan_slug: { Args: { org_id: string }; Returns: string }
      get_user_organization_id: { Args: never; Returns: string }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_active_subscription: { Args: { org_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_import_run_progress: {
        Args: {
          p_errors?: number
          p_images_processed?: number
          p_imported?: number
          p_run_id: string
        }
        Returns: undefined
      }
      insert_notification: {
        Args: {
          p_entity_id?: string
          p_entity_type?: string
          p_message: string
          p_organization_id: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      is_member_of_org: { Args: { _org_id: string }; Returns: boolean }
      is_org_admin: { Args: { _user_id: string }; Returns: boolean }
      is_org_manager: { Args: { _user_id: string }; Returns: boolean }
      is_system_admin: { Args: never; Returns: boolean }
      log_bulk_operation: {
        Args: {
          p_action: string
          p_details?: Json
          p_entity_ids: string[]
          p_entity_type: string
          p_org_id: string
        }
        Returns: string
      }
      normalize_phone: { Args: { phone: string }; Returns: string }
      org_has_active_subscription: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      search_properties_advanced:
        | {
            Args: {
              p_city?: string
              p_limit?: number
              p_max_price?: number
              p_min_area?: number
              p_min_bedrooms?: number
              p_min_price?: number
              p_neighborhood?: string
              p_offset?: number
              p_organization_id: string
              p_property_code?: string
              p_property_type_id?: string
              p_search_text?: string
              p_status?: string
              p_transaction_type?: string
            }
            Returns: {
              address_city: string
              address_neighborhood: string
              address_state: string
              area_built: number
              area_total: number
              bathrooms: number
              bedrooms: number
              cover_image_url: string
              created_at: string
              description: string
              id: string
              parking_spots: number
              property_code: string
              property_type_id: string
              rent_price: number
              sale_price: number
              status: Database["public"]["Enums"]["property_status"]
              title: string
              transaction_type: Database["public"]["Enums"]["transaction_type"]
              updated_at: string
            }[]
          }
        | {
            Args: {
              p_amenities?: string[]
              p_city?: string
              p_launch_stage?: string
              p_limit?: number
              p_max_area?: number
              p_max_beach_distance?: number
              p_max_condominium?: number
              p_max_price?: number
              p_min_area?: number
              p_min_bedrooms?: number
              p_min_condominium?: number
              p_min_parking?: number
              p_min_price?: number
              p_min_suites?: number
              p_neighborhood?: string
              p_offset?: number
              p_organization_id: string
              p_property_code?: string
              p_property_condition?: string
              p_property_type_id?: string
              p_search_text?: string
              p_status?: string
              p_transaction_type?: string
            }
            Returns: {
              address_city: string
              address_neighborhood: string
              address_state: string
              area_built: number
              area_total: number
              bathrooms: number
              bedrooms: number
              cover_image_url: string
              created_at: string
              description: string
              id: string
              parking_spots: number
              property_code: string
              property_type_id: string
              rent_price: number
              sale_price: number
              status: Database["public"]["Enums"]["property_status"]
              title: string
              transaction_type: Database["public"]["Enums"]["transaction_type"]
              updated_at: string
            }[]
          }
      search_properties_by_code: {
        Args: {
          p_code_prefix: string
          p_limit?: number
          p_organization_id: string
        }
        Returns: {
          address_city: string
          address_neighborhood: string
          cover_image_url: string
          id: string
          property_code: string
          rent_price: number
          sale_price: number
          status: Database["public"]["Enums"]["property_status"]
          title: string
        }[]
      }
      search_properties_fuzzy: {
        Args: { p_limit?: number; p_organization_id: string; p_query: string }
        Returns: {
          address_city: string
          address_neighborhood: string
          id: string
          property_code: string
          similarity_score: number
          title: string
        }[]
      }
      search_properties_nearby: {
        Args: {
          p_latitude: number
          p_limit?: number
          p_longitude: number
          p_organization_id: string
          p_radius_km?: number
        }
        Returns: {
          cover_image_url: string
          distance_km: number
          id: string
          latitude: number
          longitude: number
          property_code: string
          rent_price: number
          sale_price: number
          title: string
        }[]
      }
      seed_org_lead_stages: { Args: { p_org_id: string }; Returns: undefined }
      seed_org_lead_types: { Args: { p_org_id: string }; Returns: undefined }
      validate_invite_org_code: {
        Args: { p_code: string; p_org_id: string }
        Returns: boolean
      }
      validate_sync_queue: {
        Args: { p_organization_id: string; p_source_provider?: string }
        Returns: Json
      }
    }
    Enums: {
      ad_entity_type: "campaign" | "adset" | "ad"
      ad_lead_status:
        | "new"
        | "read"
        | "sent_to_crm"
        | "send_failed"
        | "archived"
      ad_provider: "meta" | "google"
      app_role:
        | "admin"
        | "corretor"
        | "assistente"
        | "developer"
        | "leader"
        | "sub_admin"
      billing_cycle: "monthly" | "yearly"
      commission_type: "valor" | "percentual"
      contract_status: "rascunho" | "ativo" | "encerrado" | "cancelado"
      contract_type: "venda" | "locacao"
      financial_transaction_type: "receita" | "despesa"
      interaction_type:
        | "ligacao"
        | "email"
        | "visita"
        | "whatsapp"
        | "reuniao"
        | "nota"
      invite_status: "pending" | "accepted" | "expired" | "cancelled"
      invoice_status: "pendente" | "pago" | "atrasado" | "cancelado"
      launch_stage: "nenhum" | "em_construcao" | "pronto" | "futuro"
      lead_stage:
        | "novo"
        | "contato"
        | "visita"
        | "proposta"
        | "negociacao"
        | "fechado_ganho"
        | "fechado_perdido"
      organization_type: "imobiliaria" | "corretor_individual"
      partnership_status: "pending" | "active" | "rejected" | "expired"
      property_condition: "novo" | "usado"
      property_image_type: "photo" | "floor_plan" | "floor_plan_secondary"
      property_status:
        | "disponivel"
        | "reservado"
        | "vendido"
        | "alugado"
        | "inativo"
        | "com_proposta"
        | "suspenso"
      property_visibility_type: "private" | "partners_only" | "public"
      subscription_status:
        | "trial"
        | "active"
        | "cancelled"
        | "suspended"
        | "expired"
        | "overdue"
        | "pending"
      transaction_type: "venda" | "aluguel" | "ambos"
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
      ad_entity_type: ["campaign", "adset", "ad"],
      ad_lead_status: ["new", "read", "sent_to_crm", "send_failed", "archived"],
      ad_provider: ["meta", "google"],
      app_role: [
        "admin",
        "corretor",
        "assistente",
        "developer",
        "leader",
        "sub_admin",
      ],
      billing_cycle: ["monthly", "yearly"],
      commission_type: ["valor", "percentual"],
      contract_status: ["rascunho", "ativo", "encerrado", "cancelado"],
      contract_type: ["venda", "locacao"],
      financial_transaction_type: ["receita", "despesa"],
      interaction_type: [
        "ligacao",
        "email",
        "visita",
        "whatsapp",
        "reuniao",
        "nota",
      ],
      invite_status: ["pending", "accepted", "expired", "cancelled"],
      invoice_status: ["pendente", "pago", "atrasado", "cancelado"],
      launch_stage: ["nenhum", "em_construcao", "pronto", "futuro"],
      lead_stage: [
        "novo",
        "contato",
        "visita",
        "proposta",
        "negociacao",
        "fechado_ganho",
        "fechado_perdido",
      ],
      organization_type: ["imobiliaria", "corretor_individual"],
      partnership_status: ["pending", "active", "rejected", "expired"],
      property_condition: ["novo", "usado"],
      property_image_type: ["photo", "floor_plan", "floor_plan_secondary"],
      property_status: [
        "disponivel",
        "reservado",
        "vendido",
        "alugado",
        "inativo",
        "com_proposta",
        "suspenso",
      ],
      property_visibility_type: ["private", "partners_only", "public"],
      subscription_status: [
        "trial",
        "active",
        "cancelled",
        "suspended",
        "expired",
        "overdue",
        "pending",
      ],
      transaction_type: ["venda", "aluguel", "ambos"],
    },
  },
} as const
