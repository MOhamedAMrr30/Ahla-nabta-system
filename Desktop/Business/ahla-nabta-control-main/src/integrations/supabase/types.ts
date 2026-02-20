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
      client_pricing: {
        Row: {
          client_id: string
          id: string
          last_updated: string
          product_id: string
          selling_price: number
        }
        Insert: {
          client_id: string
          id?: string
          last_updated?: string
          product_id: string
          selling_price: number
        }
        Update: {
          client_id?: string
          id?: string
          last_updated?: string
          product_id?: string
          selling_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_pricing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_pricing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_pricing_history: {
        Row: {
          changed_at: string
          client_id: string
          id: string
          product_id: string
          selling_price: number
        }
        Insert: {
          changed_at?: string
          client_id: string
          id?: string
          product_id: string
          selling_price: number
        }
        Update: {
          changed_at?: string
          client_id?: string
          id?: string
          product_id?: string
          selling_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_pricing_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_pricing_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          credit_days: number | null
          id: string
          name: string
          name_ar: string | null
          phone: string | null
          type: string
        }
        Insert: {
          created_at?: string
          credit_days?: number | null
          id?: string
          name: string
          name_ar?: string | null
          phone?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          credit_days?: number | null
          id?: string
          name?: string
          name_ar?: string | null
          phone?: string | null
          type?: string
        }
        Relationships: []
      }
      inventory_batches: {
        Row: {
          created_at: string
          damaged_qty: number
          expired_qty: number
          harvest_date: string
          harvested_qty: number
          id: string
          product_id: string
          sold_qty: number
          waste_percentage: number
          waste_value: number
        }
        Insert: {
          created_at?: string
          damaged_qty?: number
          expired_qty?: number
          harvest_date?: string
          harvested_qty?: number
          id?: string
          product_id: string
          sold_qty?: number
          waste_percentage?: number
          waste_value?: number
        }
        Update: {
          created_at?: string
          damaged_qty?: number
          expired_qty?: number
          harvest_date?: string
          harvested_qty?: number
          id?: string
          product_id?: string
          sold_qty?: number
          waste_percentage?: number
          waste_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          cost_used: number
          id: string
          order_id: string
          product_id: string
          quantity: number
          selling_price_used: number
          total_cost: number
          total_revenue: number
        }
        Insert: {
          cost_used?: number
          id?: string
          order_id: string
          product_id: string
          quantity?: number
          selling_price_used?: number
          total_cost?: number
          total_revenue?: number
        }
        Update: {
          cost_used?: number
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          selling_price_used?: number
          total_cost?: number
          total_revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_id: string
          created_at: string
          delivery_date: string
          id: string
          margin_percentage: number
          margin_zone: string
          net_profit: number
          order_date: string
          packaging_cost: number
          total_cost: number
          total_revenue: number
          transport_cost: number
        }
        Insert: {
          client_id: string
          created_at?: string
          delivery_date?: string
          id?: string
          margin_percentage?: number
          margin_zone?: string
          net_profit?: number
          order_date?: string
          packaging_cost?: number
          total_cost?: number
          total_revenue?: number
          transport_cost?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          delivery_date?: string
          id?: string
          margin_percentage?: number
          margin_zone?: string
          net_profit?: number
          order_date?: string
          packaging_cost?: number
          total_cost?: number
          total_revenue?: number
          transport_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          invoice_date: string
          order_id: string
          paid_date: string | null
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string
          due_date: string
          id?: string
          invoice_date?: string
          order_id: string
          paid_date?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          invoice_date?: string
          order_id?: string
          paid_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_settings: {
        Row: {
          id: string
          overhead_pct: number
          labor_pct: number
          updated_at: string
        }
        Insert: {
          id?: string
          overhead_pct?: number
          labor_pct?: number
          updated_at?: string
        }
        Update: {
          id?: string
          overhead_pct?: number
          labor_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          cost_per_unit: number
          created_at: string
          id: string
          name: string
          name_ar: string | null
          profit_margin_pct: number
          shelf_life_days: number | null
          unit: string
        }
        Insert: {
          cost_per_unit?: number
          created_at?: string
          id?: string
          name: string
          name_ar?: string | null
          profit_margin_pct?: number
          shelf_life_days?: number | null
          unit?: string
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          id?: string
          name?: string
          name_ar?: string | null
          profit_margin_pct?: number
          shelf_life_days?: number | null
          unit?: string
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
