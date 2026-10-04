import test from "node:test";
import assert from "node:assert/strict";
import {
  canJoin,
  distanceMeters,
  inSingapore,
  localInputTime,
  manifest,
  validateItems,
} from "../src/utils.ts";
import type { Hub, SubOrder } from "../src/types.ts";
test("distance uses actual pickup coordinates and is symmetric", () => {
  assert.equal(distanceMeters(1.34, 103.7, 1.34, 103.7), 0);
  const a = distanceMeters(1.34, 103.7, 1.35, 103.7);
  assert.ok(a > 1100 && a < 1120);
  assert.equal(a, distanceMeters(1.35, 103.7, 1.34, 103.7));
});
test("closed, expired and full runs reject joins", () => {
  const h = {
    status: "OPEN",
    cutoff_time: "2026-10-04T10:00:00Z",
    participant_count: 2,
    max_participants: 3,
  } as Hub;
  const now = Date.parse("2026-10-04T09:00:00Z");
  assert.ok(canJoin(h, now));
  assert.ok(!canJoin(h, Date.parse(h.cutoff_time)));
  assert.ok(!canJoin({ ...h, status: "LOCKED" }, now));
  assert.ok(!canJoin({ ...h, participant_count: 3 }, now));
});
test("reject invalid and forged item quantities and price precision", () => {
  const good = [{ name: "Rice", qty: 2, price: 5.5 }];
  assert.ok(validateItems(good));
  for (const item of [
    { name: "", qty: 1, price: 2 },
    { name: "Rice", qty: 1.5, price: 2 },
    { name: "Rice", qty: -1, price: 2 },
    { name: "Rice", qty: 1, price: NaN },
    { name: "Rice", qty: 1, price: 2.001 },
  ])
    assert.ok(!validateItems([item]));
  assert.ok(!validateItems([]));
});
test("manifest retains collected orders but excludes cancelled orders", () => {
  const o = (name: string, qty: number, status: SubOrder["order_status"]) =>
    ({
      cart_items: [{ name, qty, price: 4 }],
      order_status: status,
    }) as SubOrder;
  assert.deepEqual(
    manifest([
      o("Rice", 2, "RESERVED"),
      o("rice", 1, "COLLECTED"),
      o("Rice", 4, "CANCELLED"),
    ]),
    [{ name: "rice", qty: 3, price: 4 }],
  );
});
test("location validation rejects non-finite and out-of-region input", () => {
  assert.ok(inSingapore(1.34, 103.7));
  assert.ok(!inSingapore(NaN, 103.7));
  assert.ok(!inSingapore(18.52, 73.85));
});
test("datetime input preserves device local time instead of truncating UTC", () => {
  const d = new Date("2026-10-04T05:00:00Z");
  assert.equal(
    localInputTime(d),
    new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16),
  );
});
