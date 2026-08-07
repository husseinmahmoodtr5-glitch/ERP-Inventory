/*
# Inventory, Production, QC & Cost Accounting Schema

Single-tenant application (no auth). All tables use `TO anon, authenticated` policies so the anon-key frontend can read/write its own shared data.

## Tables
1. `categories` — hierarchical tree (self-referencing parent_id) for Raw / Semi-finished / Finished groups.
2. `items` — specific SKUs belonging to a category, with type, unit, min_stock, warehouse location, and live WAC fields (quantity_on_hand, avg_unit_cost).
3. `production_orders` — production batches with status (pending / in_progress / completed) and computed cost.
4. `movements` — stock in / stock out ledger. Each row adjusts an item's quantity and recomputes the moving weighted-average cost.
5. `production_materials` — raw/semi materials requisitioned for a production order (links to movements).
6. `production_scrap` — wastage recorded per production order.
7. `production_outputs` — finished goods produced by an order (pushes into inventory on completion).
8. `price_logs` — audit log of baseline unit price changes per item.

## Integrity
- movements.item_id → items.id ON DELETE RESTRICT
- items.category_id → categories.id ON DELETE RESTRICT
- production_materials link production_orders + items + movements
- production_scrap link production_orders + items
- production_outputs link production_orders + items
- price_logs.item_id → items.id ON DELETE CASCADE

## Security
- RLS enabled on every table.
- 4 CRUD policies per table scoped to `anon, authenticated` (USING (true) / WITH CHECK (true)) because data is intentionally shared single-tenant.
*/

-- 1. categories (hierarchical tree)
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- 2. items (SKUs)
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE,
  name text NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE RESTRICT,
  item_type text NOT NULL CHECK (item_type IN ('raw','semi','finished')),
  unit text NOT NULL DEFAULT 'وحدة',
  min_stock numeric(18,3) NOT NULL DEFAULT 0,
  warehouse_location text,
  bin_rack text,
  baseline_price numeric(18,3) NOT NULL DEFAULT 0,
  quantity_on_hand numeric(18,3) NOT NULL DEFAULT 0,
  avg_unit_cost numeric(18,3) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- 3. production_orders
CREATE TABLE IF NOT EXISTS production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  product_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','in_progress','completed')),
  planned_qty numeric(18,3) NOT NULL DEFAULT 1,
  total_cost numeric(18,3) NOT NULL DEFAULT 0,
  unit_cost numeric(18,3) NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;

-- 4. movements (stock ledger)
CREATE TABLE IF NOT EXISTS movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN ('in','out','adjust')),
  qty numeric(18,3) NOT NULL,
  unit_cost numeric(18,3) NOT NULL DEFAULT 0,
  batch_lot text,
  supplier text,
  destination text,
  production_order_id uuid REFERENCES production_orders(id) ON DELETE SET NULL,
  notes text,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;

-- 5. production_materials (requisitioned materials)
CREATE TABLE IF NOT EXISTS production_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  qty numeric(18,3) NOT NULL,
  unit_cost numeric(18,3) NOT NULL DEFAULT 0,
  movement_id uuid REFERENCES movements(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE production_materials ENABLE ROW LEVEL SECURITY;

-- 6. production_scrap
CREATE TABLE IF NOT EXISTS production_scrap (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  qty numeric(18,3) NOT NULL,
  unit_cost numeric(18,3) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE production_scrap ENABLE ROW LEVEL SECURITY;

-- 7. production_outputs (finished goods produced)
CREATE TABLE IF NOT EXISTS production_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  qty numeric(18,3) NOT NULL,
  unit_cost numeric(18,3) NOT NULL DEFAULT 0,
  movement_id uuid REFERENCES movements(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE production_outputs ENABLE ROW LEVEL SECURITY;

-- 8. price_logs (audit)
CREATE TABLE IF NOT EXISTS price_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  old_price numeric(18,3),
  new_price numeric(18,3),
  reason text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE price_logs ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_movements_item ON movements(item_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_movements_order ON movements(production_order_id);
CREATE INDEX IF NOT EXISTS idx_prod_materials_order ON production_materials(order_id);
CREATE INDEX IF NOT EXISTS idx_prod_scrap_order ON production_scrap(order_id);
CREATE INDEX IF NOT EXISTS idx_prod_outputs_order ON production_outputs(order_id);
CREATE INDEX IF NOT EXISTS idx_price_logs_item ON price_logs(item_id);

-- ============ Policies ============
-- categories
DROP POLICY IF EXISTS "cat_select" ON categories;
CREATE POLICY "cat_select" ON categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "cat_insert" ON categories;
CREATE POLICY "cat_insert" ON categories FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "cat_update" ON categories;
CREATE POLICY "cat_update" ON categories FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "cat_delete" ON categories;
CREATE POLICY "cat_delete" ON categories FOR DELETE TO anon, authenticated USING (true);

-- items
DROP POLICY IF EXISTS "item_select" ON items;
CREATE POLICY "item_select" ON items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "item_insert" ON items;
CREATE POLICY "item_insert" ON items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "item_update" ON items;
CREATE POLICY "item_update" ON items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "item_delete" ON items;
CREATE POLICY "item_delete" ON items FOR DELETE TO anon, authenticated USING (true);

-- movements
DROP POLICY IF EXISTS "mov_select" ON movements;
CREATE POLICY "mov_select" ON movements FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "mov_insert" ON movements;
CREATE POLICY "mov_insert" ON movements FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "mov_update" ON movements;
CREATE POLICY "mov_update" ON movements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "mov_delete" ON movements;
CREATE POLICY "mov_delete" ON movements FOR DELETE TO anon, authenticated USING (true);

-- production_orders
DROP POLICY IF EXISTS "po_select" ON production_orders;
CREATE POLICY "po_select" ON production_orders FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "po_insert" ON production_orders;
CREATE POLICY "po_insert" ON production_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "po_update" ON production_orders;
CREATE POLICY "po_update" ON production_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "po_delete" ON production_orders;
CREATE POLICY "po_delete" ON production_orders FOR DELETE TO anon, authenticated USING (true);

-- production_materials
DROP POLICY IF EXISTS "pm_select" ON production_materials;
CREATE POLICY "pm_select" ON production_materials FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "pm_insert" ON production_materials;
CREATE POLICY "pm_insert" ON production_materials FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pm_update" ON production_materials;
CREATE POLICY "pm_update" ON production_materials FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "pm_delete" ON production_materials;
CREATE POLICY "pm_delete" ON production_materials FOR DELETE TO anon, authenticated USING (true);

-- production_scrap
DROP POLICY IF EXISTS "ps_select" ON production_scrap;
CREATE POLICY "ps_select" ON production_scrap FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ps_insert" ON production_scrap;
CREATE POLICY "ps_insert" ON production_scrap FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ps_update" ON production_scrap;
CREATE POLICY "ps_update" ON production_scrap FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ps_delete" ON production_scrap;
CREATE POLICY "ps_delete" ON production_scrap FOR DELETE TO anon, authenticated USING (true);

-- production_outputs
DROP POLICY IF EXISTS "pout_select" ON production_outputs;
CREATE POLICY "pout_select" ON production_outputs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "pout_insert" ON production_outputs;
CREATE POLICY "pout_insert" ON production_outputs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pout_update" ON production_outputs;
CREATE POLICY "pout_update" ON production_outputs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "pout_delete" ON production_outputs;
CREATE POLICY "pout_delete" ON production_outputs FOR DELETE TO anon, authenticated USING (true);

-- price_logs
DROP POLICY IF EXISTS "pl_select" ON price_logs;
CREATE POLICY "pl_select" ON price_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "pl_insert" ON price_logs;
CREATE POLICY "pl_insert" ON price_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pl_update" ON price_logs;
CREATE POLICY "pl_update" ON price_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "pl_delete" ON price_logs;
CREATE POLICY "pl_delete" ON price_logs FOR DELETE TO anon, authenticated USING (true);

-- ============ WAC + inventory trigger ============
-- On every movement insert, recompute item.quantity_on_hand and avg_unit_cost (moving weighted average for IN; cost unchanged for OUT).
CREATE OR REPLACE FUNCTION recompute_item_stock()
RETURNS TRIGGER AS $$
DECLARE
  new_qty numeric(18,3);
  new_avg numeric(18,3);
BEGIN
  IF NEW.movement_type = 'in' OR NEW.movement_type = 'adjust' THEN
    -- Moving weighted average: (current_value + received_value) / new_qty
    SELECT
      COALESCE(items.quantity_on_hand,0) + NEW.qty,
      CASE
        WHEN COALESCE(items.quantity_on_hand,0) + NEW.qty = 0 THEN 0
        ELSE (COALESCE(items.quantity_on_hand,0)*COALESCE(items.avg_unit_cost,0) + NEW.qty*NEW.unit_cost)
             / (COALESCE(items.quantity_on_hand,0) + NEW.qty)
      END
    INTO new_qty, new_avg
    FROM items WHERE id = NEW.item_id;

    UPDATE items SET quantity_on_hand = new_qty, avg_unit_cost = new_avg WHERE id = NEW.item_id;
  ELSIF NEW.movement_type = 'out' THEN
    UPDATE items
      SET quantity_on_hand = quantity_on_hand - NEW.qty
      WHERE id = NEW.item_id;
    -- record cost at issue time
    NEW.unit_cost := (SELECT avg_unit_cost FROM items WHERE id = NEW.item_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recompute_stock ON movements;
CREATE TRIGGER trg_recompute_stock
BEFORE INSERT ON movements
FOR EACH ROW EXECUTE FUNCTION recompute_item_stock();
