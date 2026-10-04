import { useState } from "react";
import {
  ArrowRight,
  MapPin,
  MessageCircle,
  GraduationCap,
  Building2,
  Utensils,
  Plus,
  Users,
} from "lucide-react";
import { AREAS } from "../utils";

export function Welcome({
  onSignIn,
  onHost,
  onChooseArea,
}: {
  onSignIn: () => void;
  onHost: () => void;
  onChooseArea: (index: number) => void;
}) {
  const [area, setArea] = useState(0);
  return (
    <section className="landing">
      <div className="foodHero">
        <div className="heroCopy">
          <span className="landingEyebrow">
            <MapPin size={15} />
            Made for your neighbourhood
          </span>
          <h1>
            Good food.
            <br />
            <span>Better together.</span>
          </h1>
          <p>
            A lunch crew around the corner. Join a nearby food run, decide
            together in chat, and share the delivery fee.
          </p>
          <form
            className="areaSearch"
            onSubmit={(e) => {
              e.preventDefault();
              onChooseArea(area);
            }}
          >
            <label htmlFor="welcome-area">
              <MapPin size={18} />
              Where are you ordering?
            </label>
            <div>
              <select
                id="welcome-area"
                value={area}
                onChange={(e) => setArea(Number(e.target.value))}
              >
                {AREAS.map((a, i) => (
                  <option key={a.label} value={i}>
                    {a.label}
                  </option>
                ))}
              </select>
              <button className="primary">
                Find food runs <ArrowRight size={17} />
              </button>
            </div>
          </form>
          <div className="heroHost">
            <span>Already planning an order?</span>
            <button onClick={onHost}>
              Host a run <Plus size={16} />
            </button>
          </div>
          <div className="heroBenefits">
            <span>
              <MessageCircle size={15} />A chat for every run
            </span>
            <span>
              <MapPin size={15} />
              One public pickup
            </span>
          </div>
        </div>
        <div className="heroMedia">
          <img
            src="/images/shared-lunch.webp"
            width="1152"
            height="768"
            alt="Noodles, chicken rice and vegetables on a shared lunch table"
            fetchPriority="high"
          />
          <div className="foodCaption">
            <span className="captionIcon">
              <Utensils size={19} />
            </span>
            <div>
              <strong>Your usual lunch. A new crew.</strong>
              <span>Find, chat, order, collect.</span>
            </div>
          </div>
        </div>
      </div>
      <div className="areaShortcuts">
        <span>Explore your area</span>
        {[2, 0, 1, 5].map((i) => (
          <button key={i} onClick={() => onChooseArea(i)}>
            <MapPin size={13} />
            {AREAS[i].label}
            <ArrowRight size={13} />
          </button>
        ))}
      </div>
      <section className="foodOccasions">
        <div className="occasionHeading">
          <div>
            <span className="landingEyebrow">A reason to order together</span>
            <h2>Who’s your next lunch crew?</h2>
          </div>
          <button onClick={onSignIn}>
            Explore food runs <ArrowRight size={16} />
          </button>
        </div>
        <div className="occasionGrid">
          <button
            className="occasionCard campus"
            onClick={() => onChooseArea(2)}
          >
            <span className="occasionIcon">
              <GraduationCap size={26} />
            </span>
            <h3>Between classes</h3>
            <p>
              Find a food run around NTU and Pioneer. Sort lunch with your
              campus neighbours.
            </p>
            <span>
              Explore campus <ArrowRight size={16} />
            </span>
          </button>
          <button className="occasionCard work" onClick={onHost}>
            <span className="occasionIcon">
              <Building2 size={25} />
            </span>
            <h3>A break with your crew</h3>
            <p>
              Start a run, share the invite with colleagues, and get everyone’s
              choices in one place.
            </p>
            <span>
              Host your lunch run <ArrowRight size={16} />
            </span>
          </button>
          <button className="occasionCard neighbour" onClick={onSignIn}>
            <span className="occasionIcon">
              <Users size={25} />
            </span>
            <h3>More than a pickup</h3>
            <p>
              Want company? Look for an optional shared-meal invitation and say
              hello in the group chat.
            </p>
            <span>
              Meet over a meal <ArrowRight size={16} />
            </span>
          </button>
        </div>
      </section>
      <div className="landingNote">
        <MessageCircle size={19} />
        <p>
          Join first, decide together. Your group chat opens as soon as you join
          a run. Save your food items before the host’s cutoff.
        </p>
        <button onClick={onSignIn}>
          Get started <ArrowRight size={16} />
        </button>
      </div>
      <p className="fine pilotNote">
        Community pilot in Singapore. Hosts arrange restaurant orders and public
        collection. Bitez does not collect payments or deliver food.
      </p>
    </section>
  );
}
