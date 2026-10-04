import test from "node:test";
import assert from "node:assert/strict";
import { chatWritable, mergeMessages, validChatMessage } from "../src/chat.ts";
import type { Hub, RunMessage } from "../src/types.ts";
const msg = (id: string, body: string, at: string) =>
  ({ id, body, created_at: at }) as RunMessage;
test("replayed messages are deduplicated and moderation replaces the original", () => {
  const first = msg("a", "Old body", "2026-10-04T11:00:00Z"),
    second = msg("b", "Reply", "2026-10-04T11:01:00Z");
  assert.deepEqual(
    mergeMessages(
      [second, first],
      [
        first,
        {
          ...first,
          body: "Message removed.",
          removed_at: "2026-10-04T11:02:00Z",
        },
      ],
    ),
    [
      {
        ...first,
        body: "Message removed.",
        removed_at: "2026-10-04T11:02:00Z",
      },
      second,
    ],
  );
});
test("chat closes on cancellation or exactly 24 hours after cutoff", () => {
  const hub = { status: "OPEN", cutoff_time: "2026-10-04T11:00:00Z" } as Hub;
  assert.ok(chatWritable(hub, Date.parse("2026-10-05T10:59:59Z")));
  assert.ok(!chatWritable(hub, Date.parse("2026-10-05T11:00:00Z")));
  assert.ok(
    !chatWritable(
      { ...hub, status: "CANCELLED" },
      Date.parse("2026-10-04T11:00:00Z"),
    ),
  );
  assert.ok(
    chatWritable(
      { ...hub, status: "LOCKED" },
      Date.parse("2026-10-04T12:00:00Z"),
    ),
  );
});
test("message validation bounds empty, unicode and oversized input", () => {
  assert.ok(!validChatMessage(" \n "));
  assert.ok(validChatMessage("Hi neighbours!"));
  assert.ok(validChatMessage("🍜".repeat(1000)));
  assert.ok(!validChatMessage("a".repeat(1001)));
  assert.ok(!validChatMessage("🍜".repeat(1001)));
});
