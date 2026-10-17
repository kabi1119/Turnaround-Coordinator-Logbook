import { Plane } from 'lucide-react';

/** Decorative only: no flight data, timers, JS animation loop or pointer targets. */
export default function Radar() {
  return (
    <div className="flight-visual" aria-hidden="true">
      <svg className="east-asia-map" viewBox="0 0 600 400" focusable="false">
        <g className="map-land">
          <path
            data-region="china"
            d="M25 15H325L356 43 355 62 338 75 335 97 318 108 330 121 320 144 315 164 300 186 294 208 276 228 252 244 231 251 220 260 196 263 178 278 154 282 143 297 124 299 111 283 91 280 64 257 25 252Z"
          />
          <path
            data-region="korea"
            d="M357 64 369 73 374 94 384 109 383 126 374 144 359 143 352 130 358 118 350 100 346 86Z"
          />
          <path
            data-region="japan"
            d="M488 33 506 39 518 55 501 68 480 62 472 52ZM480 76 486 91 471 117 452 136 436 145 423 158 404 163 395 155 413 147 424 130 443 121 458 102 465 82ZM401 171 422 167 429 174 414 182 397 181ZM383 169 394 181 386 199 371 204 365 190 373 174Z"
          />
          <path data-region="taiwan" d="M305 229 311 240 307 258 296 276 290 267 293 247Z" />
          <path
            data-region="philippines"
            d="M313 315 329 311 340 326 335 341 344 355 331 362 319 348 307 340Z M337 372 346 368 353 380 343 386Z"
          />
          <path
            data-region="vietnam"
            d="M123 300 143 297 153 313 147 328 154 346 168 360 163 374 147 361 133 340 125 323Z"
          />
          <path d="M193 285 205 290 205 300 194 307 185 299Z" />
        </g>
        <g className="map-labels">
          <text x="195" y="133">
            EAST ASIA
          </text>
          <text x="435" y="240">
            WESTERN PACIFIC
          </text>
          <text x="239" y="281">
            HONG KONG
          </text>
        </g>
        <circle className="map-hkg" cx="220" cy="260" r="4" />
      </svg>
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
      <span className="radar-caption">TCO Logbook / EAST ASIA</span>
      <span className="coordinate">22°18′N &nbsp; 113°55′E</span>
    </div>
  );
}
