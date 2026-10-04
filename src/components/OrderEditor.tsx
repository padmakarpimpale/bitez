import { useState, useEffect } from "react";
import { Plus, X, Check } from "lucide-react";
import { client, getHostCart, message, rpc } from "../api";
import type { Hub, CartItem } from "../types";
import { money, validateItems } from "../utils";

export function OrderEditor({
  hub,
  user,
  onSaved,
}: {
  hub: Hub;
  user: string;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<CartItem[]>([]),
    [loaded, setLoaded] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = async () => {
      let cart: CartItem[];
      if (hub.host_id === user) cart = await getHostCart(hub.id);
      else {
        const { data, error } = await client()
          .from("sub_orders")
          .select("cart_items")
          .eq("hub_id", hub.id)
          .eq("user_id", user)
          .neq("order_status", "CANCELLED")
          .single();
        if (error) throw error;
        cart = data.cart_items;
      }
      if (active) {
        setItems(cart.length ? cart : [{ name: "", qty: 1, price: 0 }]);
        setLoaded(true);
      }
    };
    void load().catch((e) => {
      if (active) setError(message(e));
    });
    return () => {
      active = false;
    };
  }, [hub.id, hub.host_id, user]);
  const edit = (n: number, key: keyof CartItem, value: string | number) =>
    setItems(items.map((i, idx) => (idx === n ? { ...i, [key]: value } : i)));
  const open =
    hub.status === "OPEN" && Date.parse(hub.cutoff_time) > Date.now();
  return (
    <form
      className="orderEditor"
      onSubmit={(e) => {
        e.preventDefault();
        if (saving || !open) return;
        setSaving(true);
        setError("");
        void (async () => {
          if (!validateItems(items))
            throw new Error("Check item names, quantities and prices.");
          await rpc("edit_run_order", { p_hub: hub.id, p_items: items });
          onSaved();
        })()
          .catch((e) => setError(message(e)))
          .finally(() => setSaving(false));
      }}
    >
      <h3>Your food order</h3>
      <p className="fine">
        Chat to agree choices, then save your items here before the cutoff.
        Prices are estimates in SGD.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!loaded ? (
        <p>Loading your order…</p>
      ) : (
        <>
          {items.map((item, n) => (
            <div className="itemRow" key={n}>
              <label>
                Item
                <input
                  value={item.name}
                  maxLength={100}
                  required
                  disabled={!open || saving}
                  onChange={(e) => edit(n, "name", e.target.value)}
                />
              </label>
              <label>
                Qty
                <input
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  required
                  value={item.qty}
                  disabled={!open || saving}
                  onChange={(e) => edit(n, "qty", Number(e.target.value))}
                />
              </label>
              <label>
                Unit price
                <input
                  type="number"
                  min={0}
                  max={200}
                  step="0.01"
                  required
                  value={item.price}
                  disabled={!open || saving}
                  onChange={(e) => edit(n, "price", Number(e.target.value))}
                />
              </label>
              <button
                type="button"
                aria-label={`Remove item ${n + 1}`}
                disabled={!open || saving || items.length === 1}
                onClick={() => setItems(items.filter((_, idx) => idx !== n))}
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <div className="actions">
            <button
              type="button"
              disabled={!open || saving || items.length >= 20}
              onClick={() =>
                setItems([...items, { name: "", qty: 1, price: 0 }])
              }
            >
              <Plus size={16} />
              Add item
            </button>
            <strong>
              Food estimate:{" "}
              {money(items.reduce((sum, i) => sum + i.qty * i.price, 0))}
            </strong>
          </div>
          {open ? (
            <button className="primary" disabled={saving}>
              <Check size={16} />
              {saving ? "Saving…" : "Save my order"}
            </button>
          ) : (
            <p className="fine">
              Orders are closed. Use chat to coordinate pickup with the host.
            </p>
          )}
        </>
      )}
    </form>
  );
}
