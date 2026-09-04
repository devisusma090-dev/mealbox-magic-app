-- 1. Order status timeline: owner-only reads
DROP POLICY IF EXISTS "order events public read" ON public.order_events;

CREATE POLICY "own order events read"
ON public.order_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_events.order_id
      AND o.user_id = auth.uid()
  )
);

REVOKE SELECT ON public.order_events FROM anon;
GRANT SELECT ON public.order_events TO authenticated;
GRANT ALL ON public.order_events TO service_role;

-- 2. SECURITY DEFINER functions must not be callable from the Data API
REVOKE ALL ON FUNCTION public.purge_old_orders() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.emit_order_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_orders() TO service_role;

-- 3. Explicit access control for the private menu-images bucket
DROP POLICY IF EXISTS "menu images service manage" ON storage.objects;
DROP POLICY IF EXISTS "menu images no public read" ON storage.objects;

CREATE POLICY "menu images service manage"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'menu-images')
WITH CHECK (bucket_id = 'menu-images');
