export type HubStatus = "OPEN" | "LOCKED" | "ARRIVED" | "CANCELLED";
export type Profile = {
  id: string;
  full_name: string;
  postal_code: string;
  hdb_block: string;
};
export type CartItem = { name: string; qty: number; price: number };
export type SubOrder = {
  id: string;
  hub_id: string;
  user_id: string;
  participant_name: string;
  cart_items: CartItem[];
  items_total_price: number;
  order_status: "RESERVED" | "COLLECTED" | "CANCELLED";
  created_at: string;
};
export type Hub = {
  id: string;
  host_id: string;
  host_name: string;
  merchant_id: string;
  merchant: { name: string; description: string };
  cutoff_time: string;
  void_deck_notes: string;
  base_delivery_fee: number;
  current_split_fee: number;
  status: HubStatus;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_postal_code: string;
  max_participants: number;
  participant_count: number;
  meal_note?: string;
  distance?: number;
};
export type Location = { lat: number; lng: number; label: string };

export type Action = (work: () => Promise<void>) => Promise<void>;
export type RunMessage = {
  id: string;
  hub_id: string;
  sender_id: string | null;
  sender_name: string;
  body: string;
  kind: "message" | "announcement" | "system";
  client_id: string | null;
  created_at: string;
  removed_at: string | null;
};
