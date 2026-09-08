-- Staff / admin directory
CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT 'Staff',
  phone text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.staff_members TO service_role;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- Chef directory for WhatsApp routing (Tandoori, Chinese, Main Kitchen, ...)
CREATE TABLE public.chefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.chefs TO service_role;
ALTER TABLE public.chefs ENABLE ROW LEVEL SECURITY;

-- Order acceptance (stops the alarm on every staff device)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS accepted_by text;

CREATE OR REPLACE FUNCTION public.emit_order_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_events (order_id, kind, status, mode)
    VALUES (NEW.id, 'new', NEW.status, NEW.mode);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_events (order_id, kind, status, mode)
    VALUES (NEW.id, 'status', NEW.status, NEW.mode);
  ELSIF NEW.accepted_at IS DISTINCT FROM OLD.accepted_at AND NEW.accepted_at IS NOT NULL THEN
    INSERT INTO public.order_events (order_id, kind, status, mode)
    VALUES (NEW.id, 'accepted', NEW.status, NEW.mode);
  END IF;
  RETURN NEW;
END;
$function$;