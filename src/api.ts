import { supabase } from "./supabase";
import type { Hub, Profile, SubOrder } from "./types";
export function client() {
  if (!supabase)
    throw new Error("Bitez is not configured yet. Please try again later.");
  return supabase;
}
export async function rpc(name: string, args?: Record<string, unknown>) {
  const { data, error } = await client().rpc(name, args);
  if (error) throw error;
  return data;
}
export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await client()
    .from("profiles")
    .select("id,full_name,postal_code,hdb_block")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export async function getOrders(id: string): Promise<SubOrder[]> {
  const { data, error } = await client()
    .from("sub_orders")
    .select("*")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}
export async function getManagedHubs(
  id: string,
  orders: SubOrder[],
): Promise<Hub[]> {
  const result = await client()
    .from("order_hubs")
    .select("*,merchant:merchants(name,description)")
    .eq("host_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (result.error) throw result.error;
  const ids = [...new Set(orders.map((o) => o.hub_id))];
  if (!ids.length) return result.data ?? [];
  const joined = await client()
    .from("order_hubs")
    .select("*,merchant:merchants(name,description)")
    .in("id", ids);
  if (joined.error) throw joined.error;
  return [
    ...new Map(
      [...(result.data ?? []), ...(joined.data ?? [])].map((h) => [h.id, h]),
    ).values(),
  ];
}
export async function getManifest(id: string): Promise<SubOrder[]> {
  const { data, error } = await client()
    .from("sub_orders")
    .select("*")
    .eq("hub_id", id)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}
export function message(error: unknown) {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "Something went wrong. Please try again.";
}
