-- RPC atomique pour l'acceptation de commande par un livreur.
-- Évite la race condition : si deux livreurs acceptent simultanément,
-- un seul UPDATE réussit (WHERE courier_id IS NULL AND status = 'pending').
CREATE OR REPLACE FUNCTION public.accept_order(p_order_id uuid, p_courier_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count int;
BEGIN
  UPDATE public.orders
  SET courier_id = p_courier_id,
      status     = 'picked_up'
  WHERE id           = p_order_id
    AND courier_id   IS NULL
    AND status       = 'pending';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;

COMMENT ON FUNCTION public.accept_order IS
  'Affecte atomiquement un livreur à une commande. Retourne true si réussi, false si déjà pris.';
