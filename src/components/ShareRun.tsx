import { useState } from "react";
import { Share2 } from "lucide-react";
import type { Hub } from "../types";
import { message } from "../api";
export function ShareRun({ hub }: { hub: Hub }) {
  const [notice, setNotice] = useState("");
  return (
    <div className="shareInvite">
      <button
        onClick={() =>
          void (async () => {
            const url = new URL(window.location.origin);
            url.searchParams.set("run", hub.id);
            if (navigator.share)
              await navigator.share({
                title: `Join ${hub.merchant.name} on Bitez`,
                text: "Join our food run and split delivery. Sign in to view pickup details.",
                url: url.toString(),
              });
            else {
              await navigator.clipboard.writeText(url.toString());
              setNotice("Invite link copied. Share it with your neighbours.");
            }
          })().catch((e) => {
            if (e?.name !== "AbortError") setNotice(message(e));
          })
        }
      >
        <Share2 size={16} />
        Share invite
      </button>
      {notice && <small role="status">{notice}</small>}
    </div>
  );
}
