export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          role: string
          first_name: string | null
          last_name: string | null
          phone: string | null
          preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
      }
      brands: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: any[]
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: any[]
      }
      products: {
        Row: {
          id: string
          name: string
          slug: string
          brand_id: string
          category_id: string
          gender: string
          sku: string
          colorway: string
          price: number
          original_price: number | null
          description: string
          details: string[]
          tags: string[]
          rating: number
          reviews_count: number
          sales_count: number
          model_url: string | null
          is_new_release: boolean
          is_featured: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          brand_id: string
          category_id: string
          gender: string
          sku: string
          colorway: string
          price: number
          original_price?: number | null
          description: string
          details?: string[]
          tags?: string[]
          rating?: number
          reviews_count?: number
          sales_count?: number
          model_url?: string | null
          is_new_release?: boolean
          is_featured?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          brand_id?: string
          category_id?: string
          gender?: string
          sku?: string
          colorway?: string
          price?: number
          original_price?: number | null
          description?: string
          details?: string[]
          tags?: string[]
          rating?: number
          reviews_count?: number
          sales_count?: number
          model_url?: string | null
          is_new_release?: boolean
          is_featured?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
      }
      product_images: {
        Row: {
          id: string
          product_id: string
          image_url: string
          angle_label: string
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          image_url: string
          angle_label: string
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          image_url?: string
          angle_label?: string
          display_order?: number
          created_at?: string
        }
        Relationships: any[]
      }
      product_sizes: {
        Row: {
          id: string
          product_id: string
          size_us: number
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          size_us: number
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          size_us?: number
          created_at?: string
        }
        Relationships: any[]
      }
      inventory: {
        Row: {
          id: string
          product_size_id: string
          stock: number
          reserved_stock: number
          updated_at: string
        }
        Insert: {
          id?: string
          product_size_id: string
          stock?: number
          reserved_stock?: number
          updated_at?: string
        }
        Update: {
          id?: string
          product_size_id?: string
          stock?: number
          reserved_stock?: number
          updated_at?: string
        }
        Relationships: any[]
      }
      inventory_reservations: {
        Row: {
          id: string
          product_size_id: string
          order_id: string
          quantity: number
          status: string
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_size_id: string
          order_id: string
          quantity: number
          status?: string
          expires_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_size_id?: string
          order_id?: string
          quantity?: number
          status?: string
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
      }
      wishlists: {
        Row: {
          id: string
          user_id: string
          product_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          created_at?: string
        }
        Relationships: any[]
      }
      bespoke_designs: {
        Row: {
          id: string
          user_id: string
          base_product_id: string
          design_name: string
          design_snapshot: Json
          preview_image_url: string | null
          price_premium: number
          is_ordered: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          base_product_id: string
          design_name: string
          design_snapshot: Json
          preview_image_url?: string | null
          price_premium?: number
          is_ordered?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          base_product_id?: string
          design_name?: string
          design_snapshot?: Json
          preview_image_url?: string | null
          price_premium?: number
          is_ordered?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
      }
      carts: {
        Row: {
          id: string
          user_id: string | null
          guest_session_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          guest_session_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          guest_session_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
      }
      cart_items: {
        Row: {
          id: string
          cart_id: string
          product_id: string
          product_size_id: string
          quantity: number
          bespoke_design_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cart_id: string
          product_id: string
          product_size_id: string
          quantity?: number
          bespoke_design_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cart_id?: string
          product_id?: string
          product_size_id?: string
          quantity?: number
          bespoke_design_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
      }
      promo_codes: {
        Row: {
          id: string
          code: string
          discount_percent: number
          min_spend: number
          max_uses: number | null
          current_uses: number
          is_active: boolean
          starts_at: string
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          discount_percent: number
          min_spend?: number
          max_uses?: number | null
          current_uses?: number
          is_active?: boolean
          starts_at?: string
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          discount_percent?: number
          min_spend?: number
          max_uses?: number | null
          current_uses?: number
          is_active?: boolean
          starts_at?: string
          expires_at?: string | null
          created_at?: string
        }
        Relationships: any[]
      }
      orders: {
        Row: {
          id: string
          order_code: string
          guest_access_token: string
          user_id: string | null
          customer_snapshot: Json
          subtotal: number
          discount: number
          shipping_fee: number
          tax: number
          total: number
          payment_method: string
          shipping_method: string
          payment_status: string
          payment_reference: string | null
          payment_provider: string | null
          payment_metadata: Json
          currency: string
          current_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_code: string
          guest_access_token: string
          user_id?: string | null
          customer_snapshot: Json
          subtotal: number
          discount?: number
          shipping_fee?: number
          tax?: number
          total: number
          payment_method: string
          shipping_method: string
          payment_status?: string
          payment_reference?: string | null
          payment_provider?: string | null
          payment_metadata?: Json
          currency?: string
          current_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_code?: string
          guest_access_token?: string
          user_id?: string | null
          customer_snapshot?: Json
          subtotal?: number
          discount?: number
          shipping_fee?: number
          tax?: number
          total?: number
          payment_method?: string
          shipping_method?: string
          payment_status?: string
          payment_reference?: string | null
          payment_provider?: string | null
          payment_metadata?: Json
          currency?: string
          current_status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          product_name: string
          product_sku: string
          size_us: number
          unit_price: number
          quantity: number
          bespoke_snapshot: Json | null
          image_url: string
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          product_name: string
          product_sku: string
          size_us: number
          unit_price: number
          quantity: number
          bespoke_snapshot?: Json | null
          image_url: string
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          product_sku?: string
          size_us?: number
          unit_price?: number
          quantity?: number
          bespoke_snapshot?: Json | null
          image_url?: string
          created_at?: string
        }
        Relationships: any[]
      }
      order_status_history: {
        Row: {
          id: string
          order_id: string
          status: string
          title: string
          description: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          status: string
          title: string
          description: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          status?: string
          title?: string
          description?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: any[]
      }
      shipments: {
        Row: {
          id: string
          order_id: string
          tracking_number: string
          carrier: string
          nfc_security_tag_id: string | null
          dispatched_at: string | null
          estimated_delivery: string | null
          delivered_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          tracking_number: string
          carrier?: string
          nfc_security_tag_id?: string | null
          dispatched_at?: string | null
          estimated_delivery?: string | null
          delivered_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          tracking_number?: string
          carrier?: string
          nfc_security_tag_id?: string | null
          dispatched_at?: string | null
          estimated_delivery?: string | null
          delivered_at?: string | null
          created_at?: string
        }
        Relationships: any[]
      }
      promo_redemptions: {
        Row: {
          id: string
          promo_id: string
          order_id: string
          user_id: string | null
          discount_amount: number
          redeemed_at: string
        }
        Insert: {
          id?: string
          promo_id: string
          order_id: string
          user_id?: string | null
          discount_amount: number
          redeemed_at?: string
        }
        Update: {
          id?: string
          promo_id?: string
          order_id?: string
          user_id?: string | null
          discount_amount?: number
          redeemed_at?: string
        }
        Relationships: any[]
      }
      drops: {
        Row: {
          id: string
          sneaker_name: string
          brand_id: string
          price: number
          release_time: string
          image_url: string
          hype_level: string
          drop_type: string
          description: string
          subscribers_count: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          sneaker_name: string
          brand_id: string
          price: number
          release_time: string
          image_url: string
          hype_level: string
          drop_type: string
          description: string
          subscribers_count?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          sneaker_name?: string
          brand_id?: string
          price?: number
          release_time?: string
          image_url?: string
          hype_level?: string
          drop_type?: string
          description?: string
          subscribers_count?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: any[]
      }
      raffle_entries: {
        Row: {
          id: string
          drop_id: string
          user_id: string
          preferred_size: number | null
          is_winner: boolean
          created_at: string
        }
        Insert: {
          id?: string
          drop_id: string
          user_id: string
          preferred_size?: number | null
          is_winner?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          drop_id?: string
          user_id?: string
          preferred_size?: number | null
          is_winner?: boolean
          created_at?: string
        }
        Relationships: any[]
      }
      admin_audit_logs: {
        Row: {
          id: string
          admin_id: string
          action_type: string
          entity_type: string
          entity_id: string
          changes: Json
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          admin_id: string
          action_type: string
          entity_type: string
          entity_id: string
          changes?: Json
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          admin_id?: string
          action_type?: string
          entity_type?: string
          entity_id?: string
          changes?: Json
          ip_address?: string | null
          created_at?: string
        }
        Relationships: any[]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_inventory: {
        Args: {
          p_product_size_id: string
          p_quantity: number
          p_reason: string
        }
        Returns: undefined
      }
      admin_transition_order_status: {
        Args: {
          p_order_id: string
          p_new_status: string
          p_title: string
          p_description: string
        }
        Returns: undefined
      }
      admin_audit_logs_for_admin: {
        Args: {
          p_entity_type?: string | null
          p_action_type?: string | null
          p_admin_id?: string | null
          p_limit?: number | null
          p_offset?: number
        }
        Returns: {
          id: string
          admin_id: string
          action_type: string
          entity_type: string
          entity_id: string
          changes: Json
          ip_address: string | null
          created_at: string
        }[]
      }
      create_pending_order_atomic: {
        Args: {
          p_cart_id: string
          p_guest_token: string | null
          p_promo_code: string | null
          p_customer_snapshot: any
          p_payment_method: string
          p_shipping_method: string
        }
        Returns: any
      }
      validate_promo_code: {
        Args: {
          p_code: string
          p_subtotal: number
        }
        Returns: any
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
