-- Fonction de nettoyage des positions coursier expirées (> 24h).
-- À appeler manuellement ou via pg_cron si disponible.

CREATE OR REPLACE FUNCTION public.cleanup_old_courier_locations()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.courier_locations
  WHERE updated_at < now() - interval '24 hours';
$$;

COMMENT ON FUNCTION public.cleanup_old_courier_locations IS
  'Supprime les entrées courier_locations non mises à jour depuis plus de 24 heures.';
