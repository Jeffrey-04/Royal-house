-- Indexes sur les colonnes les plus filtrées pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_orders_client_id         ON public.orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status ON public.orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_courier_status    ON public.orders(courier_id, status);
CREATE INDEX IF NOT EXISTS idx_courier_locations_courier ON public.courier_locations(courier_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id  ON public.menu_items(restaurant_id);
