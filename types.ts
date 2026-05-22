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
      admin_logs: {
        Row: {
          action: string
          admin_id: number
          created_at: string
          details: Json | null
          id: string
          target: string | null
        }
        Insert: {
          action: string
          admin_id: number
          created_at?: string
          details?: Json | null
          id?: string
          target?: string | null
        }
        Update: {
          action?: string
          admin_id?: number
          created_at?: string
          details?: Json | null
          id?: string
          target?: string | null
        }
        Relationships: []
      }
      admins: {
        Row: {
          added_by: number | null
          created_at: string
          role: string
          telegram_id: number
        }
        Insert: {
          added_by?: number | null
          created_at?: string
          role: string
          telegram_id: number
        }
        Update: {
          added_by?: number | null
          created_at?: string
          role?: string
          telegram_id?: number
        }
        Relationships: []
      }
      announcements: {
        Row: {
          active: boolean
          body: string
          created_at: string
          created_by: number
          id: string
          title: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          created_by: number
          id?: string
          title: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: number
          id?: string
          title?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          admin_note: string | null
          amount_gtc: number
          amount_usdt: number
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: number | null
          screenshot_url: string | null
          status: string
          tx_hash: string
          user_id: number
          verification_data: Json | null
        }
        Insert: {
          admin_note?: string | null
          amount_gtc: number
          amount_usdt: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: number | null
          screenshot_url?: string | null
          status?: string
          tx_hash: string
          user_id: number
          verification_data?: Json | null
        }
        Update: {
          admin_note?: string | null
          amount_gtc?: number
          amount_usdt?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: number | null
          screenshot_url?: string | null
          status?: string
          tx_hash?: string
          user_id?: number
          verification_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "deposits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          coins_credited: number
          coins_pending: number
          ended_at: string | null
          id: string
          level_id: string
          paid_revives_used: number
          revives_used: number
          started_at: string
          status: string
          user_id: number
        }
        Insert: {
          coins_credited?: number
          coins_pending?: number
          ended_at?: string | null
          id?: string
          level_id: string
          paid_revives_used?: number
          revives_used?: number
          started_at?: string
          status?: string
          user_id: number
        }
        Update: {
          coins_credited?: number
          coins_pending?: number
          ended_at?: string | null
          id?: string
          level_id?: string
          paid_revives_used?: number
          revives_used?: number
          started_at?: string
          status?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      level_objects: {
        Row: {
          created_at: string
          id: string
          level_id: string
          obj_type: string
          props: Json
          x_time: number
          y: number
        }
        Insert: {
          created_at?: string
          id?: string
          level_id: string
          obj_type: string
          props?: Json
          x_time: number
          y: number
        }
        Update: {
          created_at?: string
          id?: string
          level_id?: string
          obj_type?: string
          props?: Json
          x_time?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "level_objects_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          bg_color: string | null
          created_at: string
          created_by: number
          duration_seconds: number
          enabled: boolean
          free_revives: number
          gravity: number
          id: string
          jump_strength: number
          level_number: number | null
          name: string
          obstacle_config: Json
          paid_revive_base: number
          paid_revive_limit: number
          paid_revive_multiplier: number
          pipe_gap: number
          prize_gtc: number
          repeat_loop: boolean
          reward_per_coin: number
          scroll_speed: number
          updated_at: string
          weight: number
        }
        Insert: {
          bg_color?: string | null
          created_at?: string
          created_by?: number
          duration_seconds?: number
          enabled?: boolean
          free_revives?: number
          gravity?: number
          id?: string
          jump_strength?: number
          level_number?: number | null
          name: string
          obstacle_config?: Json
          paid_revive_base?: number
          paid_revive_limit?: number
          paid_revive_multiplier?: number
          pipe_gap?: number
          prize_gtc?: number
          repeat_loop?: boolean
          reward_per_coin?: number
          scroll_speed?: number
          updated_at?: string
          weight?: number
        }
        Update: {
          bg_color?: string | null
          created_at?: string
          created_by?: number
          duration_seconds?: number
          enabled?: boolean
          free_revives?: number
          gravity?: number
          id?: string
          jump_strength?: number
          level_number?: number | null
          name?: string
          obstacle_config?: Json
          paid_revive_base?: number
          paid_revive_limit?: number
          paid_revive_multiplier?: number
          pipe_gap?: number
          prize_gtc?: number
          repeat_loop?: boolean
          reward_per_coin?: number
          scroll_speed?: number
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_id: number
          referrer_id: number
          reward_gtc: number
        }
        Insert: {
          created_at?: string
          id?: string
          referred_id: number
          referrer_id: number
          reward_gtc: number
        }
        Update: {
          created_at?: string
          id?: string
          referred_id?: number
          referrer_id?: number
          reward_gtc?: number
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["telegram_id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: number | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: number | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: number | null
          value?: Json
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_gtc: number
          balance_after: number
          created_at: string
          id: string
          kind: string
          note: string | null
          ref_id: string | null
          user_id: number
        }
        Insert: {
          amount_gtc: number
          balance_after: number
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          ref_id?: string | null
          user_id: number
        }
        Update: {
          amount_gtc?: number
          balance_after?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          ref_id?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      users: {
        Row: {
          balance_gtc: number
          banned: boolean
          created_at: string
          current_level: number
          first_name: string | null
          is_premium: boolean | null
          language_code: string | null
          last_name: string | null
          last_seen: string
          levels_completed: number
          photo_url: string | null
          referrer_id: number | null
          telegram_id: number
          updated_at: string
          username: string | null
        }
        Insert: {
          balance_gtc?: number
          banned?: boolean
          created_at?: string
          current_level?: number
          first_name?: string | null
          is_premium?: boolean | null
          language_code?: string | null
          last_name?: string | null
          last_seen?: string
          levels_completed?: number
          photo_url?: string | null
          referrer_id?: number | null
          telegram_id: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          balance_gtc?: number
          banned?: boolean
          created_at?: string
          current_level?: number
          first_name?: string | null
          is_premium?: boolean | null
          language_code?: string | null
          last_name?: string | null
          last_seen?: string
          levels_completed?: number
          photo_url?: string | null
          referrer_id?: number | null
          telegram_id?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
