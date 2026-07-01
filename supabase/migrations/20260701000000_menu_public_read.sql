-- Allow unauthenticated visitors to browse menu items on the public showcase page
GRANT SELECT ON public.menu_items TO anon;

CREATE POLICY "Menu publicly readable by anon"
  ON public.menu_items FOR SELECT TO anon
  USING (true);
