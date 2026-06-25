-- Correction RLS restaurant : restreindre la lecture/modification aux commandes du restaurant Royal House.
-- La politique précédente permettait à n'importe quel utilisateur avec le rôle "restaurant"
-- de lire et modifier TOUTES les commandes, sans vérification du restaurant_id.

DROP POLICY IF EXISTS "Restaurant staff read all orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant staff update all orders" ON public.orders;

CREATE POLICY "Restaurant read own orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'restaurant')
    AND restaurant_id = 'a0a0a0a0-0000-0000-0000-000000000001'::uuid
  );

CREATE POLICY "Restaurant update own orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'restaurant')
    AND restaurant_id = 'a0a0a0a0-0000-0000-0000-000000000001'::uuid
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'restaurant')
    AND restaurant_id = 'a0a0a0a0-0000-0000-0000-000000000001'::uuid
  );
