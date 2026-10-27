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
      areas: {
        Row: {
          campaign_id: string
          character_id: string | null
          concentration: boolean
          created_at: string
          direction: number
          hidden: boolean
          id: string
          label: string
          map_id: string
          origin_x: number
          origin_y: number
          shape: string
          size_ft: number
          tone: string
        }
        Insert: {
          campaign_id: string
          character_id?: string | null
          concentration?: boolean
          created_at?: string
          direction?: number
          hidden?: boolean
          id?: string
          label?: string
          map_id: string
          origin_x: number
          origin_y: number
          shape: string
          size_ft: number
          tone?: string
        }
        Update: {
          campaign_id?: string
          character_id?: string | null
          concentration?: boolean
          created_at?: string
          direction?: number
          hidden?: boolean
          id?: string
          label?: string
          map_id?: string
          origin_x?: number
          origin_y?: number
          shape?: string
          size_ft?: number
          tone?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "areas_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "areas_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
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
          camera_id: string
          campaign_id: string
          dice_style: Json
          display_name: string
          here_tonight: boolean
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          camera_id?: string
          campaign_id: string
          dice_style?: Json
          display_name: string
          here_tonight?: boolean
          joined_at?: string
          role: string
          user_id: string
        }
        Update: {
          camera_id?: string
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
          camera_key: string
          created_at: string
          dm_id: string
          id: string
          join_code: string
          name: string
          party_size: number
          players_add_gear: boolean
          starting_gold: number
          starting_level: number
        }
        Insert: {
          camera_key?: string
          created_at?: string
          dm_id: string
          id?: string
          join_code: string
          name: string
          party_size?: number
          players_add_gear?: boolean
          starting_gold?: number
          starting_level?: number
        }
        Update: {
          camera_key?: string
          created_at?: string
          dm_id?: string
          id?: string
          join_code?: string
          name?: string
          party_size?: number
          players_add_gear?: boolean
          starting_gold?: number
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
          concentration_dc: number | null
          concentration_queue: number[]
          conditions: string[]
          constitution: number
          created_at: string
          current_hp: number
          dead: boolean
          death_save_failures: number
          death_save_successes: number
          dexterity: number
          effects: Json
          exhaustion: number
          features: Json
          hit_dice_used: number
          hit_die: number
          id: string
          immunities: string[]
          inspiration: boolean
          intelligence: number
          inventory: Json
          languages: string
          level: number
          level_up_to: number | null
          max_hp: number
          name: string
          other_proficiencies: string
          owner_id: string
          portrait_path: string | null
          race: string
          resistances: string[]
          save_proficiencies: string[]
          skill_expertise: string[]
          skill_proficiencies: string[]
          speed: number
          spellcasting: Json
          stable: boolean
          story: Json
          strength: number
          subclass: string
          subrace: string
          temp_hp: number
          updated_at: string
          vulnerabilities: string[]
          wallet: Json
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
          concentration_dc?: number | null
          concentration_queue?: number[]
          conditions?: string[]
          constitution?: number
          created_at?: string
          current_hp?: number
          dead?: boolean
          death_save_failures?: number
          death_save_successes?: number
          dexterity?: number
          effects?: Json
          exhaustion?: number
          features?: Json
          hit_dice_used?: number
          hit_die?: number
          id?: string
          immunities?: string[]
          inspiration?: boolean
          intelligence?: number
          inventory?: Json
          languages?: string
          level?: number
          level_up_to?: number | null
          max_hp?: number
          name: string
          other_proficiencies?: string
          owner_id: string
          portrait_path?: string | null
          race?: string
          resistances?: string[]
          save_proficiencies?: string[]
          skill_expertise?: string[]
          skill_proficiencies?: string[]
          speed?: number
          spellcasting?: Json
          stable?: boolean
          story?: Json
          strength?: number
          subclass?: string
          subrace?: string
          temp_hp?: number
          updated_at?: string
          vulnerabilities?: string[]
          wallet?: Json
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
          concentration_dc?: number | null
          concentration_queue?: number[]
          conditions?: string[]
          constitution?: number
          created_at?: string
          current_hp?: number
          dead?: boolean
          death_save_failures?: number
          death_save_successes?: number
          dexterity?: number
          effects?: Json
          exhaustion?: number
          features?: Json
          hit_dice_used?: number
          hit_die?: number
          id?: string
          immunities?: string[]
          inspiration?: boolean
          intelligence?: number
          inventory?: Json
          languages?: string
          level?: number
          level_up_to?: number | null
          max_hp?: number
          name?: string
          other_proficiencies?: string
          owner_id?: string
          portrait_path?: string | null
          race?: string
          resistances?: string[]
          save_proficiencies?: string[]
          skill_expertise?: string[]
          skill_proficiencies?: string[]
          speed?: number
          spellcasting?: Json
          stable?: boolean
          story?: Json
          strength?: number
          subclass?: string
          subrace?: string
          temp_hp?: number
          updated_at?: string
          vulnerabilities?: string[]
          wallet?: Json
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
      clock_secrets: {
        Row: {
          campaign_id: string
          combatant_id: string
          condition: string
          dc: number
        }
        Insert: {
          campaign_id: string
          combatant_id: string
          condition: string
          dc: number
        }
        Update: {
          campaign_id?: string
          combatant_id?: string
          condition?: string
          dc?: number
        }
        Relationships: [
          {
            foreignKeyName: "clock_secrets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_secrets_combatant_id_fkey"
            columns: ["combatant_id"]
            isOneToOne: false
            referencedRelation: "combatants"
            referencedColumns: ["id"]
          },
        ]
      }
      combat_event_secrets: {
        Row: {
          ac: number | null
          actor_before: Json | null
          campaign_id: string
          event_id: string
          target_before: Json | null
        }
        Insert: {
          ac?: number | null
          actor_before?: Json | null
          campaign_id: string
          event_id: string
          target_before?: Json | null
        }
        Update: {
          ac?: number | null
          actor_before?: Json | null
          campaign_id?: string
          event_id?: string
          target_before?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "combat_event_secrets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_event_secrets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "combat_events"
            referencedColumns: ["id"]
          },
        ]
      }
      combat_events: {
        Row: {
          actor_id: string | null
          campaign_id: string
          created_at: string
          encounter_id: string
          id: string
          kind: string
          roll_id: string | null
          round: number
          seq: number
          shown: Json
          target_id: string | null
          undone: boolean
        }
        Insert: {
          actor_id?: string | null
          campaign_id: string
          created_at?: string
          encounter_id: string
          id?: string
          kind: string
          roll_id?: string | null
          round: number
          seq?: never
          shown?: Json
          target_id?: string | null
          undone?: boolean
        }
        Update: {
          actor_id?: string | null
          campaign_id?: string
          created_at?: string
          encounter_id?: string
          id?: string
          kind?: string
          roll_id?: string | null
          round?: number
          seq?: never
          shown?: Json
          target_id?: string | null
          undone?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "combat_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "combatants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_events_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_events_roll_id_fkey"
            columns: ["roll_id"]
            isOneToOne: false
            referencedRelation: "rolls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_events_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "combatants"
            referencedColumns: ["id"]
          },
        ]
      }
      combatant_secrets: {
        Row: {
          ac: number
          campaign_id: string
          combatant_id: string
          condition_immunities: string[]
          hp: number
          immunities: string[]
          max_hp: number
          monster: string | null
          name: string
          resistances: string[]
          saves: Json
          traits: string[]
          vulnerabilities: string[]
        }
        Insert: {
          ac?: number
          campaign_id: string
          combatant_id: string
          condition_immunities?: string[]
          hp?: number
          immunities?: string[]
          max_hp?: number
          monster?: string | null
          name: string
          resistances?: string[]
          saves?: Json
          traits?: string[]
          vulnerabilities?: string[]
        }
        Update: {
          ac?: number
          campaign_id?: string
          combatant_id?: string
          condition_immunities?: string[]
          hp?: number
          immunities?: string[]
          max_hp?: number
          monster?: string | null
          name?: string
          resistances?: string[]
          saves?: Json
          traits?: string[]
          vulnerabilities?: string[]
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
          action_used: boolean
          art: string | null
          attacks_made: number
          bonus_used: boolean
          campaign_id: string
          character_id: string | null
          condition_clocks: Json
          conditions: string[]
          created_at: string
          disengaged: boolean
          dodging: boolean
          encounter_id: string
          extra_feet: number
          feet_moved: number
          health: string
          id: string
          initiative: number | null
          kind: string
          reach_ft: number
          reaction_used: boolean
          revealed: boolean
          shown_name: string
          speed: number
          stance: string
          tiebreak: number
        }
        Insert: {
          action_used?: boolean
          art?: string | null
          attacks_made?: number
          bonus_used?: boolean
          campaign_id: string
          character_id?: string | null
          condition_clocks?: Json
          conditions?: string[]
          created_at?: string
          disengaged?: boolean
          dodging?: boolean
          encounter_id: string
          extra_feet?: number
          feet_moved?: number
          health?: string
          id?: string
          initiative?: number | null
          kind: string
          reach_ft?: number
          reaction_used?: boolean
          revealed?: boolean
          shown_name: string
          speed?: number
          stance?: string
          tiebreak?: number
        }
        Update: {
          action_used?: boolean
          art?: string | null
          attacks_made?: number
          bonus_used?: boolean
          campaign_id?: string
          character_id?: string | null
          condition_clocks?: Json
          conditions?: string[]
          created_at?: string
          disengaged?: boolean
          dodging?: boolean
          encounter_id?: string
          extra_feet?: number
          feet_moved?: number
          health?: string
          id?: string
          initiative?: number | null
          kind?: string
          reach_ft?: number
          reaction_used?: boolean
          revealed?: boolean
          shown_name?: string
          speed?: number
          stance?: string
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
      dm_items: {
        Row: {
          campaign_id: string
          created_at: string
          description: string
          id: string
          key: boolean
          name: string
          rarity: string | null
          type: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          description?: string
          id?: string
          key?: boolean
          name: string
          rarity?: string | null
          type?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          description?: string
          id?: string
          key?: boolean
          name?: string
          rarity?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_notebooks: {
        Row: {
          box_settings: Json
          campaign_id: string
          current_scene_id: string | null
          key_items: Json
          next_steps: Json
          updated_at: string
          where_we_are: string
        }
        Insert: {
          box_settings?: Json
          campaign_id: string
          current_scene_id?: string | null
          key_items?: Json
          next_steps?: Json
          updated_at?: string
          where_we_are?: string
        }
        Update: {
          box_settings?: Json
          campaign_id?: string
          current_scene_id?: string | null
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
          {
            foreignKeyName: "dm_notebooks_current_scene_id_fkey"
            columns: ["current_scene_id"]
            isOneToOne: false
            referencedRelation: "story_scenes"
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
          parley: boolean
          round: number
          started_at: string
          status: string
        }
        Insert: {
          campaign_id: string
          current_id?: string | null
          ended_at?: string | null
          id?: string
          parley?: boolean
          round?: number
          started_at?: string
          status?: string
        }
        Update: {
          campaign_id?: string
          current_id?: string | null
          ended_at?: string | null
          id?: string
          parley?: boolean
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
      haggles: {
        Row: {
          answered_at: string | null
          asking: number
          bundles: number
          campaign_id: string
          character_id: string
          counter: number | null
          created_at: string
          id: string
          item_name: string
          offer: number
          proficient: boolean | null
          shop_id: string
          status: string
          stock_id: string
        }
        Insert: {
          answered_at?: string | null
          asking: number
          bundles: number
          campaign_id: string
          character_id: string
          counter?: number | null
          created_at?: string
          id?: string
          item_name: string
          offer: number
          proficient?: boolean | null
          shop_id: string
          status?: string
          stock_id: string
        }
        Update: {
          answered_at?: string | null
          asking?: number
          bundles?: number
          campaign_id?: string
          character_id?: string
          counter?: number | null
          created_at?: string
          id?: string
          item_name?: string
          offer?: number
          proficient?: boolean | null
          shop_id?: string
          status?: string
          stock_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "haggles_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "haggles_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "haggles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      log_events: {
        Row: {
          author_id: string | null
          campaign_id: string
          created_at: string
          data: Json
          id: string
          kind: string
          text: string
          visible: boolean
        }
        Insert: {
          author_id?: string | null
          campaign_id: string
          created_at?: string
          data?: Json
          id?: string
          kind: string
          text: string
          visible?: boolean
        }
        Update: {
          author_id?: string | null
          campaign_id?: string
          created_at?: string
          data?: Json
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
      npcs: {
        Row: {
          attitude: string
          campaign_id: string
          created_at: string
          history: Json
          id: string
          knows: string
          name: string
          place: string
          portrait_id: string | null
          role: string
          secrets: string
          shop_id: string | null
          voice: string
          wants: string
        }
        Insert: {
          attitude?: string
          campaign_id: string
          created_at?: string
          history?: Json
          id?: string
          knows?: string
          name: string
          place?: string
          portrait_id?: string | null
          role?: string
          secrets?: string
          shop_id?: string | null
          voice?: string
          wants?: string
        }
        Update: {
          attitude?: string
          campaign_id?: string
          created_at?: string
          history?: Json
          id?: string
          knows?: string
          name?: string
          place?: string
          portrait_id?: string | null
          role?: string
          secrets?: string
          shop_id?: string | null
          voice?: string
          wants?: string
        }
        Relationships: [
          {
            foreignKeyName: "npcs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npcs_portrait_id_fkey"
            columns: ["portrait_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npcs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          answered_at: string | null
          campaign_id: string
          character_id: string
          copper: number
          created_at: string
          id: string
          item_id: string
          item_name: string
          quantity: number
          status: string
        }
        Insert: {
          answered_at?: string | null
          campaign_id: string
          character_id: string
          copper: number
          created_at?: string
          id?: string
          item_id: string
          item_name: string
          quantity: number
          status?: string
        }
        Update: {
          answered_at?: string | null
          campaign_id?: string
          character_id?: string
          copper?: number
          created_at?: string
          id?: string
          item_id?: string
          item_name?: string
          quantity?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      party_stash: {
        Row: {
          campaign_id: string
          items: Json
          updated_at: string
          wallet: Json
        }
        Insert: {
          campaign_id: string
          items?: Json
          updated_at?: string
          wallet?: Json
        }
        Update: {
          campaign_id?: string
          items?: Json
          updated_at?: string
          wallet?: Json
        }
        Relationships: [
          {
            foreignKeyName: "party_stash_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      reaction_prompts: {
        Row: {
          campaign_id: string
          combatant_id: string
          created_at: string
          encounter_id: string
          id: string
          kind: string
          provoker_id: string
          status: string
        }
        Insert: {
          campaign_id: string
          combatant_id: string
          created_at?: string
          encounter_id: string
          id?: string
          kind?: string
          provoker_id: string
          status?: string
        }
        Update: {
          campaign_id?: string
          combatant_id?: string
          created_at?: string
          encounter_id?: string
          id?: string
          kind?: string
          provoker_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reaction_prompts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reaction_prompts_combatant_id_fkey"
            columns: ["combatant_id"]
            isOneToOne: false
            referencedRelation: "combatants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reaction_prompts_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reaction_prompts_provoker_id_fkey"
            columns: ["provoker_id"]
            isOneToOne: false
            referencedRelation: "combatants"
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
          outcome_shown: boolean
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
          outcome_shown?: boolean
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
          outcome_shown?: boolean
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
      roll_verdicts: {
        Row: {
          campaign_id: string
          passed: boolean
          passed_by_dice: boolean | null
          request_id: string
          roll_id: string
        }
        Insert: {
          campaign_id: string
          passed: boolean
          passed_by_dice?: boolean | null
          request_id: string
          roll_id: string
        }
        Update: {
          campaign_id?: string
          passed?: boolean
          passed_by_dice?: boolean | null
          request_id?: string
          roll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roll_verdicts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roll_verdicts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "roll_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roll_verdicts_roll_id_fkey"
            columns: ["roll_id"]
            isOneToOne: true
            referencedRelation: "rolls"
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
          for_dm: boolean
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
          for_dm?: boolean
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
          for_dm?: boolean
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
      sales: {
        Row: {
          campaign_id: string
          character_id: string
          copper: number
          created_at: string
          id: string
          item: Json
          kind: string
          quantity: number
          shop_id: string | null
          stock_id: string | null
          undone: boolean
        }
        Insert: {
          campaign_id: string
          character_id: string
          copper: number
          created_at?: string
          id?: string
          item: Json
          kind: string
          quantity: number
          shop_id?: string | null
          stock_id?: string | null
          undone?: boolean
        }
        Update: {
          campaign_id?: string
          character_id?: string
          copper?: number
          created_at?: string
          id?: string
          item?: Json
          kind?: string
          quantity?: number
          shop_id?: string | null
          stock_id?: string | null
          undone?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sales_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_notes: {
        Row: {
          campaign_id: string
          note: string
          shop_id: string
        }
        Insert: {
          campaign_id: string
          note?: string
          shop_id: string
        }
        Update: {
          campaign_id?: string
          note?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_notes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_notes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          buys: boolean
          campaign_id: string
          created_at: string
          id: string
          keeper: string
          kind: string
          markup: number
          name: string
          open: boolean
          stock: Json
          updated_at: string
        }
        Insert: {
          buys?: boolean
          campaign_id: string
          created_at?: string
          id?: string
          keeper?: string
          kind: string
          markup?: number
          name: string
          open?: boolean
          stock?: Json
          updated_at?: string
        }
        Update: {
          buys?: boolean
          campaign_id?: string
          created_at?: string
          id?: string
          keeper?: string
          kind?: string
          markup?: number
          name?: string
          open?: boolean
          stock?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shops_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      srd_prices: {
        Row: {
          bundle: number
          cost: number
          index: string
        }
        Insert: {
          bundle?: number
          cost: number
          index: string
        }
        Update: {
          bundle?: number
          cost?: number
          index?: string
        }
        Relationships: []
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
          npc_image_id: string | null
          npc_name: string
          npc_role: string
          players_move_tokens: boolean
          read_aloud: string
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
          npc_image_id?: string | null
          npc_name?: string
          npc_role?: string
          players_move_tokens?: boolean
          read_aloud?: string
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
          npc_image_id?: string | null
          npc_name?: string
          npc_role?: string
          players_move_tokens?: boolean
          read_aloud?: string
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
          {
            foreignKeyName: "stage_npc_image_id_fkey"
            columns: ["npc_image_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      story_chapters: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          position: number
          title: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          position?: number
          title?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_chapters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      story_scenes: {
        Row: {
          ambience: Json
          campaign_id: string
          chapter_id: string
          choices: Json
          created_at: string
          fight: Json | null
          id: string
          image_id: string | null
          music_id: string | null
          people: Json
          place: string
          position: number
          read_aloud: string
          reminders: string
          rolls: Json
          things: Json
          title: string
          updated_at: string
        }
        Insert: {
          ambience?: Json
          campaign_id: string
          chapter_id: string
          choices?: Json
          created_at?: string
          fight?: Json | null
          id?: string
          image_id?: string | null
          music_id?: string | null
          people?: Json
          place?: string
          position?: number
          read_aloud?: string
          reminders?: string
          rolls?: Json
          things?: Json
          title?: string
          updated_at?: string
        }
        Update: {
          ambience?: Json
          campaign_id?: string
          chapter_id?: string
          choices?: Json
          created_at?: string
          fight?: Json | null
          id?: string
          image_id?: string | null
          music_id?: string | null
          people?: Json
          place?: string
          position?: number
          read_aloud?: string
          reminders?: string
          rolls?: Json
          things?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_scenes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_scenes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "story_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_scenes_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_scenes_music_id_fkey"
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
      accept_dice: {
        Args: { p_request_id: string }
        Returns: {
          campaign_id: string
          character_id: string | null
          created_at: string
          damage: Json | null
          dice: Json
          for_dm: boolean
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
        }[]
        SetofOptions: {
          from: "*"
          to: "rolls"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      answer_haggle: {
        Args: { p_agree: boolean; p_counter: number; p_haggle_id: string }
        Returns: {
          answered_at: string | null
          asking: number
          bundles: number
          campaign_id: string
          character_id: string
          counter: number | null
          created_at: string
          id: string
          item_name: string
          offer: number
          proficient: boolean | null
          shop_id: string
          status: string
          stock_id: string
        }
        SetofOptions: {
          from: "*"
          to: "haggles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      answer_offer: {
        Args: { p_offer_id: string; p_sell: boolean }
        Returns: {
          answered_at: string | null
          campaign_id: string
          character_id: string
          copper: number
          created_at: string
          id: string
          item_id: string
          item_name: string
          quantity: number
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "offers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      answer_talk: {
        Args: { p_answer: string; p_event_id: string; p_outcome: string }
        Returns: {
          actor_id: string | null
          campaign_id: string
          created_at: string
          encounter_id: string
          id: string
          kind: string
          roll_id: string | null
          round: number
          seq: number
          shown: Json
          target_id: string | null
          undone: boolean
        }
        SetofOptions: {
          from: "*"
          to: "combat_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
          outcome_shown: boolean
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
      bonus_attack: {
        Args: {
          p_attacker_id: string
          p_kind: string
          p_roll: Json
          p_target_id: string
        }
        Returns: Json
      }
      break_free: { Args: { p_combatant_id: string }; Returns: Json }
      buy_item: {
        Args: {
          p_bundles: number
          p_character_id: string
          p_proficient: boolean
          p_shop_id: string
          p_stock_id: string
        }
        Returns: {
          campaign_id: string
          character_id: string
          copper: number
          created_at: string
          id: string
          item: Json
          kind: string
          quantity: number
          shop_id: string | null
          stock_id: string | null
          undone: boolean
        }
        SetofOptions: {
          from: "*"
          to: "sales"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cast_spell: {
        Args: {
          p_area: Json
          p_combatant_id: string
          p_roll: Json
          p_slot_level: number
          p_spell: Json
          p_target_ids: string[]
        }
        Returns: Json
      }
      clear_stash: {
        Args: { p_campaign_id: string }
        Returns: {
          campaign_id: string
          items: Json
          updated_at: string
          wallet: Json
        }
        SetofOptions: {
          from: "*"
          to: "party_stash"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_roll_request: { Args: { p_request_id: string }; Returns: undefined }
      concentration_save: { Args: { p_character_id: string }; Returns: Json }
      condition_save: {
        Args: { p_combatant_id: string; p_condition: string }
        Returns: Json
      }
      create_campaign: {
        Args: {
          p_dm_name: string
          p_name: string
          p_party_size?: number
          p_starting_level?: number
        }
        Returns: string
      }
      death_save: { Args: { p_combatant_id: string }; Returns: Json }
      end_fight: {
        Args: { p_encounter_id: string }
        Returns: {
          campaign_id: string
          current_id: string | null
          ended_at: string | null
          id: string
          parley: boolean
          round: number
          started_at: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "encounters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      end_turn: {
        Args: { p_encounter_id: string }
        Returns: {
          campaign_id: string
          current_id: string | null
          ended_at: string | null
          id: string
          parley: boolean
          round: number
          started_at: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "encounters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      give_items: {
        Args: {
          p_character_id: string
          p_copper: number
          p_items: Json
          p_weapons: Json
        }
        Returns: {
          armour_class: number
          attacks: Json
          background: string
          campaign_id: string
          charisma: number
          class: string
          concentration: string | null
          concentration_dc: number | null
          concentration_queue: number[]
          conditions: string[]
          constitution: number
          created_at: string
          current_hp: number
          dead: boolean
          death_save_failures: number
          death_save_successes: number
          dexterity: number
          effects: Json
          exhaustion: number
          features: Json
          hit_dice_used: number
          hit_die: number
          id: string
          immunities: string[]
          inspiration: boolean
          intelligence: number
          inventory: Json
          languages: string
          level: number
          level_up_to: number | null
          max_hp: number
          name: string
          other_proficiencies: string
          owner_id: string
          portrait_path: string | null
          race: string
          resistances: string[]
          save_proficiencies: string[]
          skill_expertise: string[]
          skill_proficiencies: string[]
          speed: number
          spellcasting: Json
          stable: boolean
          story: Json
          strength: number
          subclass: string
          subrace: string
          temp_hp: number
          updated_at: string
          vulnerabilities: string[]
          wallet: Json
          wisdom: number
        }
        SetofOptions: {
          from: "*"
          to: "characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      grant_level_up: {
        Args: { p_character_ids: string[] }
        Returns: {
          armour_class: number
          attacks: Json
          background: string
          campaign_id: string
          charisma: number
          class: string
          concentration: string | null
          concentration_dc: number | null
          concentration_queue: number[]
          conditions: string[]
          constitution: number
          created_at: string
          current_hp: number
          dead: boolean
          death_save_failures: number
          death_save_successes: number
          dexterity: number
          effects: Json
          exhaustion: number
          features: Json
          hit_dice_used: number
          hit_die: number
          id: string
          immunities: string[]
          inspiration: boolean
          intelligence: number
          inventory: Json
          languages: string
          level: number
          level_up_to: number | null
          max_hp: number
          name: string
          other_proficiencies: string
          owner_id: string
          portrait_path: string | null
          race: string
          resistances: string[]
          save_proficiencies: string[]
          skill_expertise: string[]
          skill_proficiencies: string[]
          speed: number
          spellcasting: Json
          stable: boolean
          story: Json
          strength: number
          subclass: string
          subrace: string
          temp_hp: number
          updated_at: string
          vulnerabilities: string[]
          wallet: Json
          wisdom: number
        }[]
        SetofOptions: {
          from: "*"
          to: "characters"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      haggle: {
        Args: {
          p_bundles: number
          p_character_id: string
          p_offer: number
          p_proficient: boolean
          p_shop_id: string
          p_stock_id: string
        }
        Returns: {
          answered_at: string | null
          asking: number
          bundles: number
          campaign_id: string
          character_id: string
          counter: number | null
          created_at: string
          id: string
          item_name: string
          offer: number
          proficient: boolean | null
          shop_id: string
          status: string
          stock_id: string
        }
        SetofOptions: {
          from: "*"
          to: "haggles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hand_over: {
        Args: {
          p_coins: Json
          p_from: string
          p_item_id: string
          p_proficient: boolean
          p_quantity: number
          p_to: string
        }
        Returns: {
          armour_class: number
          attacks: Json
          background: string
          campaign_id: string
          charisma: number
          class: string
          concentration: string | null
          concentration_dc: number | null
          concentration_queue: number[]
          conditions: string[]
          constitution: number
          created_at: string
          current_hp: number
          dead: boolean
          death_save_failures: number
          death_save_successes: number
          dexterity: number
          effects: Json
          exhaustion: number
          features: Json
          hit_dice_used: number
          hit_die: number
          id: string
          immunities: string[]
          inspiration: boolean
          intelligence: number
          inventory: Json
          languages: string
          level: number
          level_up_to: number | null
          max_hp: number
          name: string
          other_proficiencies: string
          owner_id: string
          portrait_path: string | null
          race: string
          resistances: string[]
          save_proficiencies: string[]
          skill_expertise: string[]
          skill_proficiencies: string[]
          speed: number
          spellcasting: Json
          stable: boolean
          story: Json
          strength: number
          subclass: string
          subrace: string
          temp_hp: number
          updated_at: string
          vulnerabilities: string[]
          wallet: Json
          wisdom: number
        }
        SetofOptions: {
          from: "*"
          to: "characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      join_campaign: {
        Args: { p_code: string; p_display_name: string }
        Returns: string
      }
      make_offer: {
        Args: {
          p_character_id: string
          p_copper: number
          p_item_id: string
          p_quantity: number
        }
        Returns: {
          answered_at: string | null
          campaign_id: string
          character_id: string
          copper: number
          created_at: string
          id: string
          item_id: string
          item_name: string
          quantity: number
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "offers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      move_token: {
        Args: { p_token_id: string; p_x: number; p_y: number }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "tokens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      name_roll: {
        Args: {
          p_dc: number
          p_kind: string
          p_label: string
          p_modifier: number
          p_parts: Json
          p_passed: boolean
          p_roll_id: string
        }
        Returns: {
          campaign_id: string
          character_id: string | null
          created_at: string
          damage: Json | null
          dice: Json
          for_dm: boolean
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
      offhand_attack: {
        Args: { p_attacker_id: string; p_roll: Json; p_target_id: string }
        Returns: Json
      }
      opportunity_attack: {
        Args: { p_prompt_id: string; p_roll: Json }
        Returns: Json
      }
      override_roll: {
        Args: { p_passed: boolean; p_roll_id: string }
        Returns: {
          campaign_id: string
          character_id: string | null
          created_at: string
          damage: Json | null
          dice: Json
          for_dm: boolean
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
      pass_reaction: {
        Args: { p_prompt_id: string }
        Returns: {
          campaign_id: string
          combatant_id: string
          created_at: string
          encounter_id: string
          id: string
          kind: string
          provoker_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "reaction_prompts"
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
      put_on_table: {
        Args: { p_campaign_id: string; p_copper: number; p_items: Json }
        Returns: {
          campaign_id: string
          items: Json
          updated_at: string
          wallet: Json
        }
        SetofOptions: {
          from: "*"
          to: "party_stash"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_from_stash: {
        Args: { p_campaign_id: string; p_item_id: string }
        Returns: {
          campaign_id: string
          items: Json
          updated_at: string
          wallet: Json
        }
        SetofOptions: {
          from: "*"
          to: "party_stash"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      renew_camera_key: { Args: { p_campaign_id: string }; Returns: undefined }
      renew_join_code: { Args: { p_campaign_id: string }; Returns: string }
      resolve_attack: {
        Args: { p_attacker_id: string; p_roll: Json; p_target_id: string }
        Returns: Json
      }
      roll_for_dm: {
        Args: { p_campaign_id: string; p_character_id: string; p_mode: string }
        Returns: {
          campaign_id: string
          character_id: string | null
          created_at: string
          damage: Json | null
          dice: Json
          for_dm: boolean
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
      roll_initiative: {
        Args: { p_combatant_id: string; p_roll: Json }
        Returns: {
          campaign_id: string
          character_id: string | null
          created_at: string
          damage: Json | null
          dice: Json
          for_dm: boolean
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
      sell_item: {
        Args: {
          p_character_id: string
          p_item_id: string
          p_quantity: number
          p_shop_id: string
        }
        Returns: {
          campaign_id: string
          character_id: string
          copper: number
          created_at: string
          id: string
          item: Json
          kind: string
          quantity: number
          shop_id: string | null
          stock_id: string | null
          undone: boolean
        }
        SetofOptions: {
          from: "*"
          to: "sales"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      server_time: { Args: never; Returns: string }
      set_condition: {
        Args: {
          p_clock: Json
          p_combatant_id: string
          p_condition: string
          p_on: boolean
          p_resist: Json
        }
        Returns: Json
      }
      set_parley: {
        Args: { p_encounter_id: string; p_on: boolean }
        Returns: {
          actor_id: string | null
          campaign_id: string
          created_at: string
          encounter_id: string
          id: string
          kind: string
          roll_id: string | null
          round: number
          seq: number
          shown: Json
          target_id: string | null
          undone: boolean
        }
        SetofOptions: {
          from: "*"
          to: "combat_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_shop_open: {
        Args: { p_open: boolean; p_shop_id: string }
        Returns: {
          buys: boolean
          campaign_id: string
          created_at: string
          id: string
          keeper: string
          kind: string
          markup: number
          name: string
          open: boolean
          stock: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "shops"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_stance: {
        Args: { p_combatant_id: string; p_stance: string }
        Returns: {
          actor_id: string | null
          campaign_id: string
          created_at: string
          encounter_id: string
          id: string
          kind: string
          roll_id: string | null
          round: number
          seq: number
          shown: Json
          target_id: string | null
          undone: boolean
        }
        SetofOptions: {
          from: "*"
          to: "combat_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      split_coins: {
        Args: {
          p_campaign_id: string
          p_character_ids: string[]
          p_copper: number
        }
        Returns: number
      }
      split_stash: { Args: { p_campaign_id: string }; Returns: number }
      stand_up: {
        Args: { p_combatant_id: string }
        Returns: {
          actor_id: string | null
          campaign_id: string
          created_at: string
          encounter_id: string
          id: string
          kind: string
          roll_id: string | null
          round: number
          seq: number
          shown: Json
          target_id: string | null
          undone: boolean
        }
        SetofOptions: {
          from: "*"
          to: "combat_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_fight: {
        Args: {
          p_campaign_id: string
          p_character_ids: string[]
          p_map_id: string
        }
        Returns: {
          campaign_id: string
          current_id: string | null
          ended_at: string | null
          id: string
          parley: boolean
          round: number
          started_at: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "encounters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      stash_coins: {
        Args: { p_campaign_id: string; p_copper: number }
        Returns: {
          campaign_id: string
          items: Json
          updated_at: string
          wallet: Json
        }
        SetofOptions: {
          from: "*"
          to: "party_stash"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      take_coins: {
        Args: { p_character_id: string; p_copper: number }
        Returns: {
          armour_class: number
          attacks: Json
          background: string
          campaign_id: string
          charisma: number
          class: string
          concentration: string | null
          concentration_dc: number | null
          concentration_queue: number[]
          conditions: string[]
          constitution: number
          created_at: string
          current_hp: number
          dead: boolean
          death_save_failures: number
          death_save_successes: number
          dexterity: number
          effects: Json
          exhaustion: number
          features: Json
          hit_dice_used: number
          hit_die: number
          id: string
          immunities: string[]
          inspiration: boolean
          intelligence: number
          inventory: Json
          languages: string
          level: number
          level_up_to: number | null
          max_hp: number
          name: string
          other_proficiencies: string
          owner_id: string
          portrait_path: string | null
          race: string
          resistances: string[]
          save_proficiencies: string[]
          skill_expertise: string[]
          skill_proficiencies: string[]
          speed: number
          spellcasting: Json
          stable: boolean
          story: Json
          strength: number
          subclass: string
          subrace: string
          temp_hp: number
          updated_at: string
          vulnerabilities: string[]
          wallet: Json
          wisdom: number
        }
        SetofOptions: {
          from: "*"
          to: "characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      take_counter: {
        Args: { p_haggle_id: string; p_take: boolean }
        Returns: {
          answered_at: string | null
          asking: number
          bundles: number
          campaign_id: string
          character_id: string
          counter: number | null
          created_at: string
          id: string
          item_name: string
          offer: number
          proficient: boolean | null
          shop_id: string
          status: string
          stock_id: string
        }
        SetofOptions: {
          from: "*"
          to: "haggles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      take_from_stash: {
        Args: {
          p_character_id: string
          p_item_id: string
          p_proficient: boolean
          p_quantity: number
        }
        Returns: {
          armour_class: number
          attacks: Json
          background: string
          campaign_id: string
          charisma: number
          class: string
          concentration: string | null
          concentration_dc: number | null
          concentration_queue: number[]
          conditions: string[]
          constitution: number
          created_at: string
          current_hp: number
          dead: boolean
          death_save_failures: number
          death_save_successes: number
          dexterity: number
          effects: Json
          exhaustion: number
          features: Json
          hit_dice_used: number
          hit_die: number
          id: string
          immunities: string[]
          inspiration: boolean
          intelligence: number
          inventory: Json
          languages: string
          level: number
          level_up_to: number | null
          max_hp: number
          name: string
          other_proficiencies: string
          owner_id: string
          portrait_path: string | null
          race: string
          resistances: string[]
          save_proficiencies: string[]
          skill_expertise: string[]
          skill_proficiencies: string[]
          speed: number
          spellcasting: Json
          stable: boolean
          story: Json
          strength: number
          subclass: string
          subrace: string
          temp_hp: number
          updated_at: string
          vulnerabilities: string[]
          wallet: Json
          wisdom: number
        }
        SetofOptions: {
          from: "*"
          to: "characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      take_items: {
        Args: { p_character_id: string; p_item_id: string; p_quantity: number }
        Returns: {
          armour_class: number
          attacks: Json
          background: string
          campaign_id: string
          charisma: number
          class: string
          concentration: string | null
          concentration_dc: number | null
          concentration_queue: number[]
          conditions: string[]
          constitution: number
          created_at: string
          current_hp: number
          dead: boolean
          death_save_failures: number
          death_save_successes: number
          dexterity: number
          effects: Json
          exhaustion: number
          features: Json
          hit_dice_used: number
          hit_die: number
          id: string
          immunities: string[]
          inspiration: boolean
          intelligence: number
          inventory: Json
          languages: string
          level: number
          level_up_to: number | null
          max_hp: number
          name: string
          other_proficiencies: string
          owner_id: string
          portrait_path: string | null
          race: string
          resistances: string[]
          save_proficiencies: string[]
          skill_expertise: string[]
          skill_proficiencies: string[]
          speed: number
          spellcasting: Json
          stable: boolean
          story: Json
          strength: number
          subclass: string
          subrace: string
          temp_hp: number
          updated_at: string
          vulnerabilities: string[]
          wallet: Json
          wisdom: number
        }
        SetofOptions: {
          from: "*"
          to: "characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      talk: {
        Args: {
          p_combatant_id: string
          p_roll: Json
          p_skill: string
          p_target_ids: string[]
          p_words: string
        }
        Returns: Json
      }
      throw_dice: {
        Args: { p_campaign_id: string; p_roll: Json }
        Returns: {
          campaign_id: string
          character_id: string | null
          created_at: string
          damage: Json | null
          dice: Json
          for_dm: boolean
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
      undo_event: {
        Args: { p_event_id: string }
        Returns: {
          actor_id: string | null
          campaign_id: string
          created_at: string
          encounter_id: string
          id: string
          kind: string
          roll_id: string | null
          round: number
          seq: number
          shown: Json
          target_id: string | null
          undone: boolean
        }
        SetofOptions: {
          from: "*"
          to: "combat_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      undo_sale: {
        Args: { p_sale_id: string }
        Returns: {
          campaign_id: string
          character_id: string
          copper: number
          created_at: string
          id: string
          item: Json
          kind: string
          quantity: number
          shop_id: string | null
          stock_id: string | null
          undone: boolean
        }
        SetofOptions: {
          from: "*"
          to: "sales"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      use_action: {
        Args: { p_combatant_id: string; p_what: string }
        Returns: {
          actor_id: string | null
          campaign_id: string
          created_at: string
          encounter_id: string
          id: string
          kind: string
          roll_id: string | null
          round: number
          seq: number
          shown: Json
          target_id: string | null
          undone: boolean
        }
        SetofOptions: {
          from: "*"
          to: "combat_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      use_feature: {
        Args: { p_combatant_id: string; p_cost: string; p_name: string }
        Returns: {
          actor_id: string | null
          campaign_id: string
          created_at: string
          encounter_id: string
          id: string
          kind: string
          roll_id: string | null
          round: number
          seq: number
          shown: Json
          target_id: string | null
          undone: boolean
        }
        SetofOptions: {
          from: "*"
          to: "combat_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      use_item: {
        Args: {
          p_combatant_id: string
          p_item_id: string
          p_roll: Json
          p_target_id: string
        }
        Returns: Json
      }
      withdraw_offer: { Args: { p_offer_id: string }; Returns: undefined }
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
