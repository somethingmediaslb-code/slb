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
      challan_items: {
        Row: {
          challan_id: string
          direct_labour_cost: number
          dispatched_qty: number
          id: string
          order_item_id: string
        }
        Insert: {
          challan_id: string
          direct_labour_cost?: number
          dispatched_qty: number
          id?: string
          order_item_id: string
        }
        Update: {
          challan_id?: string
          direct_labour_cost?: number
          dispatched_qty?: number
          id?: string
          order_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challan_items_challan_id_fkey"
            columns: ["challan_id"]
            isOneToOne: false
            referencedRelation: "delivery_challans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challan_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_challans: {
        Row: {
          challan_number: string
          created_at: string | null
          delivery_status: string | null
          dispatch_date: string
          freight_charges: number
          id: string
          lr_number: string | null
          order_id: string
          status: string
          transport_carrier: string | null
          vehicle_number: string | null
        }
        Insert: {
          challan_number?: string
          created_at?: string | null
          delivery_status?: string | null
          dispatch_date?: string
          freight_charges?: number
          id?: string
          lr_number?: string | null
          order_id: string
          status?: string
          transport_carrier?: string | null
          vehicle_number?: string | null
        }
        Update: {
          challan_number?: string
          created_at?: string | null
          delivery_status?: string | null
          dispatch_date?: string
          freight_charges?: number
          id?: string
          lr_number?: string | null
          order_id?: string
          status?: string
          transport_carrier?: string | null
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_challans_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          expense_date: string
          id: string
          notes: string | null
          payment_method: string | null
          reference_dc_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          reference_dc_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          reference_dc_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_reference_dc_id_fkey"
            columns: ["reference_dc_id"]
            isOneToOne: false
            referencedRelation: "delivery_challans"
            referencedColumns: ["id"]
          },
        ]
      }
      factory_notifications: {
        Row: {
          body: string
          created_at: string | null
          id: string
          path: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          path?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          path?: string
          title?: string
        }
        Relationships: []
      }
      item_master: {
        Row: {
          box_type: string
          created_at: string | null
          id: string
          size_dimensions: string
          specification: string | null
          unit_rate: number
        }
        Insert: {
          box_type: string
          created_at?: string | null
          id?: string
          size_dimensions: string
          specification?: string | null
          unit_rate?: number
        }
        Update: {
          box_type?: string
          created_at?: string | null
          id?: string
          size_dimensions?: string
          specification?: string | null
          unit_rate?: number
        }
        Relationships: []
      }
      labour_borrowings: {
        Row: {
          amount: number
          borrow_date: string
          created_at: string | null
          deducted_amount: number
          id: string
          labour_id: string
          remarks: string | null
        }
        Insert: {
          amount: number
          borrow_date?: string
          created_at?: string | null
          deducted_amount?: number
          id?: string
          labour_id: string
          remarks?: string | null
        }
        Update: {
          amount?: number
          borrow_date?: string
          created_at?: string | null
          deducted_amount?: number
          id?: string
          labour_id?: string
          remarks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "labour_borrowings_labour_id_fkey"
            columns: ["labour_id"]
            isOneToOne: false
            referencedRelation: "labour_master"
            referencedColumns: ["id"]
          },
        ]
      }
      labour_master: {
        Row: {
          created_at: string | null
          daily_rate: number
          id: string
          labour_name: string
          phone: string | null
          unit_assignment: string | null
        }
        Insert: {
          created_at?: string | null
          daily_rate?: number
          id?: string
          labour_name: string
          phone?: string | null
          unit_assignment?: string | null
        }
        Update: {
          created_at?: string | null
          daily_rate?: number
          id?: string
          labour_name?: string
          phone?: string | null
          unit_assignment?: string | null
        }
        Relationships: []
      }
      labour_payroll: {
        Row: {
          amount_paid: number
          created_at: string | null
          deductions: number
          gross: number
          id: string
          labour_id: string
          net_paid: number
          payout_date: string | null
          status: string | null
        }
        Insert: {
          amount_paid?: number
          created_at?: string | null
          deductions: number
          gross: number
          id?: string
          labour_id: string
          net_paid: number
          payout_date?: string | null
          status?: string | null
        }
        Update: {
          amount_paid?: number
          created_at?: string | null
          deductions?: number
          gross?: number
          id?: string
          labour_id?: string
          net_paid?: number
          payout_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "labour_payroll_labour_id_fkey"
            columns: ["labour_id"]
            isOneToOne: false
            referencedRelation: "labour_master"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          allocated_qty: number
          box_type: string
          code_remarks: string | null
          completed_qty: number
          created_at: string | null
          dispatched_qty: number
          id: string
          order_id: string
          ordered_qty: number
          priority_signal: string
          reserved_qty: number
          size_dimensions: string
          specification: string | null
          sr_no: number
          total_price: number | null
          unit_rate: number
        }
        Insert: {
          allocated_qty?: number
          box_type: string
          code_remarks?: string | null
          completed_qty?: number
          created_at?: string | null
          dispatched_qty?: number
          id?: string
          order_id: string
          ordered_qty: number
          priority_signal?: string
          reserved_qty?: number
          size_dimensions: string
          specification?: string | null
          sr_no: number
          total_price?: number | null
          unit_rate?: number
        }
        Update: {
          allocated_qty?: number
          box_type?: string
          code_remarks?: string | null
          completed_qty?: number
          created_at?: string | null
          dispatched_qty?: number
          id?: string
          order_id?: string
          ordered_qty?: number
          priority_signal?: string
          reserved_qty?: number
          size_dimensions?: string
          specification?: string | null
          sr_no?: number
          total_price?: number | null
          unit_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          expected_date: string
          id: string
          is_self_stock: boolean
          medium: string | null
          order_date: string
          order_no: string
          party_id: string | null
          remarks: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          expected_date?: string
          id?: string
          is_self_stock?: boolean
          medium?: string | null
          order_date?: string
          order_no?: string
          party_id?: string | null
          remarks?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          expected_date?: string
          id?: string
          is_self_stock?: boolean
          medium?: string | null
          order_date?: string
          order_no?: string
          party_id?: string | null
          remarks?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "party_master"
            referencedColumns: ["id"]
          },
        ]
      }
      party_master: {
        Row: {
          address: string | null
          company_name: string
          created_at: string
          email: string | null
          gstin: string | null
          id: string
          phone_number: string | null
        }
        Insert: {
          address?: string | null
          company_name: string
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          phone_number?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          phone_number?: string | null
        }
        Relationships: []
      }
      production_allocations: {
        Row: {
          allocated_qty: number
          completed_qty: number
          created_at: string | null
          duration_hours: number
          id: string
          labour_id: string
          labour_rate: number
          order_item_id: string
          paid_earnings: number
          start_time: string
          status: string
          tentative_completion: string
        }
        Insert: {
          allocated_qty: number
          completed_qty?: number
          created_at?: string | null
          duration_hours: number
          id?: string
          labour_id: string
          labour_rate: number
          order_item_id: string
          paid_earnings?: number
          start_time?: string
          status?: string
          tentative_completion: string
        }
        Update: {
          allocated_qty?: number
          completed_qty?: number
          created_at?: string | null
          duration_hours?: number
          id?: string
          labour_id?: string
          labour_rate?: number
          order_item_id?: string
          paid_earnings?: number
          start_time?: string
          status?: string
          tentative_completion?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_allocations_labour_id_fkey"
            columns: ["labour_id"]
            isOneToOne: false
            referencedRelation: "labour_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_allocations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      push_configuration: {
        Row: {
          id: number
          private_key: string
          public_key: string
        }
        Insert: {
          id?: number
          private_key: string
          public_key: string
        }
        Update: {
          id?: number
          private_key?: string
          public_key?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          display_name: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changed_fields: Json | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      factory_data_pings: {
        Row: {
          change_source: string | null
          created_at: string
          id: string
        }
        Insert: {
          change_source?: string | null
          created_at?: string
          id?: string
        }
        Update: {
          change_source?: string | null
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: string
          user_id: string
          allowed_pages?: string[] | null
        }
        Insert: {
          id?: string
          role: string
          user_id: string
          allowed_pages?: string[] | null
        }
        Update: {
          id?: string
          role?: string
          user_id?: string
          allowed_pages?: string[] | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      factory_action: { Args: { action: string; payload: Json }; Returns: Json }
      admin_set_user_role: { Args: { new_role: string; target_user_id: string }; Returns: Json }
      admin_set_user_page_access: { Args: { p_allowed_pages: string[]; p_target_user_id: string }; Returns: Json }
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
