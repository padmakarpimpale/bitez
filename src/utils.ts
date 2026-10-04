import type { CartItem, Hub, Location, SubOrder } from "./types";
export const money = (n: number) =>
  new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(
    n,
  );
export const shortTime = (s: string) =>
  new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(s));
// Forecast only. The database remains authoritative for the current split.
export function deliveryEstimate(fee: number, people: number) {
  if (
    !Number.isFinite(fee) ||
    fee < 0 ||
    !Number.isInteger(people) ||
    people < 1
  )
    return null;
  return Math.round((fee * 100) / people) / 100;
}
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
) {
  const rad = (x: number) => (x * Math.PI) / 180;
  const a =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) *
      Math.cos(rad(bLat)) *
      Math.sin(rad(bLng - aLng) / 2) ** 2;
  return (
    6371000 *
    2 *
    Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)))
  );
}
export const inSingapore = (lat: number, lng: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= 1.15 &&
  lat <= 1.5 &&
  lng >= 103.6 &&
  lng <= 104.1;
export const canJoin = (h: Hub, now = Date.now()) =>
  h.status === "OPEN" &&
  Date.parse(h.cutoff_time) > now &&
  h.participant_count < h.max_participants;
export function validateItems(items: CartItem[]) {
  return (
    items.length >= 1 &&
    items.length <= 20 &&
    items.every(
      (i) =>
        i.name.trim().length >= 1 &&
        i.name.trim().length <= 100 &&
        Number.isInteger(i.qty) &&
        i.qty >= 1 &&
        i.qty <= 20 &&
        Number.isFinite(i.price) &&
        i.price >= 0 &&
        i.price <= 200 &&
        Math.abs(i.price * 100 - Math.round(i.price * 100)) < 0.00001,
    ) &&
    items.reduce((n, i) => n + i.qty * i.price, 0) <= 9999
  );
}
export function manifest(orders: SubOrder[]) {
  const rows = new Map<string, CartItem>();
  orders
    .filter((o) => o.order_status !== "CANCELLED")
    .flatMap((o) => o.cart_items)
    .forEach((i) => {
      const key = i.name.trim().toLowerCase();
      const current = rows.get(key);
      rows.set(key, { ...i, qty: i.qty + (current?.qty ?? 0) });
    });
  return [...rows.values()];
}
export function localInputTime(date = new Date(Date.now() + 3600000)) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export const AREAS: Location[] = [
  { lat: 1.3388, lng: 103.7058, label: "Boon Lay / Jurong West" },
  { lat: 1.3331, lng: 103.7422, label: "Jurong East" },
  { lat: 1.3485, lng: 103.6831, label: "NTU / Pioneer" },
  { lat: 1.3691, lng: 103.8496, label: "Ang Mo Kio" },
  { lat: 1.3508, lng: 103.8485, label: "Bishan" },
  { lat: 1.3525, lng: 103.9453, label: "Tampines" },
  { lat: 1.436, lng: 103.7865, label: "Woodlands" },
  { lat: 1.403, lng: 103.9023, label: "Punggol" },
  { lat: 1.332, lng: 103.8474, label: "Toa Payoh" },
  { lat: 1.319, lng: 103.8928, label: "Paya Lebar" },
];
