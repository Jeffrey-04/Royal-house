
CREATE POLICY "Order participants can read related profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE (o.client_id = profiles.id OR o.courier_id = profiles.id)
      AND (
        o.client_id = auth.uid()
        OR o.courier_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = o.restaurant_id AND r.owner_id = auth.uid())
      )
  )
);
