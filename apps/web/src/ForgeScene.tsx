type ForgeSceneProps = {
  motionEnabled: boolean;
  reducedMotion: boolean;
  onMotionToggle: () => void;
};

export default function ForgeScene({
  motionEnabled,
  reducedMotion,
  onMotionToggle,
}: ForgeSceneProps) {
  return (
    <figure className="forge-scene" data-motion={motionEnabled ? "running" : "paused"}>
      <div className="scene-heading">
        <span className="crosshair" /> THE FORGE <span>FIG. 001</span>
      </div>
      <svg
        className="forge-art"
        viewBox="0 0 640 560"
        fill="none"
        role="img"
        aria-labelledby="forge-art-title forge-art-description"
      >
        <title id="forge-art-title">The forge: a layered architectural concept</title>
        <desc id="forge-art-description">
          An original isometric illustration of connected layers. This is decorative
          architecture, not live runners or job activity.
        </desc>
        <defs>
          <linearGradient
            id="forge-face"
            x1="145"
            y1="210"
            x2="505"
            y2="360"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#26302a" />
            <stop offset="0.55" stopColor="#111b16" />
            <stop offset="1" stopColor="#141a16" />
          </linearGradient>
          <linearGradient
            id="forge-top"
            x1="160"
            y1="100"
            x2="400"
            y2="310"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#29352b" />
            <stop offset="0.5" stopColor="#1a241c" />
            <stop offset="1" stopColor="#101812" />
          </linearGradient>
          <linearGradient
            id="forge-side"
            x1="150"
            y1="280"
            x2="490"
            y2="360"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#101510" />
            <stop offset="0.55" stopColor="#263520" />
            <stop offset="1" stopColor="#10170f" />
          </linearGradient>
          <linearGradient
            id="forge-core"
            x1="272"
            y1="177"
            x2="367"
            y2="244"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#e5ffd0" />
            <stop offset="0.5" stopColor="#c5f78b" />
            <stop offset="1" stopColor="#91ca55" />
          </linearGradient>
          <linearGradient
            id="forge-beam"
            x1="320"
            y1="38"
            x2="320"
            y2="214"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#c5f78b" stopOpacity="0" />
            <stop offset="1" stopColor="#c5f78b" stopOpacity="0.13" />
          </linearGradient>
          <radialGradient id="forge-floor-glow">
            <stop stopColor="#a5ef6a" stopOpacity="0.14" />
            <stop offset="1" stopColor="#a5ef6a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="320" cy="412" rx="260" ry="112" fill="url(#forge-floor-glow)" />
        <g
          className="scene-grid"
          stroke="#82967d"
          strokeOpacity="0.13"
          strokeWidth="0.8"
        >
          {[-2, -1, 0, 1, 2].map((offset) => (
            <g key={offset}>
              <path d={`M${60 + offset * 40} ${364 + offset * 23}l320 184`} />
              <path
                d={`M${580 - offset * 40} ${364 + offset * 23}L${260 - offset * 40} ${548 + offset * 23}`}
              />
            </g>
          ))}
          <path d="M320 264 592 421 320 578 48 421Z" />
          <path d="M320 309 514 421 320 533 126 421Z" />
        </g>
        <g stroke="#b9caae" strokeWidth="0.8" strokeOpacity="0.17">
          <path d="M320 49V493" strokeDasharray="2 7" />
          <ellipse
            cx="320"
            cy="322"
            rx="272"
            ry="153"
            strokeDasharray="2 7"
            transform="rotate(-12 320 322)"
          />
          <path d="M71 223v-26h26M569 435v26h-26" />
        </g>
        <g className="floating-layer layer-bottom">
          <path
            d="m135 321 185-107 185 107v17L320 446 135 338Z"
            fill="url(#forge-face)"
            stroke="#3b4935"
          />
          <path
            d="m135 321 185 108 185-108v17L320 446 135 338Z"
            fill="url(#forge-side)"
            stroke="#3b4935"
          />
          <path d="m320 214 185 107-185 108-185-108Z" fill="#101611" stroke="#58664d" />
          <path d="m320 238 144 83-144 84-144-84Z" stroke="#3c4b34" />
          <path d="m218 321 102 59 102-59M320 429v17" stroke="#759062" />
          <path d="m151 338 65 38" stroke="#b3e880" strokeWidth="2" />
          <path
            d="m448 368 35-20"
            stroke="#819277"
            strokeWidth="2"
            strokeDasharray="3 5"
          />
        </g>
        <g
          className="layer-connectors"
          stroke="#bff28a"
          strokeOpacity="0.4"
          strokeDasharray="3 6"
        >
          <path d="M176 228v84M464 228v84M320 312v85" />
        </g>
        <g className="floating-layer layer-middle">
          <path
            d="m135 266 185-107 185 107v15L320 389 135 281Z"
            fill="url(#forge-side)"
            stroke="#57674a"
          />
          <path
            d="m320 159 185 107-185 108-185-108Z"
            fill="url(#forge-face)"
            stroke="#697b59"
          />
          <path
            d="m320 183 144 83-144 84-144-84Z"
            stroke="#849870"
            strokeOpacity="0.5"
          />
          <path d="m229 266 91-52 91 52-91 53Z" stroke="#bdf385" strokeOpacity="0.7" />
          <path
            d="m190 266 53 31m206-31-52 31M320 337v-30"
            stroke="#c6f690"
            strokeWidth="1.5"
          />
          <path d="m150 280 85 49" stroke="#c2f68a" strokeWidth="2" />
          <path
            d="m415 327 68-39"
            stroke="#d0e2b8"
            strokeDasharray="2 7"
            strokeWidth="2"
          />
        </g>
        <g className="floating-layer layer-top">
          <path
            d="m135 211 185-107 185 107v15L320 334 135 226Z"
            fill="url(#forge-side)"
            stroke="#879b6e"
          />
          <path
            d="m320 104 185 107-185 108-185-108Z"
            fill="url(#forge-top)"
            stroke="#b6d68f"
            strokeWidth="1.2"
          />
          <path d="m320 126 147 85-147 86-147-86Z" stroke="#6a8156" strokeWidth="0.8" />
          <g stroke="#8baa64" strokeWidth="1" strokeLinejoin="round">
            <path d="m320 144-35 21v28M449 211l-35 20h-40M320 278l35-20v-23M190 211l35-20h40" />
            <path d="m239 165 26 15M400 165l-26 15M400 257l-27-15M239 257l26-15" />
            <path d="m214 224 24 14h30M426 198l-24-14h-30" />
          </g>
          <g
            className="circuit-flow"
            stroke="#d6ffac"
            strokeWidth="1.5"
            strokeDasharray="12 90"
          >
            <path d="m320 144-35 21v28M449 211l-35 20h-40M320 278l35-20v-23M190 211l35-20h40" />
          </g>
          <path
            d="m320 160 87 51-87 51-87-51Z"
            fill="#91cf54"
            fillOpacity="0.05"
            stroke="#a4c779"
            strokeOpacity="0.5"
          />
          <path
            d="m320 171 69 40-69 40-69-40Z"
            fill="#0b120b"
            stroke="#d1f4a7"
            strokeWidth="1.2"
          />
          <path d="m272 182 43 25v24l-43-25Zm53 31 43-25v24l-43 25Z" fill="#648839" />
          <g fill="url(#forge-core)" stroke="#edffd6" strokeWidth="0.5">
            <path d="m293 173 22 13-22 13-22-13Z" />
            <path d="m324 191 22 13-22 13-22-13Z" />
            <path d="m324 155 22 13-22 13-22-13Z" />
            <path d="m355 173 22 13-22 13-22-13Z" />
          </g>
          <g fill="#c5f78b">
            <circle cx="320" cy="144" r="2.5" />
            <circle cx="449" cy="211" r="2.5" />
            <circle cx="320" cy="278" r="2.5" />
            <circle cx="190" cy="211" r="2.5" />
          </g>
          <path d="m282 188 38 22 38-22V35h-76Z" fill="url(#forge-beam)" />
          <path d="m151 228 68 39" stroke="#dcffb7" strokeWidth="2" />
          <path
            d="m450 257 33-19"
            stroke="#e4f5d2"
            strokeDasharray="2 6"
            strokeWidth="2"
          />
        </g>

        <g className="scene-annotations" stroke="#839477" strokeWidth="0.7">
          <path d="M133 211H76l-18-18H12" />
          <circle cx="133" cy="211" r="3" fill="#c5f78b" stroke="none" />
          <path d="m499 284 42 24h70" />
          <circle cx="499" cy="284" r="3" fill="#a3b894" stroke="none" />
          <path d="m322 446 47 27h93" />
          <circle cx="322" cy="446" r="3" fill="#a3b894" stroke="none" />
        </g>
        <g
          className="scene-svg-labels"
          fill="#9baa90"
          fontSize="10"
          letterSpacing="1.5"
        >
          <text x="12" y="180">
            01 / INTERFACE
          </text>
          <text x="529" y="330">
            02 / API
          </text>
          <text x="380" y="494">
            03 / STATE
          </text>
          <text x="458" y="115" fill="#c5f78b" fontSize="9">
            PURE POSSIBILITY.
          </text>
          <text x="458" y="130" fontSize="9">
            ZERO EXECUTION.
          </text>
        </g>
      </svg>
      <figcaption className="scene-caption">
        <span>
          Architectural concept.
          <br />
          Not live runner activity.
        </span>
        <button
          type="button"
          className="motion-control"
          onClick={onMotionToggle}
          disabled={reducedMotion}
          aria-label={
            reducedMotion
              ? "System reduced motion enabled"
              : motionEnabled
                ? "Pause illustration"
                : "Play illustration"
          }
        >
          <span
            className={motionEnabled ? "pause-symbol" : "play-symbol"}
            aria-hidden="true"
          />
          {reducedMotion ? "REDUCED MOTION" : `MOTION ${motionEnabled ? "ON" : "OFF"}`}
        </button>
      </figcaption>
    </figure>
  );
}
