-- Add delivery_fee column to orders table
-- Stores the fixed courier fee calculated from road distance (Mapbox Directions)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee numeric(10, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.delivery_fee IS
  'Frais de livraison fixes calculés selon la distance routière restaurant→client (Mapbox Directions). Rémunération directe du livreur.';
