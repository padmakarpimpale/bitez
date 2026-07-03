import type { Merchant, OrderHub, Profile, SubOrder } from "./types";

const now = Date.now();

export const demoProfile: Profile = {
  id: "demo-neighbor",
  full_name: "Aisha Tan",
  phone_number: "+6588881122",
  postal_code: "560412",
  hdb_block: "412",
  latitude: 1.3708,
  longitude: 103.8461,
};

export const demoHost: Profile = {
  id: "demo-host",
  full_name: "Marcus Lim",
  phone_number: "+6591112233",
  postal_code: "560410",
  hdb_block: "410",
  latitude: 1.3712,
  longitude: 103.847,
};

export const demoMerchants: Merchant[] = [
  {
    id: "merchant-1",
    name: "Ah Seng Curry Rice",
    description: "Bulk-friendly curry rice, cutlets, braised cabbage, and egg sets.",
    address: "Ang Mo Kio Ave 10",
    latitude: 1.3699,
    longitude: 103.849,
    is_active: true,
  },
  {
    id: "merchant-2",
    name: "Green Bowl Collective",
    description: "Single-source grain bowls with vegetarian and chicken options.",
    address: "Bishan Street 13",
    latitude: 1.3645,
    longitude: 103.8459,
    is_active: true,
  },
];

export const demoHubs: OrderHub[] = [
  {
    id: "hub-1",
    host_id: demoHost.id,
    merchant_id: "merchant-1",
    cutoff_time: new Date(now + 54 * 60 * 1000).toISOString(),
    void_deck_notes: "Blk 412 ground floor stone table beside lift B",
    base_delivery_fee: 8,
    current_split_fee: 2.67,
    status: "OPEN",
    created_at: new Date(now - 20 * 60 * 1000).toISOString(),
  },
  {
    id: "hub-2",
    host_id: demoHost.id,
    merchant_id: "merchant-2",
    cutoff_time: new Date(now + 20 * 60 * 1000).toISOString(),
    void_deck_notes: "Blk 410 letterbox area, ground floor",
    base_delivery_fee: 6,
    current_split_fee: 3,
    status: "OPEN",
    created_at: new Date(now - 8 * 60 * 1000).toISOString(),
  },
];

export const demoOrders: SubOrder[] = [
  {
    id: "order-1",
    hub_id: "hub-1",
    user_id: "neighbor-2",
    cart_items: [
      { name: "Curry rice set", qty: 2, price: 5.5 },
      { name: "Braised egg", qty: 2, price: 0.8 },
    ],
    items_total_price: 12.6,
    order_status: "RESERVED",
    created_at: new Date(now - 10 * 60 * 1000).toISOString(),
  },
  {
    id: "order-2",
    hub_id: "hub-1",
    user_id: "neighbor-3",
    cart_items: [{ name: "Chicken cutlet rice", qty: 1, price: 6.2 }],
    items_total_price: 6.2,
    order_status: "RESERVED",
    created_at: new Date(now - 7 * 60 * 1000).toISOString(),
  },
];
