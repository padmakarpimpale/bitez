import { useState, useEffect } from "react";
import { Check, LogOut } from "lucide-react";
import { client, rpc } from "../api";
import type { Action, Profile } from "../types";

export function Account({
  profile,
  user,
  busy,
  action,
  notify,
}: {
  profile: Profile | null;
  user: string;
  busy: boolean;
  action: Action;
  notify: (s: string) => void;
}) {
  const [confirm, setConfirm] = useState(false),
    [blocks, setBlocks] = useState<
      { blocked_user_id: string; blocked_name: string }[]
    >([]);
  useEffect(() => {
    let active = true;
    client()
      .from("user_blocks")
      .select("blocked_user_id,blocked_name")
      .eq("user_id", user)
      .then(({ data, error }) => {
        if (active && !error) setBlocks(data ?? []);
      });
    return () => {
      active = false;
    };
  }, [user]);
  return (
    <div className="panel wide">
      <span className="eyebrow">YOUR COMMUNITY PROFILE</span>
      <h1>A name your neighbours know.</h1>
      <p>
        Your display name appears on runs and on your host’s manifest. Your
        profile postal code stays private.
      </p>
      <form
        key={profile?.id}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void action(async () => {
            const { error } = await client()
              .from("profiles")
              .upsert(
                {
                  id: user,
                  full_name: String(f.get("name")).trim(),
                  postal_code: String(f.get("postal")),
                  hdb_block: String(f.get("block")).trim(),
                },
                { onConflict: "id" },
              );
            if (error) throw error;
            notify("Profile saved. You can now host or join a run.");
          });
        }}
      >
        <div className="formGrid">
          <label>
            Display name
            <input
              name="name"
              defaultValue={profile?.full_name}
              minLength={2}
              maxLength={80}
              required
            />
          </label>
          <label>
            Singapore postal code
            <input
              name="postal"
              defaultValue={profile?.postal_code}
              pattern="[0-9]{6}"
              inputMode="numeric"
              maxLength={6}
              required
            />
          </label>
          <label>
            Block / neighbourhood (optional)
            <input
              name="block"
              defaultValue={profile?.hdb_block}
              maxLength={20}
            />
          </label>
        </div>
        <button className="primary" disabled={busy}>
          Save profile <Check size={18} />
        </button>
      </form>
      <hr />
      <button
        disabled={busy}
        onClick={() =>
          void action(async () => {
            const { error } = await client().auth.signOut();
            if (error) throw error;
          })
        }
      >
        <LogOut size={17} />
        Sign out
      </button>
      <h2 className="spaced">Blocked neighbours</h2>
      <p className="fine">
        Blocked neighbours cannot join your future runs, and their runs are
        hidden from your discovery. Existing reservations stay visible so they
        can be resolved.
      </p>
      {!blocks.length && <p>No blocked neighbours.</p>}
      {blocks.map((b) => (
        <div className="participant" key={b.blocked_user_id}>
          {b.blocked_name}
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const { error } = await client()
                  .from("user_blocks")
                  .delete()
                  .eq("user_id", user)
                  .eq("blocked_user_id", b.blocked_user_id);
                if (error) throw error;
                setBlocks(
                  blocks.filter((x) => x.blocked_user_id !== b.blocked_user_id),
                );
                notify("Neighbour unblocked.");
              })
            }
          >
            Unblock
          </button>
        </div>
      ))}
      <div className="dangerZone">
        <h2>Delete account</h2>
        <p>
          Finish or cancel active runs and reservations first. Deleting removes
          your profile, hosted runs and their reservations. This cannot be
          undone.
        </p>
        {confirm ? (
          <div className="actions">
            <button
              className="danger"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await rpc("delete_my_account");
                  await client().auth.signOut({ scope: "local" });
                  notify("Your account has been deleted.");
                })
              }
            >
              Permanently delete my account
            </button>
            <button onClick={() => setConfirm(false)}>Keep account</button>
          </div>
        ) : (
          <button disabled={busy} onClick={() => setConfirm(true)}>
            Delete my account
          </button>
        )}
      </div>
    </div>
  );
}
