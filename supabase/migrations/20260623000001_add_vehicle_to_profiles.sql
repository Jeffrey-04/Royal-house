-- Moyen de déplacement du livreur
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vehicle text NOT NULL DEFAULT 'moto'
  CONSTRAINT profiles_vehicle_check CHECK (vehicle IN ('bike', 'moto', 'car'));
