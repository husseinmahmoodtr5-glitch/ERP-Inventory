import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

export type ItemType = 'raw' | 'semi' | 'finished';
export type MovementType = 'in' | 'out' | 'adjust';
export type OrderStatus = 'pending' | 'in_progress' | 'completed';

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface Item {
  id: string;
  sku: string | null;
  name: string;
  category_id: string | null;
  item_type: ItemType;
  unit: string;
  min_stock: number;
  warehouse_location: string | null;
  bin_rack: string | null;
  baseline_price: number;
  quantity_on_hand: number;
  avg_unit_cost: number;
  created_at: string;
}

export interface Movement {
  id: string;
  item_id: string;
  movement_type: MovementType;
  qty: number;
  unit_cost: number;
  batch_lot: string | null;
  supplier: string | null;
  destination: string | null;
  production_order_id: string | null;
  notes: string | null;
  movement_date: string;
  created_at: string;
}

export interface ProductionOrder {
  id: string;
  order_number: string;
  product_name: string;
  status: OrderStatus;
  planned_qty: number;
  total_cost: number;
  unit_cost: number;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProductionMaterial {
  id: string;
  order_id: string;
  item_id: string;
  qty: number;
  unit_cost: number;
  movement_id: string | null;
  created_at: string;
}

export interface ProductionScrap {
  id: string;
  order_id: string;
  item_id: string;
  qty: number;
  unit_cost: number;
  notes: string | null;
  created_at: string;
}

export interface ProductionOutput {
  id: string;
  order_id: string;
  item_id: string;
  qty: number;
  unit_cost: number;
  movement_id: string | null;
  created_at: string;
}

export interface PriceLog {
  id: string;
  item_id: string;
  old_price: number | null;
  new_price: number | null;
  reason: string | null;
  created_at: string;
}
