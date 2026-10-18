import { Plane } from 'lucide-react';
import { useEffect, useRef, type CSSProperties } from 'react';
import geography from '../data/radar-geography.json';
import { HKG_POINT, RADAR_RADIUS, RADAR_SIZE } from '../lib/radarProjection';

/** Decorative only: no flight data, timers, JS animation loop or pointer targets. */
export default function Radar({ active = true }: { active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => {
      if (ref.current) ref.current.dataset.documentHidden = String(document.hidden);
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return (
    <div
      ref={ref}
      className="flight-visual"
      aria-hidden="true"
      data-active={active}
      style={
        {
          '--radar-x': `${(HKG_POINT[0] / RADAR_SIZE) * 100}%`,
          '--radar-y': `${(HKG_POINT[1] / RADAR_SIZE) * 100}%`,
          '--radar-diameter': `${((RADAR_RADIUS * 2) / RADAR_SIZE) * 100}%`,
        } as CSSProperties
      }
    >
      <svg className="east-asia-map" viewBox="0 0 600 600" focusable="false">
        <path className="map-land" fillRule="evenodd" d={geography.land} />
        <path className="map-coastline" d={geography.coastline} />
        <circle className="map-hkg" cx={HKG_POINT[0]} cy={HKG_POINT[1]} r="3" />
      </svg>
      <div className="radar-scan-viewport">
        <div className="radar-sweep">
          <div className="radar-trail" />
          <div className="radar-beam" />
        </div>
      </div>
      <div className="radar-disc">
        <div className="radar-grid" />
        <div className="radar-ring ring-one" />
        <div className="radar-ring ring-two" />
        <div className="radar-ring ring-three" />
        <div className="radar-axis" />
        <div className="radar-hub" />
        <Plane className="hero-plane" size={96} strokeWidth={1} />
        <span className="radar-airport-label">HKG / VHHH</span>
      </div>
      <span className="coordinate">22°18′N &nbsp; 113°55′E</span>
    </div>
  );
}
