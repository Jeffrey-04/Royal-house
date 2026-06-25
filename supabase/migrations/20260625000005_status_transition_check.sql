-- Trigger pour empêcher la modification de statut d'une commande finalisée (delivered ou cancelled).
-- Protège contre les manipulations client-side qui sauteraient des étapes ou rouvriraient une commande.

CREATE OR REPLACE FUNCTION public.validate_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot change status of a finalized order (current: %)', OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_status_transition ON public.orders;

CREATE TRIGGER check_status_transition
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_status_transition();

COMMENT ON FUNCTION public.validate_status_transition IS
  'Bloque toute transition de statut depuis delivered ou cancelled.';
