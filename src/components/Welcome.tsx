import { ArrowRight } from "lucide-react";

export function Welcome({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="hero">
      <span className="eyebrow">SMALL ORDERS. BIG NEIGHBOURHOOD ENERGY.</span>
      <h1>
        Your food run.
        <br />
        With a few more
        <br />
        <em>good neighbours.</em>
      </h1>
      <p>
        Someone’s ordering. You’re hungry. Bitez brings you together to split
        delivery and collect close to home.
      </p>
      <button className="primary" onClick={onSignIn}>
        Find your people <ArrowRight size={19} />
      </button>
      <div className="heroSteps">
        <div>
          <span>01</span>
          <strong>Find a run</strong>
          <p>Search your area for an open group.</p>
        </div>
        <div>
          <span>02</span>
          <strong>Add your order</strong>
          <p>Reserve before the host’s cutoff.</p>
        </div>
        <div>
          <span>03</span>
          <strong>Meet & collect</strong>
          <p>Pick up at a shared public spot.</p>
        </div>
      </div>
      <p className="fine">
        A community pilot in Singapore. Hosts arrange orders directly; Bitez
        does not process payments or deliver food.
      </p>
    </section>
  );
}
