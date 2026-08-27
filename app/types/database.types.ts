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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          cover_note: string | null
          created_at: string
          id: string
          project_id: string
          provider_id: string
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
        }
        Insert: {
          cover_note?: string | null
          created_at?: string
          id?: string
          project_id: string
          provider_id: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Update: {
          cover_note?: string | null
          created_at?: string
          id?: string
          project_id?: string
          provider_id?: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_balances"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: number
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
          position: number
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          position?: number
        }
        Relationships: []
      }
      comment_media: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string
          position: number
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url: string
          position?: number
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "comment_media_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          id: string
          parent_comment_id: string | null
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          created_at: string
          dial_code: string
          id: number
          is_active: boolean
          iso2: string
          member_prefix: string
          name: string
        }
        Insert: {
          created_at?: string
          dial_code: string
          id?: never
          is_active?: boolean
          iso2: string
          member_prefix: string
          name: string
        }
        Update: {
          created_at?: string
          dial_code?: string
          id?: never
          is_active?: boolean
          iso2?: string
          member_prefix?: string
          name?: string
        }
        Relationships: []
      }
      deliverables: {
        Row: {
          id: string
          media_type: string | null
          media_url: string
          note: string | null
          project_id: string
          provider_id: string
          submitted_at: string
          version: number
        }
        Insert: {
          id?: string
          media_type?: string | null
          media_url: string
          note?: string | null
          project_id: string
          provider_id: string
          submitted_at?: string
          version?: number
        }
        Update: {
          id?: string
          media_type?: string | null
          media_url?: string
          note?: string | null
          project_id?: string
          provider_id?: string
          submitted_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_balances"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_ledger: {
        Row: {
          amount_myr: number
          created_at: string
          created_by: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          note: string | null
          project_id: string
        }
        Insert: {
          amount_myr: number
          created_at?: string
          created_by?: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          note?: string | null
          project_id: string
        }
        Update: {
          amount_myr?: number
          created_at?: string
          created_by?: string | null
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          note?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_ledger_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_balances"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "escrow_ledger_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      member_id_counters: {
        Row: {
          country_id: number
          last_number: number
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          country_id: number
          last_number?: number
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          country_id?: number
          last_number?: number
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "member_id_counters_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_myr: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payout_provider"]
          payer_id: string
          project_id: string
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount_myr: number
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["payout_provider"]
          payer_id: string
          project_id: string
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount_myr?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payout_provider"]
          payer_id?: string
          project_id?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_balances"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_favorites: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_favorites_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_favorites_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          created_at: string
          id: string
          media_type: string | null
          media_url: string
          position: number
          post_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_type?: string | null
          media_url: string
          position?: number
          post_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string
          position?: number
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_shares: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string | null
          comment_count: number
          created_at: string
          favorite_count: number
          id: string
          share_count: number
          status: Database["public"]["Enums"]["post_status"]
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string | null
          comment_count?: number
          created_at?: string
          favorite_count?: number
          id?: string
          share_count?: number
          status?: Database["public"]["Enums"]["post_status"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          comment_count?: number
          created_at?: string
          favorite_count?: number
          id?: string
          share_count?: number
          status?: Database["public"]["Enums"]["post_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          country_id: number | null
          created_at: string
          email: string
          full_name: string
          home_address: string | null
          id: string
          id_document_image: string | null
          id_document_number: string | null
          kyc_reject_reason: string | null
          kyc_reviewed_at: string | null
          kyc_reviewed_by: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          member_id: string | null
          payout_account: string | null
          payout_provider: Database["public"]["Enums"]["payout_provider"] | null
          phone: string | null
          profile_picture: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          country_id?: number | null
          created_at?: string
          email: string
          full_name: string
          home_address?: string | null
          id: string
          id_document_image?: string | null
          id_document_number?: string | null
          kyc_reject_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_reviewed_by?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          member_id?: string | null
          payout_account?: string | null
          payout_provider?:
            | Database["public"]["Enums"]["payout_provider"]
            | null
          phone?: string | null
          profile_picture?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          country_id?: number | null
          created_at?: string
          email?: string
          full_name?: string
          home_address?: string | null
          id?: string
          id_document_image?: string | null
          id_document_number?: string | null
          kyc_reject_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_reviewed_by?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          member_id?: string | null
          payout_account?: string | null
          payout_provider?:
            | Database["public"]["Enums"]["payout_provider"]
            | null
          phone?: string | null
          profile_picture?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_kyc_reviewed_by_fkey"
            columns: ["kyc_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_kyc_reviewed_by_fkey"
            columns: ["kyc_reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_attachments: {
        Row: {
          created_at: string
          id: string
          label: string | null
          media_type: string | null
          media_url: string
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          media_type?: string | null
          media_url: string
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          media_type?: string | null
          media_url?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_balances"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          assigned_provider_id: string | null
          awarded_application_id: string | null
          awarded_provider_id: string | null
          budget_myr: number
          cancel_reason: string | null
          cancelled_at: string | null
          closed_at: string | null
          created_at: string
          deadline_at: string | null
          description: string | null
          finished_at: string | null
          funded_amount_myr: number | null
          id: string
          requester_id: string
          requirements: string[] | null
          started_at: string | null
          status: Database["public"]["Enums"]["project_status"]
          subcategory_id: number | null
          timeline_minutes: number | null
          title: string
          updated_at: string
          went_live_at: string | null
        }
        Insert: {
          assigned_provider_id?: string | null
          awarded_application_id?: string | null
          awarded_provider_id?: string | null
          budget_myr: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          created_at?: string
          deadline_at?: string | null
          description?: string | null
          finished_at?: string | null
          funded_amount_myr?: number | null
          id?: string
          requester_id: string
          requirements?: string[] | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          subcategory_id?: number | null
          timeline_minutes?: number | null
          title: string
          updated_at?: string
          went_live_at?: string | null
        }
        Update: {
          assigned_provider_id?: string | null
          awarded_application_id?: string | null
          awarded_provider_id?: string | null
          budget_myr?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          created_at?: string
          deadline_at?: string | null
          description?: string | null
          finished_at?: string | null
          funded_amount_myr?: number | null
          id?: string
          requester_id?: string
          requirements?: string[] | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          subcategory_id?: number | null
          timeline_minutes?: number | null
          title?: string
          updated_at?: string
          went_live_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_projects_awarded_application"
            columns: ["awarded_application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_assigned_provider_id_fkey"
            columns: ["assigned_provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_assigned_provider_id_fkey"
            columns: ["assigned_provider_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_awarded_provider_id_fkey"
            columns: ["awarded_provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_awarded_provider_id_fkey"
            columns: ["awarded_provider_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          reason: string | null
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_type: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          reason?: string | null
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_type: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          reason?: string | null
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string
          decision: string
          deliverable_id: string | null
          id: string
          project_id: string
          reason: string | null
          reviewer_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          deliverable_id?: string | null
          id?: string
          project_id: string
          reason?: string | null
          reviewer_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          deliverable_id?: string | null
          id?: string
          project_id?: string
          reason?: string | null
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_balances"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: number
          created_at: string
          id: number
          name: string
          position: number
        }
        Insert: {
          category_id: number
          created_at?: string
          id?: never
          name: string
          position: number
        }
        Update: {
          category_id?: number
          created_at?: string
          id?: never
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      feed_posts: {
        Row: {
          author_id: string | null
          body: string | null
          comment_count: number | null
          created_at: string | null
          favorite_count: number | null
          id: string | null
          share_count: number | null
          status: Database["public"]["Enums"]["post_status"] | null
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          comment_count?: number | null
          created_at?: string | null
          favorite_count?: number | null
          id?: string | null
          share_count?: number | null
          status?: Database["public"]["Enums"]["post_status"] | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string | null
          comment_count?: number | null
          created_at?: string | null
          favorite_count?: number | null
          id?: string | null
          share_count?: number | null
          status?: Database["public"]["Enums"]["post_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_balances: {
        Row: {
          balance_myr: number | null
          funded_amount_myr: number | null
          project_id: string | null
          status: Database["public"]["Enums"]["project_status"] | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          country_id: number | null
          created_at: string | null
          full_name: string | null
          id: string | null
          member_id: string | null
          profile_picture: string | null
          role: Database["public"]["Enums"]["user_role"] | null
        }
        Insert: {
          country_id?: number | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          member_id?: string | null
          profile_picture?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Update: {
          country_id?: number | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          member_id?: string | null
          profile_picture?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_work: {
        Args: { p_project: string; p_reviewer: string }
        Returns: {
          assigned_provider_id: string | null
          awarded_application_id: string | null
          awarded_provider_id: string | null
          budget_myr: number
          cancel_reason: string | null
          cancelled_at: string | null
          closed_at: string | null
          created_at: string
          deadline_at: string | null
          description: string | null
          finished_at: string | null
          funded_amount_myr: number | null
          id: string
          requester_id: string
          requirements: string[] | null
          started_at: string | null
          status: Database["public"]["Enums"]["project_status"]
          subcategory_id: number | null
          timeline_minutes: number | null
          title: string
          updated_at: string
          went_live_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      award_applicant: {
        Args: { p_application: string; p_project: string }
        Returns: {
          assigned_provider_id: string | null
          awarded_application_id: string | null
          awarded_provider_id: string | null
          budget_myr: number
          cancel_reason: string | null
          cancelled_at: string | null
          closed_at: string | null
          created_at: string
          deadline_at: string | null
          description: string | null
          finished_at: string | null
          funded_amount_myr: number | null
          id: string
          requester_id: string
          requirements: string[] | null
          started_at: string | null
          status: Database["public"]["Enums"]["project_status"]
          subcategory_id: number | null
          timeline_minutes: number | null
          title: string
          updated_at: string
          went_live_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_view_project: { Args: { pid: string }; Returns: boolean }
      cancel_project: {
        Args: { p_actor: string; p_project: string; p_reason: string }
        Returns: {
          assigned_provider_id: string | null
          awarded_application_id: string | null
          awarded_provider_id: string | null
          budget_myr: number
          cancel_reason: string | null
          cancelled_at: string | null
          closed_at: string | null
          created_at: string
          deadline_at: string | null
          description: string | null
          finished_at: string | null
          funded_amount_myr: number | null
          id: string
          requester_id: string
          requirements: string[] | null
          started_at: string | null
          status: Database["public"]["Enums"]["project_status"]
          subcategory_id: number | null
          timeline_minutes: number | null
          title: string
          updated_at: string
          went_live_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clear_project: {
        Args: { p_actor: string; p_project: string }
        Returns: {
          assigned_provider_id: string | null
          awarded_application_id: string | null
          awarded_provider_id: string | null
          budget_myr: number
          cancel_reason: string | null
          cancelled_at: string | null
          closed_at: string | null
          created_at: string
          deadline_at: string | null
          description: string | null
          finished_at: string | null
          funded_amount_myr: number | null
          id: string
          requester_id: string
          requirements: string[] | null
          started_at: string | null
          status: Database["public"]["Enums"]["project_status"]
          subcategory_id: number | null
          timeline_minutes: number | null
          title: string
          updated_at: string
          went_live_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      comment_is_visible: { Args: { cid: string }; Returns: boolean }
      fund_project: {
        Args: { p_actor: string; p_amount: number; p_project: string }
        Returns: {
          assigned_provider_id: string | null
          awarded_application_id: string | null
          awarded_provider_id: string | null
          budget_myr: number
          cancel_reason: string | null
          cancelled_at: string | null
          closed_at: string | null
          created_at: string
          deadline_at: string | null
          description: string | null
          finished_at: string | null
          funded_amount_myr: number | null
          id: string
          requester_id: string
          requirements: string[] | null
          started_at: string | null
          status: Database["public"]["Enums"]["project_status"]
          subcategory_id: number | null
          timeline_minutes: number | null
          title: string
          updated_at: string
          went_live_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_admin: { Args: { uid: string }; Returns: boolean }
      is_approved: { Args: { uid: string }; Returns: boolean }
      is_project_party: { Args: { pid: string }; Returns: boolean }
      open_review: {
        Args: { p_project: string }
        Returns: {
          assigned_provider_id: string | null
          awarded_application_id: string | null
          awarded_provider_id: string | null
          budget_myr: number
          cancel_reason: string | null
          cancelled_at: string | null
          closed_at: string | null
          created_at: string
          deadline_at: string | null
          description: string | null
          finished_at: string | null
          funded_amount_myr: number | null
          id: string
          requester_id: string
          requirements: string[] | null
          started_at: string | null
          status: Database["public"]["Enums"]["project_status"]
          subcategory_id: number | null
          timeline_minutes: number | null
          title: string
          updated_at: string
          went_live_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      owns_comment: { Args: { cid: string }; Returns: boolean }
      owns_post: { Args: { pid: string }; Returns: boolean }
      owns_project: { Args: { pid: string }; Returns: boolean }
      post_is_visible: { Args: { pid: string }; Returns: boolean }
      project_is_live: { Args: { pid: string }; Returns: boolean }
      push_project_live: {
        Args: { p_deadline: string; p_project: string }
        Returns: {
          assigned_provider_id: string | null
          awarded_application_id: string | null
          awarded_provider_id: string | null
          budget_myr: number
          cancel_reason: string | null
          cancelled_at: string | null
          closed_at: string | null
          created_at: string
          deadline_at: string | null
          description: string | null
          finished_at: string | null
          funded_amount_myr: number | null
          id: string
          requester_id: string
          requirements: string[] | null
          started_at: string | null
          status: Database["public"]["Enums"]["project_status"]
          subcategory_id: number | null
          timeline_minutes: number | null
          title: string
          updated_at: string
          went_live_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_revision: {
        Args: { p_project: string; p_reason: string; p_reviewer: string }
        Returns: {
          assigned_provider_id: string | null
          awarded_application_id: string | null
          awarded_provider_id: string | null
          budget_myr: number
          cancel_reason: string | null
          cancelled_at: string | null
          closed_at: string | null
          created_at: string
          deadline_at: string | null
          description: string | null
          finished_at: string | null
          funded_amount_myr: number | null
          id: string
          requester_id: string
          requirements: string[] | null
          started_at: string | null
          status: Database["public"]["Enums"]["project_status"]
          subcategory_id: number | null
          timeline_minutes: number | null
          title: string
          updated_at: string
          went_live_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_work: {
        Args: { p_project: string; p_provider: string }
        Returns: {
          assigned_provider_id: string | null
          awarded_application_id: string | null
          awarded_provider_id: string | null
          budget_myr: number
          cancel_reason: string | null
          cancelled_at: string | null
          closed_at: string | null
          created_at: string
          deadline_at: string | null
          description: string | null
          finished_at: string | null
          funded_amount_myr: number | null
          id: string
          requester_id: string
          requirements: string[] | null
          started_at: string | null
          status: Database["public"]["Enums"]["project_status"]
          subcategory_id: number | null
          timeline_minutes: number | null
          title: string
          updated_at: string
          went_live_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_deliverable: {
        Args: {
          p_media_type: string
          p_media_url: string
          p_note: string
          p_project: string
          p_provider: string
        }
        Returns: {
          assigned_provider_id: string | null
          awarded_application_id: string | null
          awarded_provider_id: string | null
          budget_myr: number
          cancel_reason: string | null
          cancelled_at: string | null
          closed_at: string | null
          created_at: string
          deadline_at: string | null
          description: string | null
          finished_at: string | null
          funded_amount_myr: number | null
          id: string
          requester_id: string
          requirements: string[] | null
          started_at: string | null
          status: Database["public"]["Enums"]["project_status"]
          subcategory_id: number | null
          timeline_minutes: number | null
          title: string
          updated_at: string
          went_live_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      application_status: "applied" | "approved" | "rejected"
      kyc_status: "pending" | "approved" | "rejected"
      ledger_entry_type: "fund" | "commission" | "payout" | "refund"
      payment_status: "claimed" | "verified" | "rejected"
      payout_provider: "binance" | "touch_n_go"
      post_status: "active" | "removed"
      project_status:
        | "draft"
        | "submitted"
        | "funded"
        | "live"
        | "awarded"
        | "in_progress"
        | "submitted_work"
        | "in_review"
        | "revision_requested"
        | "finished"
        | "closed"
        | "cancelled"
      report_status: "open" | "reviewed" | "actioned" | "dismissed"
      user_role: "service_requester" | "service_provider" | "admin"
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
      application_status: ["applied", "approved", "rejected"],
      kyc_status: ["pending", "approved", "rejected"],
      ledger_entry_type: ["fund", "commission", "payout", "refund"],
      payment_status: ["claimed", "verified", "rejected"],
      payout_provider: ["binance", "touch_n_go"],
      post_status: ["active", "removed"],
      project_status: [
        "draft",
        "submitted",
        "funded",
        "live",
        "awarded",
        "in_progress",
        "submitted_work",
        "in_review",
        "revision_requested",
        "finished",
        "closed",
        "cancelled",
      ],
      report_status: ["open", "reviewed", "actioned", "dismissed"],
      user_role: ["service_requester", "service_provider", "admin"],
    },
  },
} as const
