-- Make coordinate columns nullable since clients enter text addresses (geocoding done later)
ALTER TABLE public.orders
  ALTER COLUMN dropoff_lat DROP NOT NULL,
  ALTER COLUMN dropoff_lng DROP NOT NULL,
  ALTER COLUMN pickup_lat DROP NOT NULL,
  ALTER COLUMN pickup_lng DROP NOT NULL;
