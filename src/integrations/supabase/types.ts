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
      accounts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          starting_balance: number
          type: Database["public"]["Enums"]["account_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          starting_balance?: number
          type: Database["public"]["Enums"]["account_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          starting_balance?: number
          type?: Database["public"]["Enums"]["account_type"]
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          date: string
          description: string | null
          due_date: string | null
          hours: number | null
          id: string
          notes: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          project_id: string | null
          quantity: number | null
          rate: number | null
          receipt_url: string | null
          unit_price: number | null
          updated_at: string
          vendor: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          date?: string
          description?: string | null
          due_date?: string | null
          hours?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          project_id?: string | null
          quantity?: number | null
          rate?: number | null
          receipt_url?: string | null
          unit_price?: number | null
          updated_at?: string
          vendor: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          date?: string
          description?: string | null
          due_date?: string | null
          hours?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          project_id?: string | null
          quantity?: number | null
          rate?: number | null
          receipt_url?: string | null
          unit_price?: number | null
          updated_at?: string
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      incomes: {
        Row: {
          account_id: string | null
          amount: number
          client_name: string | null
          created_at: string
          date: string
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          project_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          client_name?: string | null
          created_at?: string
          date?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          client_name?: string | null
          created_at?: string
          date?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          budget: number | null
          client_name: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          project_number: string | null
          start_date: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          budget?: number | null
          client_name?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          project_number?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          budget?: number | null
          client_name?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          project_number?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          created_at: string
          default_category:
            | Database["public"]["Enums"]["expense_category"]
            | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          default_category?:
            | Database["public"]["Enums"]["expense_category"]
            | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          default_category?:
            | Database["public"]["Enums"]["expense_category"]
            | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_type: "cash" | "bank" | "credit_card"
      expense_category:
        | "labor"
        | "materials"
        | "equipment"
        | "subcontractor"
        | "cogs"
        | "operating"
        | "other"
      payment_status: "paid" | "unpaid" | "partial"
      project_status: "active" | "completed" | "archived"
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
      account_type: ["cash", "bank", "credit_card"],
      expense_category: [
        "labor",
        "materials",
        "equipment",
        "subcontractor",
        "cogs",
        "operating",
        "other",
      ],
      payment_status: ["paid", "unpaid", "partial"],
      project_status: ["active", "completed", "archived"],
    },
  },
} as const
