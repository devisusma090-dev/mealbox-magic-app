-- 1. GPS coordinates on orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS lng double precision;

-- 2. Public, PII-free live event feed used for realtime fan-out to staff screens
CREATE TABLE IF NOT EXISTS public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  kind text NOT NULL,
  status text NOT NULL,
  mode text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.order_events TO anon;
GRANT SELECT ON public.order_events TO authenticated;
GRANT ALL ON public.order_events TO service_role;

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order events public read"
  ON public.order_events FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS order_events_created_idx ON public.order_events (created_at DESC);

CREATE OR REPLACE FUNCTION public.emit_order_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_events (order_id, kind, status, mode)
    VALUES (NEW.id, 'new', NEW.status, NEW.mode);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_events (order_id, kind, status, mode)
    VALUES (NEW.id, 'status', NEW.status, NEW.mode);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_emit_event ON public.orders;
CREATE TRIGGER orders_emit_event
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.emit_order_event();

-- 3. Broadcast the event feed over realtime
ALTER TABLE public.order_events REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_events;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 4. Keep the event feed inside the 48h retention window
CREATE OR REPLACE FUNCTION public.purge_old_orders()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH d AS (DELETE FROM public.orders WHERE created_at < now() - interval '48 hours')
  DELETE FROM public.order_events WHERE created_at < now() - interval '48 hours';
$$;