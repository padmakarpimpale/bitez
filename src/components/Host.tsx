import { useState, lazy, Suspense } from "react";
import { Navigation, ArrowRight } from "lucide-react";
import { rpc } from "../api";
import type { Action, Location } from "../types";
import {
  AREAS,
  inSingapore,
  localInputTime,
  deliveryEstimate,
  money,
} from "../utils";
import { currentLocation } from "../location";
const LocationPicker = lazy(() =>
  import("../LocationPicker").then((m) => ({ default: m.LocationPicker })),
);

export function Host({
  busy,
  hasProfile,
  action,
  onDone,
}: {
  busy: boolean;
  hasProfile: boolean;
  action: Action;
  onDone: (id: string) => void;
}) {
  const [point, setPoint] = useState<Location>(AREAS[0]),
    [picked, setPicked] = useState(false),
    [fee, setFee] = useState("6"),
    [capacity, setCapacity] = useState("6");
  const fullShare =
    fee !== "" && capacity !== ""
      ? deliveryEstimate(Number(fee), Number(capacity))
      : null;
  const pick = (p: Location) => {
    setPoint(p);
    setPicked(true);
  };
  return (
    <form
      className="panel wide"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void action(async () => {
          if (!picked)
            throw new Error(
              "Select your exact public pickup point on the map.",
            );
          const id = await rpc("create_social_run", {
            p_restaurant: String(f.get("restaurant")).trim(),
            p_pickup: String(f.get("pickup")).trim(),
            p_postal: String(f.get("postal")),
            p_lat: point.lat,
            p_lng: point.lng,
            p_cutoff: new Date(String(f.get("cutoff"))).toISOString(),
            p_fee: Number(f.get("fee")),
            p_capacity: Number(f.get("capacity")),
            p_meal_note: String(f.get("meal_note") ?? ""),
          });
          onDone(id);
        });
      }}
    >
      <h1>Host a food run</h1>
      <p>
        You’ll place the combined order and arrange collection. Choose a public
        ground-floor pickup point.
      </p>
      <div className="formGrid">
        <label className="spanAll">
          Restaurant / stall
          <input
            name="restaurant"
            placeholder="e.g. a stall at Jurong West hawker centre"
            minLength={2}
            maxLength={100}
            required
          />
        </label>
        <label>
          Order cutoff (your device’s local time)
          <input
            name="cutoff"
            type="datetime-local"
            defaultValue={localInputTime()}
            required
          />
        </label>
        <label>
          Total delivery fee (SGD)
          <input
            name="fee"
            type="number"
            min={0}
            max={200}
            step="0.01"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            required
          />
        </label>
        <label>
          Maximum people, including you
          <input
            name="capacity"
            type="number"
            min={2}
            max={50}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            required
          />
        </label>
      </div>
      {fullShare !== null &&
        Number(capacity) >= 2 &&
        Number(capacity) <= 50 &&
        Number(fee) <= 200 && (
          <div className="hostSplitPreview" aria-live="polite">
            <strong>
              {money(fullShare)} delivery each if all {capacity} people join
            </strong>
            <p>
              {money(Number(fee))} total ÷ {capacity} people, including you.
              Your run starts with just you, so the initial share is{" "}
              {money(Number(fee))}. It goes down as neighbours join.
            </p>
          </div>
        )}
      <h2 className="formSectionTitle">Where to collect</h2>
      <div className="formGrid">
        <label>
          Pickup postal code
          <input
            name="postal"
            pattern="[0-9]{6}"
            inputMode="numeric"
            maxLength={6}
            required
          />
        </label>
        <label className="spanAll">
          Pickup instructions
          <input
            name="pickup"
            placeholder="Block, lift lobby / public meeting point and collection instructions"
            minLength={5}
            maxLength={300}
            required
          />
        </label>
      </div>
      <div className="actions">
        <label>
          Centre map on
          <select
            onChange={(e) => {
              setPoint(AREAS[Number(e.target.value)]);
              setPicked(false);
            }}
          >
            {AREAS.map((a, i) => (
              <option key={a.label} value={i}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void action(async () => pick(await currentLocation()))}
        >
          <Navigation size={17} />
          Use my current pickup location
        </button>
      </div>
      <p className="fine">
        Tap the map or drag the pin to the exact pickup spot. Only this pickup
        point is published. Do not select a private home.
      </p>
      <Suspense fallback={<div className="map empty">Loading pickup map…</div>}>
        <LocationPicker value={point} onChange={pick} />
      </Suspense>
      <details
        className="coordinateDetails"
        onInvalidCapture={(e) => {
          e.currentTarget.open = true;
        }}
      >
        <summary>Enter pickup coordinates manually</summary>
        <div className="formGrid">
          <label>
            Pickup latitude
            <input
              type="number"
              step="any"
              min={1.15}
              max={1.5}
              value={point.lat}
              onChange={(e) => pick({ ...point, lat: Number(e.target.value) })}
              required
            />
          </label>
          <label>
            Pickup longitude
            <input
              type="number"
              step="any"
              min={103.6}
              max={104.1}
              value={point.lng}
              onChange={(e) => pick({ ...point, lng: Number(e.target.value) })}
              required
            />
          </label>
        </div>
      </details>
      <label className="checkbox">
        <input type="checkbox" required />
        I’ll arrange this order, share final costs with participants at pickup,
        and use a safe public collection point.
      </label>
      <label className="mealInviteField">
        Invite people to eat together (optional)
        <input
          name="meal_note"
          maxLength={160}
          placeholder="e.g. Stay for lunch at the public picnic tables, 12:30 pm"
        />
        <small>
          Leave blank for pickup only. Use a public place; neighbours can opt in
          through chat.
        </small>
      </label>
      <p className="fine">
        Delivery shares are estimates and change as people join or cancel. No
        payments are collected by Bitez. Cutoff must be 5 minutes to 48 hours
        from now.
      </p>
      <button
        className="primary"
        disabled={
          busy || !hasProfile || !picked || !inSingapore(point.lat, point.lng)
        }
      >
        Publish run <ArrowRight size={18} />
      </button>
    </form>
  );
}
