import type { Hub } from "../types";
import { deliveryEstimate, money } from "../utils";

export function DeliverySplit({
  hub,
  compact = false,
}: {
  hub: Hub;
  compact?: boolean;
}) {
  if (hub.status === "CANCELLED") {
    return (
      <p className="fine cancelledSplit">
        Run cancelled. There is no active delivery split.
      </p>
    );
  }
  const fullShare = deliveryEstimate(
    hub.base_delivery_fee,
    hub.max_participants,
  );
  const canGrow =
    hub.status === "OPEN" &&
    Date.parse(hub.cutoff_time) > Date.now() &&
    hub.participant_count < hub.max_participants;
  return (
    <div className={`deliverySplit${compact ? " compact" : ""}`}>
      <div className="splitHeadline">
        <span>Delivery per person · estimate</span>
        <strong>{money(hub.current_split_fee)}</strong>
      </div>
      <span className="splitEquation">
        {money(hub.base_delivery_fee)} total ÷ {hub.participant_count}{" "}
        {hub.participant_count === 1 ? "person" : "people"} joined
      </span>
      {canGrow && fullShare !== null && (
        <span className="splitForecast">
          {money(fullShare)} each if all {hub.max_participants} join
        </span>
      )}
      {!compact && (
        <small>
          Includes the host. Food is separate; the share changes when people
          join or cancel. Agree final costs with your host.
        </small>
      )}
    </div>
  );
}
