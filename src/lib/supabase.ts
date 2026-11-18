import { createClient } from "@supabase/supabase-js";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED" | "REFUNDED";
export type OrderStatus =
  "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
export type ProductCategory = "Kopi" | "Dessert" | "Bundling";

export type ProductRow = {
  id: string;
  product_name: string;
  description: string | null;
  category: ProductCategory;
  price: number;
  image_url: string | null;
  stock: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_whatsapp: string;
  total_amount: number;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_category: ProductCategory | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
};

export type PaymentRow = {
  id: string;
  order_id: string;
  payment_reference: string | null;
  payment_method: string;
  amount: number;
  payment_status: PaymentStatus;
  transaction_date: string;
  verified: boolean;
  created_at: string;
};

type TableDefinition<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type ProductInsert = Omit<ProductRow, "id" | "created_at" | "updated_at"> &
  Partial<Pick<ProductRow, "id" | "created_at" | "updated_at">>;
type OrderInsert = Omit<OrderRow, "id" | "created_at" | "updated_at" | "paid_at"> &
  Partial<Pick<OrderRow, "id" | "created_at" | "updated_at" | "paid_at">>;
type OrderItemInsert = Omit<OrderItemRow, "id" | "created_at"> &
  Partial<Pick<OrderItemRow, "id" | "created_at">>;
type PaymentInsert = Omit<PaymentRow, "id" | "created_at"> &
  Partial<Pick<PaymentRow, "id" | "created_at">>;

export type Database = {
  public: {
    Tables: {
      products: TableDefinition<ProductRow, ProductInsert, Partial<ProductInsert>>;
      admin_users: TableDefinition<
        { user_id: string; role: "admin"; created_at: string },
        { user_id: string; role?: "admin"; created_at?: string },
        { user_id?: string; role?: "admin"; created_at?: string }
      >;
      orders: TableDefinition<OrderRow, OrderInsert, Partial<OrderInsert>>;
      order_items: TableDefinition<OrderItemRow, OrderItemInsert, Partial<OrderItemInsert>>;
      payments: TableDefinition<PaymentRow, PaymentInsert, Partial<PaymentInsert>>;
    };
    Views: Record<string, never>;
    Functions: {
      create_order: {
        Args: {
          p_customer_name: string;
          p_customer_whatsapp: string;
          p_items: Json;
          p_payment_method: string;
          p_notes?: string | null;
        };
        Returns: { order_id: string; order_number: string }[];
      };
    };
    Enums: {
      order_status: OrderStatus;
      payment_status: PaymentStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
const supabaseKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

if (!supabaseUrl || !supabaseKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be configured.");
}

if (supabaseKey.startsWith("sb_secret_")) {
  throw new Error(
    "A Supabase secret key cannot be used in the browser. Use a publishable or anon key.",
  );
}

const parsedSupabaseUrl = new URL(supabaseUrl);
if (parsedSupabaseUrl.pathname !== "/" || parsedSupabaseUrl.search || parsedSupabaseUrl.hash) {
  throw new Error(
    "VITE_SUPABASE_URL must be the project URL without a REST path, query, or fragment.",
  );
}

export const supabaseClient = createClient<Database>(parsedSupabaseUrl.origin, supabaseKey);
export const supabase = supabaseClient;
