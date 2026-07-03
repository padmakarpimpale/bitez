import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { Bell, CheckCircle2, Clock3, Copy, Home, MapPin, Plus, Search, Send, ShoppingBag, Users } from "lucide-react";
import { demoHost, demoHubs, demoMerchants, demoOrders, demoProfile } from "./demoData";
import { isSupabaseEnabled } from "./supabase";
import type { CartItem, HubStatus, HubWithMerchant, OrderHub, SubOrder } from "./types";
import { distanceMeters, manifest, money, shortTime, whatsappManifest } from "./utils";
import "./styles.css";

type View = "discover" | "host" | "manifest" | "profile";

function App() {
  const [profile, setProfile] = useState(demoProfile);
  const [merchants] = useState(demoMerchants);
  const [hubs, setHubs] = useState<OrderHub[]>(demoHubs);
  const [orders, setOrders] = useState<SubOrder[]>(demoOrders);
  const [view, setView] = useState<View>("discover");
  const [selectedHubId, setSelectedHubId] = useState("hub-1");

  const hydratedHubs = useMemo<HubWithMerchant[]>(
    () =>
      hubs.map((hub) => ({
        ...hub,
        merchant: merchants.find((merchant) => merchant.id === hub.merchant_id) ?? merchants[0],
        host: hub.host_id === demoHost.id ? demoHost : profile,
        subOrders: orders.filter((order) => order.hub_id === hub.id),
      })),
    [hubs, merchants, orders, profile],
  );

  const nearbyHubs = hydratedHubs
    .map((hub) => ({
      ...hub,
      distance: distanceMeters(profile.latitude, profile.longitude, hub.merchant.latitude, hub.merchant.longitude),
    }))
    .filter((hub) => hub.status !== "CANCELLED" && hub.distance <= 500);

  const selectedHub = hydratedHubs.find((hub) => hub.id === selectedHubId) ?? hydratedHubs[0];

  function recalcSplit(nextOrders: SubOrder[], hubId: string, nextHubs = hubs) {
    return nextHubs.map((hub) => {
      if (hub.id !== hubId) return hub;
      const participantCount =
        new Set(nextOrders.filter((order) => order.hub_id === hubId && order.order_status === "RESERVED").map((o) => o.user_id)).size + 1;
      return { ...hub, current_split_fee: Math.round((hub.base_delivery_fee / participantCount) * 100) / 100 };
    });
  }

  function reserve(hubId: string, cartItems: CartItem[]) {
    const total = cartItems.reduce((sum, item) => sum + item.qty * item.price, 0);
    const nextOrders: SubOrder[] = [
      ...orders,
      {
        id: crypto.randomUUID(),
        hub_id: hubId,
        user_id: profile.id,
        cart_items: cartItems,
        items_total_price: total,
        order_status: "RESERVED",
        created_at: new Date().toISOString(),
      },
    ];
    setOrders(nextOrders);
    setHubs(recalcSplit(nextOrders, hubId));
  }

  function createHub(form: FormData) {
    const merchantId = String(form.get("merchant"));
    const baseFee = Number(form.get("fee") || 6);
    const nextHub: OrderHub = {
      id: crypto.randomUUID(),
      host_id: profile.id,
      merchant_id: merchantId,
      cutoff_time: new Date(String(form.get("cutoff"))).toISOString(),
      void_deck_notes: String(form.get("notes")),
      base_delivery_fee: baseFee,
      current_split_fee: baseFee,
      status: "OPEN",
      created_at: new Date().toISOString(),
    };
    setHubs([nextHub, ...hubs]);
    setSelectedHubId(nextHub.id);
    setView("manifest");
  }

  function setHubStatus(hubId: string, status: HubStatus) {
    setHubs(hubs.map((hub) => (hub.id === hubId ? { ...hub, status } : hub)));
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div className="brandMark">KD</div>
          <div>
            <strong>KampongDrop</strong>
            <span>HDB group food runs</span>
          </div>
        </div>
        <div className="envBadge">{isSupabaseEnabled ? "Supabase live" : "Demo mode"}</div>
      </header>

      <section className="shell">
        <aside className="sidebar">
          <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}>
            <Search size={18} /> Discover
          </button>
          <button className={view === "host" ? "active" : ""} onClick={() => setView("host")}>
            <Plus size={18} /> Host run
          </button>
          <button className={view === "manifest" ? "active" : ""} onClick={() => setView("manifest")}>
            <ShoppingBag size={18} /> Manifest
          </button>
          <button className={view === "profile" ? "active" : ""} onClick={() => setView("profile")}>
            <Home size={18} /> Profile
          </button>
        </aside>

        <section className="workspace">
          {view === "discover" && <Discover hubs={nearbyHubs} selectedHubId={selectedHubId} onSelect={setSelectedHubId} onReserve={reserve} />}
          {view === "host" && <Host merchants={merchants} onCreate={createHub} />}
          {view === "manifest" && selectedHub && <Manifest hub={selectedHub} setStatus={(status) => setHubStatus(selectedHub.id, status)} />}
          {view === "profile" && <ProfileEditor profile={profile} onSave={(next) => setProfile({ ...profile, ...next })} />}
        </section>
      </section>
    </main>
  );
}

function Discover({
  hubs,
  selectedHubId,
  onSelect,
  onReserve,
}: {
  hubs: (HubWithMerchant & { distance: number })[];
  selectedHubId: string;
  onSelect: (id: string) => void;
  onReserve: (id: string, items: CartItem[]) => void;
}) {
  const selectedHub = hubs.find((hub) => hub.id === selectedHubId) ?? hubs[0];
  return (
    <div className="twoCol">
      <div>
        <div className="sectionTitle">
          <h1>Nearby runs</h1>
          <p>Open hubs within 500m of your HDB profile.</p>
        </div>
        <div className="hubList">
          {hubs.map((hub) => (
            <button key={hub.id} className={`hubCard ${hub.id === selectedHub?.id ? "selected" : ""}`} onClick={() => onSelect(hub.id)}>
              <span className="status">{hub.status}</span>
              <strong>{hub.merchant.name}</strong>
              <span>
                <MapPin size={15} /> {Math.round(hub.distance)}m away
              </span>
              <span>
                <Clock3 size={15} /> Cutoff {shortTime(hub.cutoff_time)}
              </span>
              <span>
                <Users size={15} /> Current split {money(hub.current_split_fee)}
              </span>
            </button>
          ))}
        </div>
      </div>
      {selectedHub && <ReservePanel hub={selectedHub} onReserve={(items) => onReserve(selectedHub.id, items)} />}
    </div>
  );
}

function ReservePanel({ hub, onReserve }: { hub: HubWithMerchant; onReserve: (items: CartItem[]) => void }) {
  const [item, setItem] = useState("Curry rice set");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(5.5);
  const disabled = hub.status !== "OPEN";
  return (
    <div className="panel">
      <span className="status">{hub.status}</span>
      <h2>{hub.merchant.name}</h2>
      <p>{hub.merchant.description}</p>
      <div className="infoGrid">
        <span>Host</span>
        <strong>{hub.host.full_name}</strong>
        <span>Void deck</span>
        <strong>{hub.void_deck_notes}</strong>
        <span>Delivery share</span>
        <strong>{money(hub.current_split_fee)}</strong>
      </div>
      <div className="formGrid">
        <label>
          Item
          <input value={item} onChange={(event) => setItem(event.target.value)} />
        </label>
        <label>
          Qty
          <input type="number" min="1" value={qty} onChange={(event) => setQty(Number(event.target.value))} />
        </label>
        <label>
          Price
          <input type="number" min="0" step="0.1" value={price} onChange={(event) => setPrice(Number(event.target.value))} />
        </label>
      </div>
      <button className="primary" disabled={disabled} onClick={() => onReserve([{ name: item, qty, price }])}>
        <Send size={18} /> Reserve order
      </button>
    </div>
  );
}

function Host({ merchants, onCreate }: { merchants: typeof demoMerchants; onCreate: (form: FormData) => void }) {
  const defaultCutoff = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
  return (
    <form
      className="panel wide"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate(new FormData(event.currentTarget));
      }}
    >
      <div className="sectionTitle">
        <h1>Create a hub</h1>
        <p>Set the merchant, cutoff, delivery fee, and exact ground-floor collection point.</p>
      </div>
      <div className="formGrid">
        <label>
          Merchant
          <select name="merchant">
            {merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cutoff time
          <input name="cutoff" type="datetime-local" defaultValue={defaultCutoff} required />
        </label>
        <label>
          Base delivery fee
          <input name="fee" type="number" step="0.1" min="0" defaultValue="8" required />
        </label>
        <label className="spanAll">
          Void deck notes
          <textarea name="notes" required defaultValue="Blk 412 ground floor stone table beside lift B" />
        </label>
      </div>
      <button className="primary">
        <Plus size={18} /> Open hub
      </button>
    </form>
  );
}

function Manifest({ hub, setStatus }: { hub: HubWithMerchant; setStatus: (status: HubStatus) => void }) {
  const rows = manifest(hub.subOrders);
  return (
    <div className="panel wide">
      <div className="manifestHeader">
        <div>
          <span className="status">{hub.status}</span>
          <h1>{hub.merchant.name}</h1>
          <p>{hub.void_deck_notes}</p>
        </div>
        <div className="actions">
          <button onClick={() => navigator.clipboard.writeText(rows.map((r) => `${r.qty}x ${r.name}`).join("\n"))}>
            <Copy size={18} /> Copy
          </button>
          <a className="button" href={`https://wa.me/?text=${whatsappManifest(hub.merchant.name, hub.subOrders)}`} target="_blank">
            <Send size={18} /> WhatsApp
          </a>
        </div>
      </div>
      <div className="stats">
        <div>
          <span>Orders</span>
          <strong>{hub.subOrders.length}</strong>
        </div>
        <div>
          <span>Split fee</span>
          <strong>{money(hub.current_split_fee)}</strong>
        </div>
        <div>
          <span>Cutoff</span>
          <strong>{shortTime(hub.cutoff_time)}</strong>
        </div>
      </div>
      <div className="manifestRows">
        {rows.map((item) => (
          <div key={item.name}>
            <strong>{item.qty}x</strong>
            <span>{item.name}</span>
          </div>
        ))}
      </div>
      <div className="actions">
        <button onClick={() => setStatus("LOCKED")}>
          <Clock3 size={18} /> Lock
        </button>
        <button className="primary" onClick={() => setStatus("ARRIVED")}>
          <Bell size={18} /> Mark arrived
        </button>
        <button onClick={() => setStatus("CANCELLED")}>
          <CheckCircle2 size={18} /> Cancel
        </button>
      </div>
    </div>
  );
}

function ProfileEditor({
  profile,
  onSave,
}: {
  profile: typeof demoProfile;
  onSave: (next: Partial<typeof demoProfile>) => void;
}) {
  return (
    <form
      className="panel wide"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSave({
          full_name: String(form.get("name")),
          phone_number: String(form.get("phone")),
          postal_code: String(form.get("postal")),
          hdb_block: String(form.get("block")),
        });
      }}
    >
      <div className="sectionTitle">
        <h1>Profile</h1>
        <p>Used for nearby hub matching and PayNow contact details.</p>
      </div>
      <div className="formGrid">
        <label>
          Name
          <input name="name" defaultValue={profile.full_name} />
        </label>
        <label>
          Phone
          <input name="phone" defaultValue={profile.phone_number} />
        </label>
        <label>
          Postal code
          <input name="postal" defaultValue={profile.postal_code} />
        </label>
        <label>
          HDB block
          <input name="block" defaultValue={profile.hdb_block} />
        </label>
      </div>
      <button className="primary">
        <CheckCircle2 size={18} /> Save profile
      </button>
    </form>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
