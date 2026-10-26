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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          campaign_id: string
          category: string | null
          created_at: string
          credit: string
          grid_offset_x: number
          grid_offset_y: number
          grid_size: number
          hotkey: number | null
          id: string
          kind: string
          mood: string | null
          name: string
          path: string
          size_bytes: number
          stream_safe: boolean
          thumb_path: string | null
        }
        Insert: {
          campaign_id: string
          category?: string | null
          created_at?: string
          credit?: string
          grid_offset_x?: number
          grid_offset_y?: number
          grid_size?: number
          hotkey?: number | null
          id?: string
          kind: string
          mood?: string | null
          name: string
          path: string
          size_bytes?: number
          stream_safe?: boolean
          thumb_path?: string | null
        }
        Update: {
          campaign_id?: string
          category?: string | null
          created_at?: string
          credit?: string
          grid_offset_x?: number
          grid_offset_y?: number
          grid_size?: number
          hotkey?: number | null
          id?: string
          kind?: string
          mood?: string | null
          name?: string
          path?: string
          size_bytes?: number
          stream_safe?: boolean
          thumb_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_members: {
        Row: {
          campaign_id: string
          dice_style: Json
          display_name: string
          here_tonight: boolean
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          dice_style?: Json
          display_name: string
          here_tonight?: boolean
          joined_at?: string
          role: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          dice_style?: Json
          display_name?: string
          here_tonight?: boolean
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          dm_id: string
          id: string
          join_code: string
          name: string
          party_size: number
          starting_level: number
        }
        Insert: {
          created_at?: string
          dm_id: string
          id?: string
          join_code: string
          name: string
          party_size?: number
          starting_level?: number
        }
        Update: {
          created_at?: string
          dm_id?: string
          id?: string
          join_code?: string
          name?: string
          party_size?: number
          starting_level?: number
        }
        Relationships: []
      }
      characters: {
        Row: {
          armour_class: number
          attacks: Json
          background: string
          campaign_id: string
          charisma: number
          class: string
          concentration: string | null
          conditions: string[]
          constitution: number
          created_at: string
          current_hp: number
          death_save_failures: number
          death_save_successes: number
          dexterity: number
          exhaustion: number
          features: Json
          hit_dice_used: number
          hit_die: number
          id: string
          inspiration: boolean
          intelligence: number
          languages: string
          level: number
          max_hp: number
          name: string
          other_proficiencies: string
          owner_id: string
          portrait_path: string | null
          race: string
          save_proficiencies: string[]
          skill_expertise: string[]
          skill_proficiencies: string[]
          speed: number
          spellcasting: Json
          strength: number
          subclass: string
          subrace: string
          temp_hp: number
          updated_at: string
          wisdom: number
        }
        Insert: {
          armour_class?: number
          attacks?: Json
          background?: string
          campaign_id: string
          charisma?: number
          class?: string
          concentration?: string | null
          conditions?: string[]
          constitution?: number
          created_at?: string
          current_hp?: number
          death_save_failures?: number
          death_save_successes?: number
          dexterity?: number
          exhaustion?: number
          features?: Json
          hit_dice_used?: number
          hit_die?: number
          id?: string
          inspiration?: boolean
          intelligence?: number
          languages?: string
          level?: number
          max_hp?: number
          name: string
          other_proficiencies?: string
          owner_id: string
          portrait_path?: string | null
          race?: string
          save_proficiencies?: string[]
          skill_expertise?: string[]
          skill_proficiencies?: string[]
          speed?: number
          spellcasting?: Json
          strength?: number
          subclass?: string
          subrace?: string
          temp_hp?: number
          updated_at?: string
          wisdom?: number
        }
        Update: {
          armour_class?: number
          attacks?: Json
          background?: string
          campaign_id?: string
          charisma?: number
          class?: string
          concentration?: string | null
          conditions?: string[]
          constitution?: number
          created_at?: string
          current_hp?: number
          death_save_failures?: number
          death_save_successes?: number
          dexterity?: number
          exhaustion?: number
          features?: Json
          hit_dice_used?: number
          hit_die?: number
          id?: string
          inspiration?: boolean
          intelligence?: number
          languages?: string
          level?: number
          max_hp?: number
          name?: string
          other_proficiencies?: string
          owner_id?: string
          portrait_path?: string | null
          race?: string
          save_proficiencies?: string[]
          skill_expertise?: string[]
          skill_proficiencies?: string[]
          speed?: number
          spellcasting?: Json
          strength?: number
          subclass?: string
          subrace?: string
          temp_hp?: number
          updated_at?: string
          wisdom?: number
        }
        Relationships: [
          {
            foreignKeyName: "characters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      combatant_secrets: {
        Row: {
          ac: number
          campaign_id: string
          combatant_id: string
          hp: number
          max_hp: number
          monster: string | null
          name: string
        }
        Insert: {
          ac?: number
          campaign_id: string
          combatant_id: string
          hp?: number
          max_hp?: number
          monster?: string | null
          name: string
        }
        Update: {
          ac?: number
          campaign_id?: string
          combatant_id?: string
          hp?: number
          max_hp?: number
          monster?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "combatant_secrets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combatant_secrets_combatant_id_fkey"
            columns: ["combatant_id"]
            isOneToOne: true
            referencedRelation: "combatants"
            referencedColumns: ["id"]
          },
        ]
      }
      combatants: {
        Row: {
          campaign_id: string
          character_id: string | null
          conditions: string[]
          created_at: string
          encounter_id: string
          health: string
          id: string
          initiative: number | null
          kind: string
          revealed: boolean
          shown_name: string
          tiebreak: number
        }
        Insert: {
          campaign_id: string
          character_id?: string | null
          conditions?: string[]
          created_at?: string
          encounter_id: string
          health?: string
          id?: string
          initiative?: number | null
          kind: string
          revealed?: boolean
          shown_name: string
          tiebreak?: number
        }
        Update: {
          campaign_id?: string
          character_id?: string | null
          conditions?: string[]
          created_at?: string
          encounter_id?: string
          health?: string
          id?: string
          initiative?: number | null
          kind?: string
          revealed?: boolean
          shown_name?: string
          tiebreak?: number
        }
        Relationships: [
          {
            foreignKeyName: "combatants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combatants_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combatants_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_notebooks: {
        Row: {
          campaign_id: string
          key_items: Json
          next_steps: Json
          updated_at: string
          where_we_are: string
        }
        Insert: {
          campaign_id: string
          key_items?: Json
          next_steps?: Json
          updated_at?: string
          where_we_are?: string
        }
        Update: {
          campaign_id?: string
          key_items?: Json
          next_steps?: Json
          updated_at?: string
          where_we_are?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_notebooks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      encounters: {
        Row: {
          campaign_id: string
          current_id: string | null
          ended_at: string | null
          id: string
          round: number
          started_at: string
          status: string
        }
        Insert: {
          campaign_id: string
          current_id?: string | null
          ended_at?: string | null
          id?: string
          round?: number
          started_at?: string
          status?: string
        }
        Update: {
          campaign_id?: string
          current_id?: string | null
          ended_at?: string | null
          id?: string
          round?: number
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "encounters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_current_fkey"
            columns: ["current_id"]
            isOneToOne: false
            referencedRelation: "combatants"
            referencedColumns: ["id"]
          },
        ]
      }
      log_events: {
        Row: {
          author_id: string | null
          campaign_id: string
          created_at: string
          id: string
          kind: string
          text: string
          visible: boolean
        }
        Insert: {
          author_id?: string | null
          campaign_id: string
          created_at?: string
          id?: string
          kind: string
          text: string
          visible?: boolean
        }
        Update: {
          author_id?: string | null
          campaign_id?: string
          created_at?: string
          id?: string
          kind?: string
          text?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "log_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      roll_request_secrets: {
        Row: {
          campaign_id: string
          dc: number
          request_id: string
        }
        Insert: {
          campaign_id: string
          dc: number
          request_id: string
        }
        Update: {
          campaign_id?: string
          dc?: number
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roll_request_secrets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roll_request_secrets_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "roll_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      roll_requests: {
        Row: {
          ability: string
          campaign_id: string
          character_ids: string[]
          closed_at: string | null
          created_at: string
          id: string
          kind: string
          label: string
          plain: string
          shown_dc: number | null
          skill: string | null
          status: string
        }
        Insert: {
          ability: string
          campaign_id: string
          character_ids: string[]
          closed_at?: string | null
          created_at?: string
          id?: string
          kind: string
          label: string
          plain?: string
          shown_dc?: number | null
          skill?: string | null
          status?: string
        }
        Update: {
          ability?: string
          campaign_id?: string
          character_ids?: string[]
          closed_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          label?: string
          plain?: string
          shown_dc?: number | null
          skill?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "roll_requests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      rolls: {
        Row: {
          campaign_id: string
          character_id: string | null
          created_at: string
          damage: Json | null
          dice: Json
          id: string
          kind: string
          label: string
          mode: string
          modifier: number
          natural_d20: number | null
          parts: Json
          passed: boolean | null
          passed_by_dice: boolean | null
          request_id: string | null
          roller_id: string
          secret: boolean
          style: Json
          total: number
        }
        Insert: {
          campaign_id: string
          character_id?: string | null
          created_at?: string
          damage?: Json | null
          dice: Json
          id?: string
          kind: string
          label: string
          mode?: string
          modifier?: number
          natural_d20?: number | null
          parts?: Json
          passed?: boolean | null
          passed_by_dice?: boolean | null
          request_id?: string | null
          roller_id: string
          secret?: boolean
          style?: Json
          total: number
        }
        Update: {
          campaign_id?: string
          character_id?: string | null
          created_at?: string
          damage?: Json | null
          dice?: Json
          id?: string
          kind?: string
          label?: string
          mode?: string
          modifier?: number
          natural_d20?: number | null
          parts?: Json
          passed?: boolean | null
          passed_by_dice?: boolean | null
          request_id?: string | null
          roller_id?: string
          secret?: boolean
          style?: Json
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "rolls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rolls_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rolls_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "roll_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      stage: {
        Row: {
          ambience: Json
          campaign_id: string
          image_id: string | null
          map_id: string | null
          mode: string
          music_id: string | null
          music_playing: boolean
          music_position: number
          music_started_at: string | null
          music_volume: number
          players_move_tokens: boolean
          scene_name: string
          updated_at: string
        }
        Insert: {
          ambience?: Json
          campaign_id: string
          image_id?: string | null
          map_id?: string | null
          mode?: string
          music_id?: string | null
          music_playing?: boolean
          music_position?: number
          music_started_at?: string | null
          music_volume?: number
          players_move_tokens?: boolean
          scene_name?: string
          updated_at?: string
        }
        Update: {
          ambience?: Json
          campaign_id?: string
          image_id?: string | null
          map_id?: string | null
          mode?: string
          music_id?: string | null
          music_playing?: boolean
          music_position?: number
          music_started_at?: string | null
          music_volume?: number
          players_move_tokens?: boolean
          scene_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_music_id_fkey"
            columns: ["music_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens: {
        Row: {
          campaign_id: string
          character_id: string | null
          combatant_id: string | null
          created_at: string
          hidden: boolean
          id: string
          map_id: string
          x: number
          y: number
        }
        Insert: {
          campaign_id: string
          character_id?: string | null
          combatant_id?: string | null
          created_at?: string
          hidden?: boolean
          id?: string
          map_id: string
          x?: number
          y?: number
        }
        Update: {
          campaign_id?: string
          character_id?: string | null
          combatant_id?: string | null
          created_at?: string
          hidden?: boolean
          id?: string
          map_id?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "tokens_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tokens_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tokens_combatant_id_fkey"
            columns: ["combatant_id"]
            isOneToOne: false
            referencedRelation: "combatants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tokens_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ask_for_roll: {
        Args: { p_campaign_id: string; p_request: Json }
        Returns: {
          ability: string
          campaign_id: string
          character_ids: string[]
          closed_at: string | null
          created_at: string
          id: string
          kind: string
          label: string
          plain: string
          shown_dc: number | null
          skill: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "roll_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_roll_request: { Args: { p_request_id: string }; Returns: undefined }
      create_campaign: {
        Args: {
          p_dm_name: string
          p_name: string
          p_party_size?: number
          p_starting_level?: number
        }
        Returns: string
      }
      join_campaign: {
        Args: { p_code: string; p_display_name: string }
        Returns: string
      }
      override_roll: {
        Args: { p_passed: boolean; p_roll_id: string }
        Returns: {
          campaign_id: string
          character_id: string | null
          created_at: string
          damage: Json | null
          dice: Json
          id: string
          kind: string
          label: string
          mode: string
          modifier: number
          natural_d20: number | null
          parts: Json
          passed: boolean | null
          passed_by_dice: boolean | null
          request_id: string | null
          roller_id: string
          secret: boolean
          style: Json
          total: number
        }
        SetofOptions: {
          from: "*"
          to: "rolls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      peek_campaign: {
        Args: { p_code: string }
        Returns: {
          campaign_id: string
          dm_name: string
          name: string
          party_size: number
          starting_level: number
        }[]
      }
      renew_join_code: { Args: { p_campaign_id: string }; Returns: string }
      roll_initiative: {
        Args: { p_combatant_id: string; p_roll: Json }
        Returns: {
          campaign_id: string
          character_id: string | null
          created_at: string
          damage: Json | null
          dice: Json
          id: string
          kind: string
          label: string
          mode: string
          modifier: number
          natural_d20: number | null
          parts: Json
          passed: boolean | null
          passed_by_dice: boolean | null
          request_id: string | null
          roller_id: string
          secret: boolean
          style: Json
          total: number
        }
        SetofOptions: {
          from: "*"
          to: "rolls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      server_time: { Args: never; Returns: string }
      throw_dice: {
        Args: { p_campaign_id: string; p_roll: Json }
        Returns: {
          campaign_id: string
          character_id: string | null
          created_at: string
          damage: Json | null
          dice: Json
          id: string
          kind: string
          label: string
          mode: string
          modifier: number
          natural_d20: number | null
          parts: Json
          passed: boolean | null
          passed_by_dice: boolean | null
          request_id: string | null
          roller_id: string
          secret: boolean
          style: Json
          total: number
        }
        SetofOptions: {
          from: "*"
          to: "rolls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
