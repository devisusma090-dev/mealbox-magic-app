ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS staff_contact_phones text NOT NULL DEFAULT '';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS onesignal_app_id text NOT NULL DEFAULT '';

ALTER TABLE public.menu_items REPLICA IDENTITY FULL;
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.addons REPLICA IDENTITY FULL;
ALTER TABLE public.settings REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.categories; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.addons; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.settings; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;