export type HubStatus = "OPEN" | "LOCKED" | "ARRIVED" | "CANCELLED";
export type OrderStatus = "RESERVED" | "COLLECTED" | "CANCELLED";

export type Profile = {
  id: string;
  full_name: string;
  phone_number: string;
  postal_code: string;
  hdb_block: string;
  latitude: number;
  longitude: number;
};

export type Merchant = {
  id: string;
  name: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
};

export type OrderHub = {
  id: string;
  host_id: string;
  merchant_id: string;
  cutoff_time: string;
  void_deck_notes: string;
  base_delivery_fee: number;
  current_split_fee: number;
  status: HubStatus;
  created_at: string;
};

export type CartItem = {
  name: string;
  qty: number;
  price: number;
};

export type SubOrder = {
  id: string;
  hub_id: string;
  user_id: string;
  cart_items: CartItem[];
  items_total_price: number;
  order_status: OrderStatus;
  created_at: string;
};

export type HubWithMerchant = OrderHub & {
  merchant: Merchant;
  host: Profile;
  subOrders: SubOrder[];
};
