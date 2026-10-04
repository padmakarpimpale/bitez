import { ArrowRight, MapPin, ShoppingBag, User } from "lucide-react";

export function Welcome({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="hero">
      <div className="welcomeGrid">
        <div className="welcomeIntro">
          <span className="locationLabel">
            <MapPin size={15} /> Singapore neighbourhoods
          </span>
          <h1>
            Split delivery.
            <br />
            Order together.
          </h1>
          <p>
            Join a food run nearby, add what you’re craving, and collect from
            one public pickup point.
          </p>
          <button className="primary" onClick={onSignIn}>
            Sign in to find a run <ArrowRight size={18} />
          </button>
          <p className="fine welcomeNote">
            Have a restaurant in mind? You can host a run too.
          </p>
        </div>
        <div
          className="splitExample"
          aria-label="Example: six people sharing a six dollar delivery fee pay one dollar each"
        >
          <span className="exampleLabel">A smaller delivery bill</span>
          <div className="examplePeople" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i}>
                <User size={19} />
              </span>
            ))}
          </div>
          <div className="exampleMath">
            <span>
              $6 <small>total delivery</small>
            </span>
            <span className="divide">÷</span>
            <span>
              6 <small>people joined</small>
            </span>
          </div>
          <div className="exampleResult">
            <strong>$1</strong>
            <span>delivery per person</span>
          </div>
          <p className="fine">
            Example only. Your share depends on the fee and how many people
            join. Food costs are separate.
          </p>
        </div>
      </div>
      <div className="welcomeDetails">
        <div>
          <ShoppingBag size={21} />
          <div>
            <strong>Your order, one shared pickup</strong>
            <p>
              Choose your items before the cutoff. The host places the combined
              restaurant order.
            </p>
          </div>
        </div>
        <div>
          <MapPin size={21} />
          <div>
            <strong>Collect close by</strong>
            <p>
              Meet at the host’s public pickup point and agree final costs
              together.
            </p>
          </div>
        </div>
      </div>
      <p className="fine">
        Community pilot in Singapore. Hosts arrange orders directly. Bitez does
        not collect payments or deliver food.
      </p>
    </section>
  );
}
