import { useCallback, useEffect, useRef, useState } from "react";
import {
  Send,
  MessageCircle,
  Pin,
  Flag,
  Trash2,
  ShoppingBag,
  MapPin,
  Clock3,
  Users,
  RefreshCw,
} from "lucide-react";
import { client, getChatMessages, getRun, message, rpc } from "../api";
import type { Hub, RunMessage } from "../types";
import { chatWritable, mergeMessages, validChatMessage } from "../chat";
import { shortTime } from "../utils";
import { DeliverySplit } from "./DeliverySplit";
import { OrderEditor } from "./OrderEditor";

export function RunChat({
  initialHub,
  user,
  onUpdate,
}: {
  initialHub: Hub;
  user: string;
  onUpdate: () => void;
}) {
  const [hub, setHub] = useState(initialHub),
    [messages, setMessages] = useState<RunMessage[]>([]),
    [pinned, setPinned] = useState<RunMessage | null>(null);
  const [live, setLive] = useState(false),
    [loaded, setLoaded] = useState(false),
    [access, setAccess] = useState(true),
    [error, setError] = useState("");
  const [draft, setDraft] = useState(""),
    [announcement, setAnnouncement] = useState(false),
    [sending, setSending] = useState(false),
    [tab, setTab] = useState<"chat" | "order">("chat");
  const [older, setOlder] = useState(false),
    [more, setMore] = useState(false),
    [report, setReport] = useState<RunMessage | null>(null),
    [moderating, setModerating] = useState(false);
  const list = useRef<HTMLDivElement>(null),
    nearBottom = useRef(true),
    nonce = useRef<{ body: string; kind: string; id: string } | null>(null),
    mounted = useRef(true),
    hasHistory = useRef(false),
    refreshSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const [next, rows, pinResult] = await Promise.all([
      getRun(initialHub.id),
      getChatMessages(initialHub.id),
      client()
        .from("run_messages")
        .select("*")
        .eq("hub_id", initialHub.id)
        .eq("kind", "announcement")
        .is("removed_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1),
    ]);
    if (pinResult.error) throw pinResult.error;
    if (!mounted.current || sequence !== refreshSequence.current) return;
    setHub(next);
    setMessages((previous) => mergeMessages(previous, rows));
    setPinned(pinResult.data?.[0] ?? null);
    setLoaded(true);
    setError("");
    if (!hasHistory.current) {
      setMore(rows.length === 60);
      hasHistory.current = true;
    }
  }, [initialHub.id]);
  useEffect(() => {
    mounted.current = true;
    let running = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (running || !mounted.current) return;
      running = true;
      try {
        await refresh();
      } catch (e) {
        if (mounted.current) {
          const text = message(e);
          setError(text);
          if (text.includes("no longer have access")) {
            setAccess(false);
            setMessages([]);
            setPinned(null);
            setDraft("");
          }
        }
      } finally {
        running = false;
      }
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), 100);
    };
    const channel = client()
      .channel(`run-chat:${initialHub.id}:${user}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "run_messages",
          filter: `hub_id=eq.${initialHub.id}`,
        },
        (event) => {
          schedule();
          if (event.new.kind === "system") onUpdate();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "run_messages",
          filter: `hub_id=eq.${initialHub.id}`,
        },
        (event) => {
          // RLS authorizes this payload; retain moderation updates even for older loaded rows.
          const row = event.new as RunMessage;
          if (mounted.current)
            setMessages((previous) =>
              previous.map((m) => (m.id === row.id ? row : m)),
            );
          schedule();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "order_hubs",
          filter: `id=eq.${initialHub.id}`,
        },
        () => {
          schedule();
          onUpdate();
        },
      )
      .subscribe((status) => {
        if (!mounted.current) return;
        setLive(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") schedule();
      });
    void load();
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 5000);
    const visible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      mounted.current = false;
      refreshSequence.current++;
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", visible);
      void client().removeChannel(channel);
    };
  }, [initialHub.id, user, refresh]);
  useEffect(() => {
    if (nearBottom.current && tab === "chat" && list.current)
      list.current.scrollTop = list.current.scrollHeight;
  }, [messages, tab]);
  const send = async () => {
    if (sending || !validChatMessage(draft) || !chatWritable(hub)) return;
    const body = draft.trim(),
      kind = announcement ? "announcement" : "message";
    const id =
      nonce.current?.body === body && nonce.current.kind === kind
        ? nonce.current.id
        : crypto.randomUUID();
    nonce.current = { body, kind, id };
    setSending(true);
    setError("");
    try {
      await rpc("send_run_message", {
        p_hub: hub.id,
        p_body: body,
        p_client_id: id,
        p_kind: kind,
      });
      if (!mounted.current) return;
      setDraft("");
      setAnnouncement(false);
      nonce.current = null;
      nearBottom.current = true;
      await refresh();
    } catch (e) {
      if (mounted.current) setError(message(e));
    } finally {
      if (mounted.current) setSending(false);
    }
  };
  const time = (s: string) =>
    new Intl.DateTimeFormat("en-SG", {
      timeZone: "Asia/Singapore",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(s));
  if (!access)
    return (
      <div className="chatLost">
        <MessageCircle size={32} />
        <h2>Chat access has ended</h2>
        <p>{error} Join an open run to chat with its group.</p>
      </div>
    );
  return (
    <div className="runRoom">
      <header className="roomHeading">
        <span className="roomIcon">
          <MessageCircle size={24} />
        </span>
        <div>
          <span className="fine">Your food-run group</span>
          <h2>{hub.merchant.name}</h2>
          <span className="roomConnection" role="status">
            <i className={live ? "connected" : ""} />
            {live ? "Live updates" : "Reconnecting · checking every 5 seconds"}
          </span>
        </div>
      </header>
      <details className="mobileRunDetails">
        <summary>
          <MapPin size={16} /> Pickup, cutoff & delivery share
        </summary>
        <p>{hub.void_deck_notes}</p>
        <p>Order cutoff: {shortTime(hub.cutoff_time)}</p>
        <DeliverySplit hub={hub} />
        {hub.meal_note && <p>Optional shared meal: {hub.meal_note}</p>}
      </details>
      <div className="roomLayout">
        <section className="chatPane">
          <div className="roomTabs">
            <button
              className={tab === "chat" ? "active" : ""}
              onClick={() => setTab("chat")}
            >
              <MessageCircle size={17} />
              Group chat
            </button>
            <button
              className={tab === "order" ? "active" : ""}
              onClick={() => setTab("order")}
            >
              <ShoppingBag size={17} />
              My order
            </button>
          </div>
          {error && (
            <div className="banner error" role="alert">
              {error}
              <button
                aria-label="Refresh chat"
                onClick={() =>
                  void refresh().catch((e) => setError(message(e)))
                }
              >
                <RefreshCw size={15} />
              </button>
            </div>
          )}
          {tab === "order" ? (
            <OrderEditor
              hub={hub}
              user={user}
              onSaved={() => {
                onUpdate();
                setTab("chat");
                void refresh().catch((e) => setError(message(e)));
              }}
            />
          ) : (
            <>
              {pinned && (
                <div className="pinnedMessage">
                  <Pin size={16} />
                  <div>
                    <strong>Host announcement</strong>
                    <p>{pinned.body}</p>
                  </div>
                </div>
              )}
              <div
                className="chatMessages"
                ref={list}
                role="log"
                aria-label="Group messages"
                aria-live="polite"
                onScroll={() => {
                  const el = list.current;
                  if (el)
                    nearBottom.current =
                      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                }}
              >
                {more && messages.length < 500 && (
                  <button
                    className="loadOlder"
                    disabled={older}
                    onClick={() => {
                      setOlder(true);
                      nearBottom.current = false;
                      void getChatMessages(hub.id, messages[0])
                        .then((rows) => {
                          if (!mounted.current) return;
                          setMessages((previous) =>
                            mergeMessages(previous, rows),
                          );
                          setMore(rows.length === 60);
                        })
                        .catch((e) => setError(message(e)))
                        .finally(() => setOlder(false));
                    }}
                  >
                    {older ? "Loading…" : "Load earlier messages"}
                  </button>
                )}
                {!loaded ? (
                  <p className="chatHint">Loading the conversation…</p>
                ) : !messages.length ? (
                  <div className="chatEmpty">
                    <MessageCircle size={30} />
                    <strong>Say hello to your lunch crew</strong>
                    <p>
                      Discuss food choices, dietary needs and where to collect.
                      Save your final items in My order.
                    </p>
                  </div>
                ) : (
                  messages.map((m) =>
                    m.kind === "system" ? (
                      <p key={m.id} className="systemMessage">
                        {m.body}
                      </p>
                    ) : (
                      <article
                        key={m.id}
                        className={`chatMessage ${m.sender_id === user ? "mine" : ""} ${m.removed_at ? "removed" : ""}`}
                      >
                        <div className="messageAuthor">
                          <strong>
                            {m.sender_id === user ? "You" : m.sender_name}
                            {m.sender_id === hub.host_id && <span>Host</span>}
                          </strong>
                          <time
                            dateTime={m.created_at}
                            title={shortTime(m.created_at)}
                          >
                            {time(m.created_at)}
                          </time>
                        </div>
                        <p>{m.body}</p>
                        {!m.removed_at && (
                          <div className="messageTools">
                            {(m.sender_id === user || hub.host_id === user) && (
                              <button
                                disabled={moderating}
                                onClick={() => {
                                  setModerating(true);
                                  void rpc("moderate_run_message", {
                                    p_message: m.id,
                                  })
                                    .then(() => refresh())
                                    .catch((e) => setError(message(e)))
                                    .finally(() => setModerating(false));
                                }}
                                aria-label={`Remove message from ${m.sender_name}`}
                              >
                                <Trash2 size={12} />
                                Remove
                              </button>
                            )}
                            {m.sender_id !== user && (
                              <button
                                onClick={() => setReport(m)}
                                aria-label={`Report message from ${m.sender_name}`}
                              >
                                <Flag size={12} />
                                Report
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    ),
                  )
                )}
              </div>
              {chatWritable(hub) ? (
                <form
                  className="chatComposer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  <div className="quickReplies">
                    {[
                      "Hi everyone!",
                      "Can we confirm the pickup?",
                      "I’m at the pickup point.",
                    ].map((text) => (
                      <button
                        type="button"
                        key={text}
                        disabled={sending}
                        onClick={() => setDraft(text)}
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                  {hub.host_id === user && (
                    <label className="announceToggle">
                      <input
                        type="checkbox"
                        checked={announcement}
                        onChange={(e) => setAnnouncement(e.target.checked)}
                        disabled={sending}
                      />
                      <Pin size={14} />
                      Post as pinned host announcement
                    </label>
                  )}
                  <label className="srOnly" htmlFor="run-chat-draft">
                    Message the group
                  </label>
                  <div className="composeRow">
                    <textarea
                      id="run-chat-draft"
                      rows={2}
                      value={draft}
                      maxLength={1000}
                      disabled={sending}
                      placeholder="Ask about food or arrange pickup…"
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                    />
                    <button
                      className="primary"
                      aria-label="Send message"
                      disabled={sending || !validChatMessage(draft)}
                    >
                      <Send size={19} />
                    </button>
                  </div>
                  <small>
                    Enter to send · Shift + Enter for a new line. Keep private
                    addresses and payment details out of chat.
                  </small>
                </form>
              ) : (
                <p className="chatClosed">
                  This chat is read-only. Messaging closes when a run is
                  cancelled or 24 hours after its cutoff.
                </p>
              )}
            </>
          )}
          {report && (
            <form
              className="chatReport"
              onSubmit={(e) => {
                e.preventDefault();
                const reason = String(
                  new FormData(e.currentTarget).get("reason"),
                );
                setModerating(true);
                void rpc("report_run_message", {
                  p_message: report.id,
                  p_reason: reason,
                })
                  .then(() => {
                    setReport(null);
                    setError("");
                  })
                  .catch((e) => setError(message(e)))
                  .finally(() => setModerating(false));
              }}
            >
              <label>
                Report this message
                <textarea
                  name="reason"
                  minLength={10}
                  maxLength={500}
                  required
                  placeholder="Describe the concern…"
                />
              </label>
              <p className="fine">
                Saved for the pilot operator’s review. For urgent help, use
                local emergency services.
              </p>
              <div className="actions">
                <button className="primary" disabled={moderating}>
                  Submit report
                </button>
                <button type="button" onClick={() => setReport(null)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
        <aside className="roomDetails">
          <span className={`status status-${hub.status.toLowerCase()}`}>
            {hub.status}
          </span>
          <h3>Run details</h3>
          <p>
            <Users size={16} />
            {hub.participant_count} joined, including the host
          </p>
          <p>
            <Clock3 size={16} />
            {shortTime(hub.cutoff_time)}
          </p>
          <p>
            <MapPin size={16} />
            {hub.void_deck_notes}
          </p>
          <DeliverySplit hub={hub} />
          {hub.meal_note && (
            <div className="mealInvitation">
              <strong>Eat together? Optional.</strong>
              <p>{hub.meal_note}</p>
              <small>Let the group know in chat if you’d like to stay.</small>
            </div>
          )}
          <button onClick={() => setTab("order")}>
            <ShoppingBag size={16} />
            Review my food order
          </button>
          <p className="fine">
            Chat access is for the host and joined neighbours. Leaving a run
            ends access. Messages are available for 30 days after cutoff.
          </p>
        </aside>
      </div>
    </div>
  );
}
