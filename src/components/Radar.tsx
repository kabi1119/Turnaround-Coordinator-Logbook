import { Plane } from 'lucide-react';

/** Decorative only: no flight data, timers, JS animation loop or pointer targets. */
export default function Radar() {
  return (
    <div className="flight-visual" aria-hidden="true">
      <div className="radar-disc">
        <div className="radar-grid" />
        <div className="radar-ring ring-one" />
        <div className="radar-ring ring-two" />
        <div className="radar-ring ring-three" />
        <div className="radar-axis" />
        <div className="route-line" />
        <div className="radar-sweep">
          <div className="radar-trail" />
          <div className="radar-beam" />
        </div>
        <div className="radar-hub" />
        <Plane className="hero-plane" size={96} strokeWidth={1} />
      </div>
      <span className="visual-origin">
        HKG<span>HONG KONG / HKIA</span>
      </span>
      <span className="visual-destination">
        ∞<span>EXPERIENCE AHEAD</span>
      </span>
      <span className="radar-caption">PERSONAL LOGBOOK / DEMO RADAR</span>
      <span className="coordinate">22°18′N &nbsp; 113°55′E / DEMO</span>
    </div>
  );
}
