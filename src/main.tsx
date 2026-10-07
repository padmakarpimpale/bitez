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
  getRun,
} from "./api";
import { authStorageKey, supabase } from "./supabase";
import { authLinkError, callbackError, clearCallbackError } from "./authLinks";
import { passwordValidationError } from "./authValidation";
import { PasswordField } from "./components/PasswordField";
import { useIdleSession } from "./useIdleSession";
import type { Action, Hub, Location, Profile, SubOrder } from "./types";
import { AREAS, canJoin, shortTime } from "./utils";
import { currentLocation } from "./location";
import "./styles.css";
type View = "discover" | "host" | "orders" | "account" | "privacy" | "terms";
import { Welcome } from "./components/Welcome";
import { Auth } from "./components/Auth";
import { Account } from "./components/Account";
import { Host } from "./components/Host";
import { Reservation } from "./components/Reservation";
import { MyRuns } from "./components/MyRuns";
import { DeliverySplit } from "./components/DeliverySplit";
import { Legal } from "./components/Legal";
import { RunChat } from "./components/RunChat";

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
  const [chatHub, setChatHub] = useState<Hub | null>(null),
    [invitedHub, setInvitedHub] = useState<Hub | null>(null);
  const inviteId = useRef(
    new URLSearchParams(window.location.search).get("run"),
  );
  const authCallbackUrl = useRef(window.location.href);
  const [loginTarget, setLoginTarget] = useState<View>("discover");
  const [location, setLocation] = useState<Location>(AREAS[0]),
    [radius, setRadius] = useState(2000),
    [query, setQuery] = useState(""),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(false);
  const [recovery, setRecovery] = useState(false),
    [version, setVersion] = useState(0),
    [now, setNow] = useState(Date.now());
  const idle = useIdleSession(session, async () => {
    // Hide private UI immediately, including after a suspended tab resumes.
    setSession(null);
    setRecovery(false);
    setView("account");
    setError("");
    setNotice(
      "You were signed out after 60 minutes without activity. Sign in to continue. Your saved runs and orders are still there.",
    );
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      // Offline sign-out cannot revoke server refresh tokens. Clear the device
      // credential anyway; do not leave an idle browser able to reopen it.
      supabase.auth.stopAutoRefresh();
      try {
        window.localStorage.removeItem(authStorageKey);
      } catch {
        /* Storage unavailable. */
      }
    }
  });
  const user = idle.ready ? session?.user.id : undefined;
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    let active = true;
    const callbackUrl = new URL(authCallbackUrl.current);
    const linkError = callbackError(callbackUrl);
    if (linkError) {
      setError(linkError);
      setView("account");
      window.history.replaceState(
        null,
        "",
        clearCallbackError(new URL(callbackUrl)),
      );
    }
    void (async () => {
      // initialize exposes PKCE callback failures that getSession can hide.
      const { error: initializationError } = await supabase.auth.initialize();
      const { data, error } = await supabase.auth.getSession();
      if (active) {
        setSession(data.session);
        setAuthLoading(false);
        if (initializationError || error) {
          setError(
            linkError ??
              (callbackUrl.searchParams.has("code")
                ? authLinkError(initializationError ?? error)
                : message(initializationError ?? error)),
          );
          if (callbackUrl.searchParams.has("code")) {
            setView("account");
            window.history.replaceState(
              null,
              "",
              clearCallbackError(new URL(callbackUrl)),
            );
          }
        }
      }
    })();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setAuthLoading(false);
      if (event === "SIGNED_OUT") setRecovery(false);
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
      setChatHub(null);
      setInvitedHub(null);
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
  useEffect(() => {
    if (!user || !inviteId.current) return;
    const id = inviteId.current;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      inviteId.current = null;
      return;
    }
    let active = true;
    void getRun(id)
      .then((h) => {
        if (active) {
          setInvitedHub(h);
          setSelected(h.id);
          setView("discover");
          inviteId.current = null;
        }
      })
      .catch((e) => {
        if (active) {
          setError(message(e));
          inviteId.current = null;
        }
      });
    return () => {
      active = false;
    };
  }, [user]);
  const selectedHub =
    hubs.find((h) => h.id === selected) ??
    (invitedHub?.id === selected ? invitedHub : undefined);
  const openChat = (hub: Hub) => {
    setSelected(null);
    setChatHub(hub);
  };
  const go = (v: View) => {
    setView(v);
    window.history.replaceState(
      null,
      "",
      v === "privacy"
        ? "/privacy"
        : v === "terms"
          ? "/terms"
          : inviteId.current
            ? `/?run=${encodeURIComponent(inviteId.current)}`
            : "/",
    );
    setError("");
    setNotice("");
  };
  const requestAccess = (v: View) => {
    setLoginTarget(v);
    go("account");
  };
  useEffect(() => {
    const back = (event: Event) => {
      if (idle.warningSeconds !== null) {
        event.preventDefault();
        idle.staySignedIn();
      } else if (chatHub) {
        event.preventDefault();
        setChatHub(null);
      } else if (selected) {
        event.preventDefault();
        setSelected(null);
      } else if (view !== "discover") {
        event.preventDefault();
        go("discover");
      }
    };
    window.addEventListener("bitez:back", back);
    return () => window.removeEventListener("bitez:back", back);
  }, [chatHub, selected, view, idle.warningSeconds]);
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
          {!user && (
            <nav className="guestHeaderNav" aria-label="Explore Bitez">
              <button onClick={() => requestAccess("discover")}>
                Find food runs
              </button>
              <button onClick={() => requestAccess("host")}>Host a run</button>
            </nav>
          )}
          <span className="pilot">Community pilot</span>
          <button onClick={() => go("account")}>
            <User size={17} />
            {user ? "Account" : "Sign in"}
          </button>
        </div>
      </header>
      <div className={`shell${!user ? " guest" : ""}`}>
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
              onClick={() =>
                !user && v !== "account" ? requestAccess(v) : go(v)
              }
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
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
          {authLoading || (session && !idle.ready) ? (
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
                    const passwordError = passwordValidationError(p);
                    if (passwordError) throw new Error(passwordError);
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
                <PasswordField newPassword label="New password" />
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
              <Auth
                busy={busy}
                action={action}
                notify={setNotice}
                onSignedIn={() => go(loginTarget)}
              />
            )
          ) : !user ? (
            <Welcome
              initialArea={Math.max(
                0,
                AREAS.findIndex((area) => area.label === location.label),
              )}
              onSignIn={() => requestAccess("discover")}
              onHost={() => requestAccess("host")}
              onChooseArea={(index) => {
                setLocation(AREAS[index]);
                setOffset(0);
                requestAccess("discover");
              }}
            />
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
                    <h1>Food runs near you</h1>
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
                            {h.meal_note && (
                              <span className="mealTag">
                                Open to eating together
                              </span>
                            )}
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
                                {h.participant_count} joined ·{" "}
                                {Math.max(
                                  0,
                                  h.max_participants - h.participant_count,
                                )}{" "}
                                spots left
                              </span>
                            </div>
                            <div className="cardBottom">
                              <DeliverySplit hub={h} compact />
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
                        onOpenChat={openChat}
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
                  onDone={(id) => {
                    setView("orders");
                    setNotice("Your run is live. Neighbours can now find it.");
                    void getRun(id)
                      .then(openChat)
                      .catch((e) => setError(message(e)));
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
                  onOpenChat={openChat}
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
          {user && chatHub && (
            <Modal onClose={() => setChatHub(null)} wide>
              <button
                className="close"
                autoFocus
                aria-label="Close group chat"
                onClick={() => setChatHub(null)}
              >
                <X />
              </button>
              <RunChat
                key={`${chatHub.id}:${user}`}
                initialHub={chatHub}
                user={user}
                onUpdate={() => setVersion((v) => v + 1)}
              />
            </Modal>
          )}
        </section>
      </div>
      {user && idle.warningSeconds !== null && (
        <SessionWarning
          seconds={idle.warningSeconds}
          onContinue={idle.staySignedIn}
        />
      )}
    </main>
  );
}
function SessionWarning({
  seconds,
  onContinue,
}: {
  seconds: number;
  onContinue: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="panel modal"
      aria-labelledby="session-warning-title"
      onCancel={(event) => {
        event.preventDefault();
        onContinue();
      }}
    >
      <h2 id="session-warning-title">Still here?</h2>
      <p>
        Bitez will sign you out in {Math.ceil(seconds / 60)}{" "}
        {Math.ceil(seconds / 60) === 1 ? "minute" : "minutes"} because you
        haven’t interacted for a while.
      </p>
      <p>
        Save any unfinished items or messages. Saved runs and orders stay in
        your account.
      </p>
      <button className="primary" autoFocus onClick={onContinue}>
        Stay signed in
      </button>
    </dialog>
  );
}
function Modal({
  children,
  onClose,
  wide = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
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
      className={`panel modal${wide ? " roomModal" : ""}`}
      aria-label={wide ? "Food run group chat" : "Run details"}
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
