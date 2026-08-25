ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS chef_phone text;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS direct_delivery_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS direct_offline_reason text NOT NULL DEFAULT 'Direct delivery is paused right now.',
  ADD COLUMN IF NOT EXISTS eden_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS eden_offline_reason text NOT NULL DEFAULT 'Eden Court doorstep delivery is paused right now.',
  ADD COLUMN IF NOT EXISTS delivery_staff_phones text NOT NULL DEFAULT '';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_phone text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_status_created_idx ON public.orders (status, created_at DESC);