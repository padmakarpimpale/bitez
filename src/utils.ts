import type { CartItem, SubOrder } from "./types";

export const money = (value: number) =>
  new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(value);

export const shortTime = (iso: string) =>
  new Intl.DateTimeFormat("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));

export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function manifest(subOrders: SubOrder[]) {
  const rows = new Map<string, CartItem>();
  subOrders
    .filter((order) => order.order_status === "RESERVED")
    .flatMap((order) => order.cart_items)
    .forEach((item) => {
      const key = item.name.toLowerCase();
      const current = rows.get(key) ?? { ...item, qty: 0 };
      rows.set(key, { ...current, qty: current.qty + item.qty });
    });
  return [...rows.values()];
}

export function whatsappManifest(title: string, orders: SubOrder[]) {
  const lines = manifest(orders).map((item) => `- ${item.qty}x ${item.name}`);
  return `KampongDrop manifest for ${title}%0A%0A${encodeURIComponent(lines.join("\n"))}`;
}
