-- Champ de méthode de paiement et statut de libération des fonds
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'held'
    CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('held', 'released'));

-- Les commandes déjà livrées sont considérées comme libérées
UPDATE public.orders SET payment_status = 'released' WHERE status = 'delivered';

COMMENT ON COLUMN public.orders.payment_method IS
  'Méthode de paiement choisie par le client : orange_money | mtn_money';
COMMENT ON COLUMN public.orders.payment_status IS
  'held = fonds capturés, en attente confirmation client. released = fonds libérés vers restaurant + livreur.';
