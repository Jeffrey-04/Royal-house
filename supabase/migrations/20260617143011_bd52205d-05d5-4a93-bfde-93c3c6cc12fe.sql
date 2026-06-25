
ALTER TABLE public.restaurants ALTER COLUMN owner_id DROP NOT NULL;

DROP POLICY IF EXISTS "Owner manages restaurants" ON public.restaurants;
CREATE POLICY "Restaurant role manages restaurants" ON public.restaurants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'restaurant'))
  WITH CHECK (public.has_role(auth.uid(), 'restaurant'));

CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  category text,
  emoji text,
  image_url text,
  available boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Menu readable by authenticated" ON public.menu_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Restaurant role manages menu" ON public.menu_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'restaurant'))
  WITH CHECK (public.has_role(auth.uid(), 'restaurant'));
CREATE TRIGGER trg_menu_items_updated BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.menu_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;

CREATE POLICY "Client confirms delivery" ON public.orders FOR UPDATE TO authenticated
  USING (auth.uid() = client_id AND status = 'delivering')
  WITH CHECK (auth.uid() = client_id AND status IN ('delivering','delivered'));

INSERT INTO public.restaurants (id, owner_id, name, address, lat, lng, cuisine)
VALUES ('a0a0a0a0-0000-0000-0000-000000000001'::uuid, NULL,
        'Royal House', '12 Rue de Rivoli, 75001 Paris', 48.8566, 2.3522, 'Cuisine royale')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address, lat = EXCLUDED.lat, lng = EXCLUDED.lng;

INSERT INTO public.menu_items (restaurant_id, name, description, price, category, emoji, sort_order) VALUES
  ('a0a0a0a0-0000-0000-0000-000000000001','Royal Burger','Bœuf Angus, cheddar affiné, sauce maison', 14.50, 'Plats', '🍔', 1),
  ('a0a0a0a0-0000-0000-0000-000000000001','Pizza Reine','Tomate, mozzarella, jambon, champignons', 13.00, 'Plats', '🍕', 2),
  ('a0a0a0a0-0000-0000-0000-000000000001','Plateau Royal Sushi','16 pièces variées du chef', 22.90, 'Plats', '🍣', 3),
  ('a0a0a0a0-0000-0000-0000-000000000001','Salade César Royale','Poulet grillé, parmesan, croûtons', 11.50, 'Entrées', '🥗', 4),
  ('a0a0a0a0-0000-0000-0000-000000000001','Nouilles Wok du Roi','Légumes croquants, sauce soja', 12.50, 'Plats', '🍜', 5),
  ('a0a0a0a0-0000-0000-0000-000000000001','Tiramisu Maison','Mascarpone, café, cacao', 6.50, 'Desserts', '🍰', 6),
  ('a0a0a0a0-0000-0000-0000-000000000001','Coca-Cola 33cl','Boisson fraîche', 3.00, 'Boissons', '🥤', 7);
