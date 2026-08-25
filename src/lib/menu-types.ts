export type Category = {
  id: string;
  name: string;
  sort_order: number;
  chef_phone?: string | null;
};

export type MenuItem = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_veg: boolean;
  available: boolean;
  sort_order: number;
};

export type Addon = {
  id: string;
  name: string;
  price: number;
  available: boolean;
  sort_order: number;
};

export type Settings = {
  id: number;
  restaurant_open: boolean;
  offline_reason: string;
  delivery_fee: number;
  referral_amount: number;
  contact_phone: string;
  whatsapp_phone: string;
  upi_qr_url: string | null;
  upi_id: string | null;
  zomato_url: string | null;
  catering_text: string;
  direct_delivery_enabled: boolean;
  direct_offline_reason: string;
  eden_enabled: boolean;
  eden_offline_reason: string;
  delivery_staff_phones: string;
};

export type Coupon = {
  id: string;
  code: string;
  discount_amount: number;
  discount_percent: number;
  min_order: number;
  active: boolean;
  owner_user_id: string | null;
  used: boolean;
  note: string | null;
  created_at: string;
};

export type OrderRow = {
  id: string;
  user_id: string | null;
  customer_name: string | null;
  phone: string | null;
  mode: string;
  table_no: string | null;
  tower: string | null;
  flat: string | null;
  address: string | null;
  items: CartLine[];
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  coupon_code: string | null;
  delivery_otp: string;
  status: string;
  created_at: string;
};

export type CartLine = {
  key: string;
  id: string;
  kind: "item" | "addon";
  name: string;
  price: number;
  qty: number;
  note: string;
};

export const rupees = (n: number) => `₹${Number(n || 0).toFixed(0)}`;
