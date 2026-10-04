import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import {
  Search,
  Plus,
  ShoppingBag,
  User,
  MapPin,
  ArrowRight,
  Users,
  Clock3,
  RefreshCw,
  Navigation,
  X,
} from "lucide-react";
import {
  client,
  getProfile,
  getOrders,
  getManagedHubs,
  message,
  rpc,
} from "./api";
import { supabase } from "./supabase";
import type { Action, Hub, Location, Profile, SubOrder } from "./types";
import { AREAS, canJoin, money, shortTime } from "./utils";
import { currentLocation } from "./location";
import "./styles.css";
type View = "discover" | "host" | "orders" | "account" | "privacy" | "terms";
import { Welcome } from "./components/Welcome";
import { Auth } from "./components/Auth";
import { Account } from "./components/Account";
import { Host } from "./components/Host";
import { Reservation } from "./components/Reservation";
import { MyRuns } from "./components/MyRuns";
import { Legal } from "./components/Legal";

function App() {
  const [session, setSession] = useState<Session | null>(null),
    [authLoading, setAuthLoading] = useState(true),
    [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<View>(
      window.location.pathname === "/privacy"
        ? "privacy"
        : window.location.pathname === "/terms"
          ? "terms"
          : "discover",
    ),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<SubOrder[]>([]),
    [myHubs, setMyHubs] = useState<Hub[]>([]),
    [hubs, setHubs] = useState<Hub[]>([]),
    [selected, setSelected] = useState<string | null>(null);
  const [location, setLocation] = useState<Location>(AREAS[0]),
    [radius, setRadius] = useState(2000),
    [query, setQuery] = useState(""),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(false);
  const [recovery, setRecovery] = useState(false),
    [version, setVersion] = useState(0),
    [now, setNow] = useState(Date.now());
  const user = session?.user.id;
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (active) {
        setSession(data.session);
        setAuthLoading(false);
        if (error) setError(message(error));
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setAuthLoading(false);
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        setView("account");
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  const action: Action = async (work) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      setVersion((v) => v + 1);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setOrders([]);
      setMyHubs([]);
      setHubs([]);
      setSelected(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const [p, o] = await Promise.all([getProfile(user), getOrders(user)]);
        const h = await getManagedHubs(user, o);
        if (active) {
          setProfile(p);
          setOrders(o);
          setMyHubs(h);
        }
      } catch (e) {
        if (active) setError(message(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [user, version]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    const timeout = setTimeout(() => {
      rpc("discover_runs", {
        p_lat: location.lat,
        p_lng: location.lng,
        p_radius: radius,
        p_search: query.trim(),
        p_offset: offset,
      })
        .then((data: Hub[]) => {
          if (active) {
            setHubs(data.slice(0, 20));
            setMore(data.length > 20);
          }
        })
        .catch((e) => {
          if (active) setError(message(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [user, location, radius, query, offset, version]);
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible") setVersion((v) => v + 1);
    }, 20000);
    const refresh = () => {
      if (document.visibilityState === "visible") setVersion((v) => v + 1);
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const selectedHub = hubs.find((h) => h.id === selected);
  const go = (v: View) => {
    setView(v);
    window.history.replaceState(
      null,
      "",
      v === "privacy" ? "/privacy" : v === "terms" ? "/terms" : "/",
    );
    setError("");
    setNotice("");
  };
  return (
    <main>
      <header className="topbar">
        <button
          className="brand"
          onClick={() => go("discover")}
          aria-label="Bitez home"
        >
          <img src="/logo.svg" width="44" height="44" alt="" />
          <span>
            <strong>
              bitez<span className="brand-dot">.</span>
            </strong>
            <small>Good food. Shared delivery.</small>
          </span>
        </button>
        <div className="headerActions">
          <span className="pilot">Community pilot</span>
          <button onClick={() => go("account")}>
            <User size={17} />
            {user ? "Account" : "Sign in"}
          </button>
        </div>
      </header>
      <div className="shell">
        <nav className="sidebar" aria-label="Main navigation">
          {(
            [
              ["discover", "Discover", Search],
              ["host", "Host a run", Plus],
              ["orders", "My runs", ShoppingBag],
              ["account", "Account", User],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              aria-current={view === v ? "page" : undefined}
              className={view === v ? "active" : ""}
              onClick={() => go(v)}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
          <div className="navNote">
            <strong>
              A little closer.
              <br />A little cheaper.
            </strong>
            <p>
              Collect together at a public pickup point in your neighbourhood.
            </p>
          </div>
        </nav>
        <section className="workspace">
          {error && (
            <div role="alert" className="banner error">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="banner success">
              {notice}
            </div>
          )}
          {!supabase && (
            <div role="alert" className="banner error">
              Bitez is not configured. Real runs are unavailable. Please try
              again later.
            </div>
          )}
          {authLoading ? (
            <div className="empty">Checking your session…</div>
          ) : view === "privacy" || view === "terms" ? (
            <Legal page={view} />
          ) : view === "account" ? (
            recovery ? (
              <form
                className="panel auth"
                onSubmit={(e) => {
                  e.preventDefault();
                  const p = String(
                    new FormData(e.currentTarget).get("password"),
                  );
                  void action(async () => {
                    const { error } = await client().auth.updateUser({
                      password: p,
                    });
                    if (error) throw error;
                    setRecovery(false);
                    setNotice("Password updated.");
                  });
                }}
              >
                <h1>Set a new password</h1>
                <label>
                  New password
                  <input
                    name="password"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Save password
                </button>
              </form>
            ) : user ? (
              <Account
                profile={profile}
                user={user}
                busy={busy}
                action={action}
                notify={setNotice}
              />
            ) : (
              <Auth busy={busy} action={action} notify={setNotice} />
            )
          ) : !user ? (
            <Welcome onSignIn={() => go("account")} />
          ) : (
            <>
              {!profile && (
                <div className="banner">
                  Save a display name and postal code before hosting or joining.
                  <button onClick={() => go("account")}>
                    Set up profile <ArrowRight size={16} />
                  </button>
                </div>
              )}
              {view === "discover" && (
                <>
                  <div className="sectionTitle">
                    <span className="eyebrow">
                      YOUR NEIGHBOURHOOD, ONE ORDER
                    </span>
                    <h1>Find your next bite.</h1>
                    <p>
                      Join a nearby food run. Share the delivery fee. Collect
                      together.
                    </p>
                  </div>
                  <div className="filters">
                    <label className="searchBox">
                      <Search size={19} />
                      <input
                        aria-label="Search runs"
                        placeholder="Restaurant, host, block or postal code"
                        maxLength={100}
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setOffset(0);
                          setSelected(null);
                        }}
                      />
                    </label>
                    <label>
                      Search area
                      <select
                        value={AREAS.findIndex(
                          (a) => a.label === location.label,
                        )}
                        onChange={(e) => {
                          setLocation(AREAS[Number(e.target.value)]);
                          setOffset(0);
                          setSelected(null);
                        }}
                      >
                        {!AREAS.some((a) => a.label === location.label) && (
                          <option value={-1}>{location.label}</option>
                        )}
                        {AREAS.map((a, i) => (
                          <option key={a.label} value={i}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Radius
                      <select
                        value={radius}
                        onChange={(e) => {
                          setRadius(Number(e.target.value));
                          setOffset(0);
                          setSelected(null);
                        }}
                      >
                        {[500, 1000, 2000, 5000, 20000].map((r) => (
                          <option key={r} value={r}>
                            {r < 1000 ? r + " m" : r / 1000 + " km"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      onClick={() =>
                        void action(async () => {
                          const pos = await currentLocation();
                          setLocation(pos);
                          setOffset(0);
                          setSelected(null);
                        })
                      }
                      disabled={busy}
                    >
                      <Navigation size={17} />
                      Use my location
                    </button>
                  </div>
                  <div className="resultLine">
                    <span>
                      <MapPin size={15} />
                      {location.label} ·{" "}
                      {location.label.startsWith("Current")
                        ? "Straight-line distance to pickup"
                        : "Distances from the area centre"}
                    </span>
                    <button
                      aria-label="Refresh runs"
                      onClick={() => setVersion((v) => v + 1)}
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                  {loading && !hubs.length ? (
                    <div className="empty" role="status">
                      Finding food runs…
                    </div>
                  ) : hubs.length ? (
                    <div className="hubGrid">
                      {hubs
                        .filter((h) => canJoin(h, now))
                        .map((h) => (
                          <button
                            key={h.id}
                            className="hubCard"
                            onClick={() => setSelected(h.id)}
                          >
                            <div className="cardTop">
                              <span className="status">OPEN</span>
                              <span className="distance">
                                <MapPin size={14} />
                                {(h.distance ?? 0) < 1000
                                  ? Math.round(h.distance ?? 0) + " m"
                                  : ((h.distance ?? 0) / 1000).toFixed(1) +
                                    " km"}
                              </span>
                            </div>
                            <h2>{h.merchant.name}</h2>
                            <p>{h.void_deck_notes}</p>
                            <div className="hostLine">
                              <span className="avatar">
                                {h.host_name?.charAt(0).toUpperCase()}
                              </span>
                              Hosted by {h.host_name}
                            </div>
                            <div className="cardMeta">
                              <span>
                                <Clock3 size={15} />
                                {shortTime(h.cutoff_time)}
                              </span>
                              <span>
                                <Users size={15} />
                                {h.participant_count}/{h.max_participants}{" "}
                                people
                              </span>
                            </div>
                            <div className="cardBottom">
                              <span>
                                <small>Current delivery share</small>
                                <strong>{money(h.current_split_fee)}</strong>
                              </span>
                              <span className="joinLink">
                                View run <ArrowRight size={18} />
                              </span>
                            </div>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <div className="empty">
                      <ShoppingBag size={32} />
                      <h2>No open runs here yet.</h2>
                      <p>
                        Try a wider radius, clear your search, or start a run
                        for your neighbours.
                      </p>
                      <button className="primary" onClick={() => go("host")}>
                        Host the first run <Plus size={17} />
                      </button>
                    </div>
                  )}
                  <div className="pagination">
                    <button
                      disabled={!offset || loading}
                      onClick={() => {
                        setOffset((o) => Math.max(0, o - 20));
                        setSelected(null);
                      }}
                    >
                      Previous
                    </button>
                    <span>Page {offset / 20 + 1}</span>
                    <button
                      disabled={!more || loading}
                      onClick={() => {
                        setOffset((o) => o + 20);
                        setSelected(null);
                      }}
                    >
                      Next
                    </button>
                  </div>
                  {selectedHub && (
                    <Modal onClose={() => setSelected(null)}>
                      <button
                        className="close"
                        autoFocus
                        aria-label="Close run"
                        onClick={() => setSelected(null)}
                      >
                        <X />
                      </button>
                      <Reservation
                        key={selectedHub.id}
                        hub={selectedHub}
                        user={user}
                        orders={orders}
                        busy={busy}
                        hasProfile={!!profile}
                        action={action}
                        onDone={() => {
                          setSelected(null);
                          setNotice(
                            "Run updated. Your reservations are in My runs.",
                          );
                        }}
                      />
                    </Modal>
                  )}
                </>
              )}
              {view === "host" && (
                <Host
                  busy={busy}
                  hasProfile={!!profile}
                  action={action}
                  onDone={() => {
                    setView("orders");
                    setNotice("Your run is live. Neighbours can now find it.");
                  }}
                />
              )}
              {view === "orders" && (
                <MyRuns
                  hubs={myHubs}
                  orders={orders}
                  user={user}
                  busy={busy}
                  action={action}
                  version={version}
                  notify={setNotice}
                />
              )}
            </>
          )}
          <footer>
            <span>
              © {new Date().getFullYear()} Bitez · Neighbour-organised food runs
            </span>
            <div>
              <button onClick={() => go("privacy")}>Privacy & deletion</button>
              <button onClick={() => go("terms")}>Community terms</button>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      d?.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="panel modal"
      aria-label="Run details"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
