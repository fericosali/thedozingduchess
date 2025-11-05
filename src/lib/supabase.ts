import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Database types will be generated here later
export type Database = {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          product_url: string
          name: string
          description: string | null
          brand: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_url: string
          name: string
          description?: string | null
          brand?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_url?: string
          name?: string
          description?: string | null
          brand?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      product_variants: {
        Row: {
          id: string
          product_id: string
          variant: string
          size: string
          sku: string
          color: string | null
          weight: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          variant: string
          size: string
          color?: string | null
          weight?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          variant?: string
          size?: string
          color?: string | null
          weight?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      purchase_orders: {
        Row: {
          id: string
          order_number: string
          supplier: string
          total_logistics_fee: number
          exchange_rate: number
          total_quantity: number
          logistics_fee_per_unit: number
          order_status: string
          order_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_number: string
          supplier: string
          total_logistics_fee?: number
          exchange_rate: number
          total_quantity?: number
          order_status?: string
          order_date?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_number?: string
          supplier?: string
          total_logistics_fee?: number
          exchange_rate?: number
          total_quantity?: number
          order_status?: string
          order_date?: string
          created_at?: string
          updated_at?: string
        }
      }
      purchase_batches: {
        Row: {
          id: string
          purchase_order_id: string
          variant_id: string
          cny_price: number
          logistics_fee_per_unit: number
          quantity: number
          unit_cogs: number
          remaining_quantity: number
          created_at: string
        }
        Insert: {
          id?: string
          purchase_order_id: string
          variant_id: string
          cny_price: number
          logistics_fee_per_unit: number
          quantity: number
          unit_cogs: number
          remaining_quantity?: number
          created_at?: string
        }
        Update: {
          id?: string
          purchase_order_id?: string
          variant_id?: string
          cny_price?: number
          logistics_fee_per_unit?: number
          quantity?: number
          unit_cogs?: number
          remaining_quantity?: number
          created_at?: string
        }
      }
      inventory: {
        Row: {
          id: string
          variant_id: string
          total_quantity: number
          average_cogs: number
          total_value: number
          low_stock_threshold: number
          last_updated: string
        }
        Insert: {
          id?: string
          variant_id: string
          total_quantity?: number
          average_cogs?: number
          low_stock_threshold?: number
          last_updated?: string
        }
        Update: {
          id?: string
          variant_id?: string
          total_quantity?: number
          average_cogs?: number
          low_stock_threshold?: number
          last_updated?: string
        }
      }
      stock_movements: {
        Row: {
          id: string
          variant_id: string
          batch_id: string | null
          sale_id: string | null
          movement_type: string
          quantity: number
          unit_price: number
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          variant_id: string
          batch_id?: string | null
          sale_id?: string | null
          movement_type: string
          quantity: number
          unit_price: number
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          variant_id?: string
          batch_id?: string | null
          sale_id?: string | null
          movement_type?: string
          quantity?: number
          unit_price?: number
          reason?: string | null
          created_at?: string
        }
      }
      sales: {
        Row: {
          id: string
          variant_id: string
          marketplace: string
          invoice_number: string
          quantity: number
          selling_price: number
          total_revenue: number
          cogs_used: number
          profit: number
          sale_date: string
          created_at: string
        }
        Insert: {
          id?: string
          variant_id: string
          marketplace: string
          invoice_number: string
          quantity: number
          selling_price: number
          cogs_used: number
          sale_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          variant_id?: string
          marketplace?: string
          invoice_number?: string
          quantity?: number
          selling_price?: number
          cogs_used?: number
          sale_date?: string
          created_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          category_id: string
          amount: number
          description: string
          expense_date: string
          created_at: string
        }
        Insert: {
          id?: string
          category_id: string
          amount: number
          description: string
          expense_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          amount?: number
          description?: string
          expense_date?: string
          created_at?: string
        }
      }
      expense_categories: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_active?: boolean
        }
      }
      balance_adjustments: {
        Row: {
          id: string
          amount: number
          adjustment_type: string
          reason: string
          description: string | null
          adjustment_date: string
          created_at: string
        }
        Insert: {
          id?: string
          amount: number
          adjustment_type: string
          reason: string
          description?: string | null
          adjustment_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          amount?: number
          adjustment_type?: string
          reason?: string
          description?: string | null
          adjustment_date?: string
          created_at?: string
        }
      }
      settings: {
        Row: {
          id: string
          key: string
          value: string
          description: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: string
          description?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: string
          description?: string | null
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      deduct_stock_fifo: {
        Args: {
          p_variant_id: string
          p_quantity: number
          p_sale_id?: string
          p_reason?: string
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}