import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, Utensils } from "lucide-react";

const meals = [
  {
    image: "/images/shared-lunch.webp",
    name: "Lunch",
    alt: "Noodles, chicken rice and vegetables on a shared lunch table",
    title: "Your usual lunch. A new crew.",
    caption: "Find, chat, order, collect.",
  },
  {
    image: "/images/shared-breakfast.webp",
    name: "Breakfast",
    alt: "Golden roti prata, vegetable curry and two glasses of teh tarik",
    title: "A slow morning. A shared table.",
    caption: "Prata, curry and a little company.",
  },
  {
    image: "/images/shared-dinner.webp",
    name: "Dinner",
    alt: "Chicken satay with peanut sauce, rice cakes and vegetables",
    title: "Dinner plans, made together.",
    caption: "Start a run. Bring your neighbours.",
  },
];

export function FoodCarousel() {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(meals.map(() => false));
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const rotating = !paused && !reducedMotion && visible && onScreen;

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(motion.matches);
    const updateVisibility = () =>
      setVisible(document.visibilityState === "visible");
    updateMotion();
    updateVisibility();
    motion.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) =>
              setOnScreen(
                entry.isIntersecting && entry.intersectionRatio >= 0.25,
              ),
            { threshold: 0.25 },
          );
    if (ref.current) observer?.observe(ref.current);
    if (!observer) setOnScreen(true);
    return () => {
      motion.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
      observer?.disconnect();
    };
  }, []);

  const nextLoaded = (start: number, direction: number) => {
    for (let step = 1; step < meals.length; step++) {
      const index = (start + direction * step + meals.length) % meals.length;
      if (ready[index]) return index;
    }
    return start;
  };

  useEffect(() => {
    if (!rotating || ready.filter(Boolean).length < 2) return;
    const timer = window.setInterval(() => {
      setActive((current) => {
        for (let step = 1; step < meals.length; step++) {
          const index = (current + step) % meals.length;
          if (ready[index]) return index;
        }
        return current;
      });
    }, 6000);
    return () => clearInterval(timer);
  }, [rotating, ready]);

  const choose = (index: number) => {
    if (!ready[index]) return;
    setPaused(true);
    setActive(index);
  };
  const markReady = (index: number, loaded: boolean) =>
    setReady((current) =>
      current.map((value, i) => (i === index ? loaded : value)),
    );
  const meal = meals[active];

  return (
    <section
      ref={ref}
      className="heroMedia foodCarousel"
      aria-label="Meals to share"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onFocusCapture={() => setPaused(true)}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        choose(nextLoaded(active, event.key === "ArrowRight" ? 1 : -1));
      }}
    >
      {meals.map((item, index) => (
        <img
          key={item.image}
          className={`foodSlide${active === index ? " active" : ""}`}
          src={item.image}
          width="1152"
          height="768"
          alt={item.alt}
          aria-hidden={active !== index}
          loading={index === 0 ? "eager" : "lazy"}
          {...{ fetchpriority: index === 0 ? "high" : "low" }}
          decoding="async"
          onLoad={() => markReady(index, true)}
          onError={() => markReady(index, false)}
        />
      ))}
      <div className="carouselToolbar">
        <div
          className="carouselTabs"
          role="group"
          aria-label="Choose a meal image"
        >
          {meals.map((item, index) => (
            <button
              key={item.name}
              type="button"
              aria-label={`Show ${item.name.toLowerCase()} image`}
              aria-current={active === index ? "true" : undefined}
              disabled={!ready[index]}
              onClick={() => choose(index)}
            >
              {item.name}
            </button>
          ))}
        </div>
        {!reducedMotion && (
          <button
            type="button"
            className="carouselRotation"
            aria-label={paused ? "Play meal slideshow" : "Pause meal slideshow"}
            title={paused ? "Play slideshow" : "Pause slideshow"}
            onClick={() => setPaused((current) => !current)}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        )}
      </div>
      <button
        type="button"
        className="carouselArrow previous"
        aria-label="Previous meal image"
        disabled={ready.filter(Boolean).length < 2}
        onClick={() => choose(nextLoaded(active, -1))}
      >
        <ChevronLeft size={20} />
      </button>
      <button
        type="button"
        className="carouselArrow next"
        aria-label="Next meal image"
        disabled={ready.filter(Boolean).length < 2}
        onClick={() => choose(nextLoaded(active, 1))}
      >
        <ChevronRight size={20} />
      </button>
      <div
        className="foodCaption"
        aria-live={rotating ? "off" : "polite"}
        aria-atomic="true"
      >
        <span className="captionIcon">
          <Utensils size={19} />
        </span>
        <div>
          <strong>{meal.title}</strong>
          <span>{meal.caption}</span>
        </div>
      </div>
    </section>
  );
}
