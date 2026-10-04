import { useState, useEffect } from "react";
import { Copy } from "lucide-react";
import { client, rpc, getManifest, message } from "../api";
import type { Action, Hub, SubOrder } from "../types";
import { manifest, money, shortTime } from "../utils";
import { DeliverySplit } from "./DeliverySplit";

export function MyRuns({
  hubs,
  orders,
  user,
  busy,
  action,
  version,
  notify,
}: {
  hubs: Hub[];
  orders: SubOrder[];
  user: string;
  busy: boolean;
  action: Action;
  version: number;
  notify: (s: string) => void;
}) {
  const hosted = hubs.filter((h) => h.host_id === user);
  return (
    <>
      <div className="sectionTitle">
        <h1>My runs</h1>
        <p>Track your reservations and manage the runs you host.</p>
      </div>
      <h2>Your reservations</h2>
      {!orders.length && (
        <p>No reservations yet. Find an open run in Discover.</p>
      )}
      <div className="hubGrid">
        {orders.map((o) => {
          const h = hubs.find((h) => h.id === o.hub_id);
          if (!h) return null;
          return (
            <div className="panel" key={o.id}>
              <span className="status">
                {h.status === "CANCELLED" ? "RUN CANCELLED" : o.order_status}
              </span>
              <h3>{h.merchant.name}</h3>
              <p>{h.void_deck_notes}</p>
              <p>{o.cart_items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
              <p>
                Items estimate: {money(o.items_total_price)}
                <br />
                Cutoff: {shortTime(h.cutoff_time)}
              </p>
              {o.order_status === "CANCELLED" ? (
                <p className="fine">
                  Reservation cancelled. You are no longer in the delivery
                  split.
                </p>
              ) : (
                <DeliverySplit hub={h} compact />
              )}
              {h.status === "ARRIVED" && o.order_status === "RESERVED" && (
                <div className="banner success">
                  Food has arrived. Collect at the pickup point.
                </div>
              )}
              {o.order_status === "RESERVED" &&
                h.status === "OPEN" &&
                Date.parse(h.cutoff_time) > Date.now() && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        await rpc("cancel_order", { p_order: o.id });
                        notify("Reservation cancelled.");
                      })
                    }
                  >
                    Cancel reservation
                  </button>
                )}
              <p className="fine">Host: {h.host_name}</p>
            </div>
          );
        })}
      </div>
      <h2 className="spaced">Runs you host</h2>
      {!hosted.length && <p>You haven’t hosted a run yet.</p>}
      {hosted.map((h) => (
        <HostManifest
          key={h.id}
          hub={h}
          version={version}
          busy={busy}
          action={action}
          notify={notify}
        />
      ))}
    </>
  );
}
function HostManifest({
  hub,
  version,
  busy,
  action,
  notify,
}: {
  hub: Hub;
  version: number;
  busy: boolean;
  action: Action;
  notify: (s: string) => void;
}) {
  const [orders, setOrders] = useState<SubOrder[]>([]),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [cancel, setCancel] = useState(false);
  useEffect(() => {
    let active = true;
    getManifest(hub.id)
      .then((o) => {
        if (active) {
          setOrders(o);
          setError("");
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [hub.id, version]);
  return (
    <div className="panel manifestPanel">
      <div className="manifestHeader">
        <div>
          <span className="status">{hub.status}</span>
          <h2>{hub.merchant.name}</h2>
          <p>
            {hub.void_deck_notes} · {shortTime(hub.cutoff_time)}
          </p>
        </div>
      </div>
      <DeliverySplit hub={hub} />
      {error && <p role="alert">{error}</p>}
      {hub.status === "CANCELLED" ? null : !loaded ? (
        <p>Loading reservations…</p>
      ) : (
        <>
          <h3>Combined items from neighbours</h3>
          <p className="fine">
            Add your own order when placing the final restaurant order. You
            already count in the delivery split.
          </p>
          <div className="manifestRows">
            {manifest(orders).map((i) => (
              <div key={i.name}>
                <strong>{i.qty}×</strong>
                <span>{i.name}</span>
              </div>
            ))}
          </div>
          {!manifest(orders).length && <p>No active reservations yet.</p>}
          <details>
            <summary>Participant orders</summary>
            {orders
              .filter((o) => o.order_status !== "CANCELLED")
              .map((o) => (
                <div className="participant" key={o.id}>
                  <strong>{o.participant_name}</strong>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const { error } = await client()
                          .from("user_blocks")
                          .upsert(
                            {
                              user_id: hub.host_id,
                              blocked_user_id: o.user_id,
                              blocked_name: o.participant_name,
                            },
                            { onConflict: "user_id,blocked_user_id" },
                          );
                        if (error) throw error;
                        notify(
                          "Neighbour blocked from future runs. Existing order is still available for collection.",
                        );
                      })
                    }
                  >
                    Block from future runs
                  </button>
                  <p>
                    {o.cart_items.map((i) => `${i.qty}× ${i.name}`).join(", ")}{" "}
                    · {money(o.items_total_price)} estimate · {o.order_status}
                  </p>
                  {hub.status === "ARRIVED" &&
                    o.order_status === "RESERVED" && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            await rpc("collect_order", { p_order: o.id });
                            notify("Order marked collected.");
                          })
                        }
                      >
                        Mark collected
                      </button>
                    )}
                </div>
              ))}
          </details>
        </>
      )}
      <div className="actions">
        <button
          hidden={hub.status === "CANCELLED"}
          disabled={!loaded || !!error}
          onClick={() =>
            void action(async () => {
              await navigator.clipboard.writeText(
                `Bitez run: ${hub.merchant.name}\nPickup: ${hub.void_deck_notes}\n${manifest(
                  orders,
                )
                  .map((i) => `${i.qty}x ${i.name}`)
                  .join("\n")}`,
              );
              notify("Manifest copied.");
            })
          }
        >
          <Copy size={16} />
          Copy manifest
        </button>
        {hub.status === "OPEN" && (
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await rpc("set_run_status", {
                  p_hub: hub.id,
                  p_status: "LOCKED",
                });
                notify("Run locked. Place your restaurant order now.");
              })
            }
          >
            Lock orders
          </button>
        )}
        {hub.status === "LOCKED" && (
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await rpc("set_run_status", {
                  p_hub: hub.id,
                  p_status: "ARRIVED",
                });
                notify("Run marked arrived. Participants will see the update.");
              })
            }
          >
            Food has arrived
          </button>
        )}
        {["OPEN", "LOCKED"].includes(hub.status) &&
          (cancel ? (
            <>
              <button
                className="danger"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await rpc("set_run_status", {
                      p_hub: hub.id,
                      p_status: "CANCELLED",
                    });
                    notify("Run cancelled. All reservations were cancelled.");
                  })
                }
              >
                Confirm cancellation
              </button>
              <button onClick={() => setCancel(false)}>Keep run</button>
            </>
          ) : (
            <button onClick={() => setCancel(true)}>Cancel run</button>
          ))}
      </div>
    </div>
  );
}
