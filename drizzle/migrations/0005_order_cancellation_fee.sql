ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancel_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_by text,
  ADD COLUMN IF NOT EXISTS cancel_reason text;