
-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  avatar_url text,
  phone text,
  referral_code text UNIQUE NOT NULL,
  referred_by uuid,
  referral_rewarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CATEGORIES
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT TO anon, authenticated USING (true);

-- MENU ITEMS
CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  is_veg boolean NOT NULL DEFAULT true,
  available boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu public read" ON public.menu_items FOR SELECT TO anon, authenticated USING (true);

-- ADDONS (cold drinks)
CREATE TABLE public.addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  available boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.addons TO anon, authenticated;
GRANT ALL ON public.addons TO service_role;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addons public read" ON public.addons FOR SELECT TO anon, authenticated USING (true);

-- SETTINGS (single row)
CREATE TABLE public.settings (
  id int PRIMARY KEY DEFAULT 1,
  restaurant_open boolean NOT NULL DEFAULT true,
  offline_reason text NOT NULL DEFAULT 'We are currently closed. Please check back soon!',
  delivery_fee numeric(10,2) NOT NULL DEFAULT 30,
  referral_amount numeric(10,2) NOT NULL DEFAULT 50,
  contact_phone text NOT NULL DEFAULT '9310914628',
  whatsapp_phone text NOT NULL DEFAULT '9310914628',
  upi_qr_url text,
  upi_id text DEFAULT '',
  zomato_url text DEFAULT '',
  catering_text text NOT NULL DEFAULT 'Mealbox91 Catering Service',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_single_row CHECK (id = 1)
);
GRANT SELECT ON public.settings TO anon, authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.settings FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.settings (id) VALUES (1);

-- COUPONS
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  min_order numeric(10,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  owner_user_id uuid,
  used boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO anon, authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public promo read" ON public.coupons FOR SELECT TO anon, authenticated USING (owner_user_id IS NULL);
CREATE POLICY "own referral coupons read" ON public.coupons FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

-- ORDERS
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  customer_name text,
  phone text,
  mode text NOT NULL DEFAULT 'table',
  table_no text,
  tower text,
  flat text,
  address text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  coupon_code text,
  delivery_otp text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own orders read" ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own orders insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE INDEX orders_created_at_idx ON public.orders (created_at);

-- SEED MENU
INSERT INTO public.categories (name, sort_order) VALUES
  ('Meal Boxes', 1), ('Snacks', 2), ('Beverages', 3);

INSERT INTO public.menu_items (category_id, name, description, price, sort_order)
SELECT c.id, v.name, v.descr, v.price, v.so FROM public.categories c
JOIN (VALUES
  ('Meal Boxes','Veg Thali Box','2 sabzi, dal, 4 roti, rice, salad', 120, 1),
  ('Meal Boxes','Rajma Chawal Box','Homestyle rajma with steamed rice', 99, 2),
  ('Meal Boxes','Chole Bhature Box','2 bhature with chole and pickle', 110, 3),
  ('Snacks','Veg Spring Roll','Crispy rolls with sweet chilli dip', 80, 1),
  ('Snacks','Paneer Tikka (6 pcs)','Char-grilled marinated paneer', 150, 2),
  ('Beverages','Masala Chai','Freshly brewed with kadak masala', 25, 1)
) AS v(cat, name, descr, price, so) ON v.cat = c.name;

INSERT INTO public.addons (name, price, sort_order) VALUES
  ('Coca-Cola 250ml', 20, 1), ('Sprite 250ml', 20, 2), ('Thums Up 250ml', 20, 3), ('Fresh Lime Soda', 40, 4);

INSERT INTO public.coupons (code, discount_amount, min_order, note) VALUES
  ('WELCOME30', 30, 199, 'Welcome offer');

-- PURGE JOB (48h retention)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE OR REPLACE FUNCTION public.purge_old_orders()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.orders WHERE created_at < now() - interval '48 hours';
$$;
SELECT cron.schedule('purge-old-orders', '0 * * * *', $$SELECT public.purge_old_orders();$$);
