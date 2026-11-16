-- Migration: Add DELETE RLS policy for inventory_movements
-- Description: Allows authenticated sellers to delete inventory movement records belonging to their own products during complete product deletion.

DROP POLICY IF EXISTS "Sellers delete own inventory movements" ON public.inventory_movements;

CREATE POLICY "Sellers delete own inventory movements"
  ON public.inventory_movements FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = inventory_movements.product_id
        AND p.seller_id = auth.uid()
    )
  );

