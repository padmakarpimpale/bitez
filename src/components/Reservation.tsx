import { useState } from "react";
import { Plus, X, MapPin, ArrowRight, Flag } from "lucide-react";
import { client, rpc } from "../api";
import type { Action, CartItem, Hub, SubOrder } from "../types";
import { canJoin, shortTime, money, validateItems } from "../utils";

export function Reservation({
  hub,
  user,
  orders,
  busy,
  hasProfile,
  action,
  onDone,
}: {
  hub: Hub;
  user: string;
  orders: SubOrder[];
  busy: boolean;
  hasProfile: boolean;
  action: Action;
  onDone: () => void;
}) {
  const [items, setItems] = useState<CartItem[]>([
      { name: "", qty: 1, price: 0 },
    ]),
    [report, setReport] = useState(false);
  const joined = orders.some(
      (o) => o.hub_id === hub.id && o.order_status !== "CANCELLED",
    ),
    isHost = hub.host_id === user;
  const edit = (idx: number, key: keyof CartItem, value: string | number) =>
    setItems(items.map((i, n) => (n === idx ? { ...i, [key]: value } : i)));
  return (
    <>
      <span className="status">{hub.status}</span>
      <h2>{hub.merchant.name}</h2>
      <p>
        Hosted by {hub.host_name} · {hub.participant_count}/
        {hub.max_participants} people
      </p>
      <div className="infoGrid">
        <span>Pickup</span>
        <strong>
          {hub.void_deck_notes}
          <br />
          Singapore {hub.pickup_postal_code}
        </strong>
        <span>Cutoff</span>
        <strong>{shortTime(hub.cutoff_time)}</strong>
        <span>Current delivery share</span>
        <strong>{money(hub.current_split_fee)}</strong>
      </div>
      <a
        className="textLink"
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hub.pickup_latitude + "," + hub.pickup_longitude)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open pickup in Maps <MapPin size={16} />
      </a>
      {joined ? (
        <div className="banner success">
          You have joined this run. Check My runs for updates.
        </div>
      ) : isHost ? (
        <p>You are the host. Manage this run in My runs.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              if (!validateItems(items))
                throw new Error(
                  "Check item names, quantities and estimated prices.",
                );
              await rpc("reserve_order", {
                p_hub: hub.id,
                p_items: items.map((i) => ({ ...i, name: i.name.trim() })),
              });
              onDone();
            });
          }}
        >
          <h3>Your order</h3>
          <p className="fine">
            Enter items from this restaurant. Prices are your estimates; agree
            final costs with the host at pickup.
          </p>
          {items.map((i, n) => (
            <div className="itemRow" key={n}>
              <label>
                Item
                <input
                  value={i.name}
                  maxLength={100}
                  required
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
                  value={i.qty}
                  required
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
                  value={i.price}
                  required
                  onChange={(e) => edit(n, "price", Number(e.target.value))}
                />
              </label>
              <button
                type="button"
                aria-label={`Remove item ${n + 1}`}
                disabled={items.length === 1}
                onClick={() => setItems(items.filter((_, k) => k !== n))}
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={items.length >= 20}
            onClick={() => setItems([...items, { name: "", qty: 1, price: 0 }])}
          >
            <Plus size={16} />
            Add item
          </button>
          <p>
            Estimated items:{" "}
            <strong>
              {money(items.reduce((s, i) => s + i.qty * i.price, 0))}
            </strong>
          </p>
          <button
            className="primary"
            disabled={busy || !hasProfile || !canJoin(hub)}
          >
            Join this run <ArrowRight size={18} />
          </button>
        </form>
      )}
      <hr />
      {!isHost && (
        <button
          disabled={busy}
          onClick={() =>
            void action(async () => {
              const { error } = await client().from("user_blocks").upsert(
                {
                  user_id: user,
                  blocked_user_id: hub.host_id,
                  blocked_name: hub.host_name,
                },
                { onConflict: "user_id,blocked_user_id" },
              );
              if (error) throw error;
              onDone();
            })
          }
        >
          Block host & hide future runs
        </button>
      )}
      <button onClick={() => setReport(!report)}>
        <Flag size={16} />
        Report this run
      </button>
      {report && (
        <Report hub={hub.id} user={user} busy={busy} action={action} />
      )}
    </>
  );
}
function Report({
  hub,
  user,
  busy,
  action,
}: {
  hub: string;
  user: string;
  busy: boolean;
  action: Action;
}) {
  const [sent, setSent] = useState(false);
  return sent ? (
    <p role="status">
      Report saved for review. For urgent danger, contact local emergency
      services.
    </p>
  ) : (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void action(async () => {
          await rpc("report_run", {
            p_hub: hub,
            p_reason: String(f.get("reason")).trim(),
          });
          setSent(true);
        });
      }}
    >
      <label>
        What happened?
        <textarea name="reason" minLength={10} maxLength={1000} required />
      </label>
      <button disabled={busy}>Submit report</button>
    </form>
  );
}
