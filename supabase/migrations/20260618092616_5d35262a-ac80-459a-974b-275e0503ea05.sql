
-- Localiser le restaurant à Yaoundé (Bastos)
UPDATE public.restaurants
SET name = 'Royal House',
    address = 'Rue 1.814, Bastos, Yaoundé',
    lat = 3.8917,
    lng = 11.5167
WHERE id = 'a0a0a0a0-0000-0000-0000-000000000001';

-- Remplacer le menu par des plats camerounais (prix en FCFA)
DELETE FROM public.menu_items WHERE restaurant_id = 'a0a0a0a0-0000-0000-0000-000000000001';

INSERT INTO public.menu_items (restaurant_id, name, description, price, category, emoji, available, sort_order) VALUES
 ('a0a0a0a0-0000-0000-0000-000000000001','Ndolé Royal','Feuilles de ndolé, crevettes, viande de bœuf, accompagné de plantains','4500','Plats signatures','🥘',true,1),
 ('a0a0a0a0-0000-0000-0000-000000000001','Poulet DG','Poulet sauté, plantains mûrs, légumes croquants','5000','Plats signatures','🍗',true,2),
 ('a0a0a0a0-0000-0000-0000-000000000001','Poisson Braisé','Bar braisé entier, sauce piment, miondo','6000','Plats signatures','🐟',true,3),
 ('a0a0a0a0-0000-0000-0000-000000000001','Eru & Water Fufu','Feuilles d''eru au crayfish, accompagné de fufu','3500','Plats du terroir','🥬',true,4),
 ('a0a0a0a0-0000-0000-0000-000000000001','Koki & Plantains','Koki de haricots vapeur, plantains mûrs','3000','Plats du terroir','🌽',true,5),
 ('a0a0a0a0-0000-0000-0000-000000000001','Soya de Bœuf','Brochettes de bœuf marinées, oignons grillés','2500','Grillades','🍢',true,6),
 ('a0a0a0a0-0000-0000-0000-000000000001','Salade Avocat-Crevettes','Avocat mûr, crevettes roses, vinaigrette citron vert','3500','Entrées','🥗',true,7),
 ('a0a0a0a0-0000-0000-0000-000000000001','Beignets Haricot','Beignets soufflés servis avec bouillie de maïs','1500','Entrées','🫘',true,8),
 ('a0a0a0a0-0000-0000-0000-000000000001','Jus de Bissap','Infusion d''hibiscus frais, gingembre','1000','Boissons','🌺',true,9),
 ('a0a0a0a0-0000-0000-0000-000000000001','Jus de Gingembre','Frais, légèrement épicé','1000','Boissons','🫚',true,10),
 ('a0a0a0a0-0000-0000-0000-000000000001','Top Pamplemousse 33cl','Boisson gazeuse locale','700','Boissons','🥤',true,11),
 ('a0a0a0a0-0000-0000-0000-000000000001','Beignets-Banane-Choco','Beignets de banane plantain, sauce chocolat','2000','Desserts','🍌',true,12);

-- RLS Orders: le personnel restaurant gère TOUTES les commandes du restaurant (modèle propriétaire)
DROP POLICY IF EXISTS "Restaurants read their orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurants update their orders" ON public.orders;

CREATE POLICY "Restaurant staff read all orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'restaurant'));

CREATE POLICY "Restaurant staff update all orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'restaurant'))
  WITH CHECK (public.has_role(auth.uid(), 'restaurant'));

-- RLS order_events / courier_locations: visibilité aussi pour le personnel restaurant
DROP POLICY IF EXISTS "Events readable with parent order" ON public.order_events;
CREATE POLICY "Events readable with parent order"
  ON public.order_events FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'restaurant')
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_events.order_id
        AND (o.client_id = auth.uid() OR o.courier_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Locations readable with related order" ON public.courier_locations;
CREATE POLICY "Locations readable with related order"
  ON public.courier_locations FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'restaurant')
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = courier_locations.order_id
        AND (o.client_id = auth.uid() OR o.courier_id = auth.uid())
    )
  );
