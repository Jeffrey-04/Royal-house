-- Correction du RPC accept_order : le statut doit être 'ready' (prêt à récupérer)
-- et non 'pending' (nouvelle commande non encore préparée).
-- Flux : pending → accepted → preparing → ready → picked_up → delivering → delivered

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
    AND status       = 'ready';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;
