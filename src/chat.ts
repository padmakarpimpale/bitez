import type { Hub, RunMessage } from "./types";
export function mergeMessages(previous: RunMessage[], incoming: RunMessage[]) {
  return [...new Map([...previous, ...incoming].map((m) => [m.id, m])).values()]
    .sort(
      (a, b) =>
        Date.parse(a.created_at) - Date.parse(b.created_at) ||
        a.id.localeCompare(b.id),
    )
    .slice(-500);
}
export function chatWritable(hub: Hub, now = Date.now()) {
  return (
    hub.status !== "CANCELLED" && Date.parse(hub.cutoff_time) + 86400000 > now
  );
}
export function validChatMessage(body: string) {
  return (
    body.trim().length > 0 &&
    [...body.trim()].length <= 1000 &&
    new TextEncoder().encode(body).length <= 4000
  );
}
