import { useId, type CSSProperties, type ReactNode } from "react";

/**
 * The study buddy: a blue droplet with a curled tuft, drawn on a 200×256 canvas (feet at y=240).
 * Each mood is one SVG animated with CSS keyframes (the `bd-*` rules in globals.css), which stop
 * under prefers-reduced-motion. Animated parts set their own transform-origin in canvas units.
 */
export const MASCOT = {
  ink: "#14224A",
  yellow: "#FFC93C",
  orange: "#FF6B1A",
  cream: "#F5F1E8",
  green: "#3CC85F",
  light: "#B4F0FF",
  mid: "#4FC7F6",
  deep: "#1494DC",
  edge: "#0A5F9E",
};

export type Mood = "wave" | "study" | "play" | "celebrate" | "run" | "think" | "zen";

const BODY =
  "M86 196 C84 182 82 170 72 156 C58 136 42 122 42 100 C42 68 68 42 100 42 C132 42 158 68 158 100 C158 122 142 136 128 156 C118 170 116 182 114 196 Q114 200 110 200 H90 Q86 200 86 196 Z";
const TUFT = "M91 47 C91 34 100 26 112 24 C124 22 137 22 143 28 C149 35 142 43 134 42 C124 41 116 42 110 49 Z";

const origin = (x: number, y: number) => ({ transformOrigin: `${x}px ${y}px` });

/**
 * A limb: a thick round-capped stroke in the body gradient. `front` adds a faint darker edge, so an arm
 * crossing the body (same colour) stays readable.
 */
function Limb({ d, fill, front = false, className, style }: { d: string; fill: string; front?: boolean; className?: string; style?: CSSProperties }) {
  const stroke = { strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;
  return (
    <g className={className} style={style}>
      {front && <path d={d} stroke={MASCOT.edge} strokeWidth={11} opacity={0.4} {...stroke} />}
      <path d={d} stroke={fill} strokeWidth={7.5} {...stroke} />
    </g>
  );
}

function Eyes({ look = [0, 0], pupilsClass, closed = false }: { look?: [number, number]; pupilsClass?: string; closed?: boolean }) {
  const { ink } = MASCOT;
  if (closed) {
    return <path d="M78 99 Q86 105 94 99 M106 99 Q114 105 122 99" stroke={ink} strokeWidth={3.2} strokeLinecap="round" fill="none" />;
  }
  return (
    <g className="bd-blink" style={origin(100, 98)}>
      <circle cx={86} cy={98} r={12} fill="#fff" />
      <circle cx={114} cy={98} r={12} fill="#fff" />
      <g transform={`translate(${look[0]} ${look[1]})`}>
        <g className={pupilsClass}>
          <circle cx={86} cy={98} r={8.5} fill={ink} />
          <circle cx={114} cy={98} r={8.5} fill={ink} />
          <circle cx={89} cy={95} r={2.4} fill="#fff" />
          <circle cx={117} cy={95} r={2.4} fill="#fff" />
        </g>
      </g>
    </g>
  );
}

function Brows({ d = "M78 79 Q86 75 94 79 M106 79 Q114 75 122 79" }: { d?: string }) {
  return <path d={d} stroke={MASCOT.ink} strokeWidth={3.2} strokeLinecap="round" fill="none" />;
}

const SMILE = "M84 118 Q100 132 116 118";

function Mouth({ d = SMILE, open = false }: { d?: string; open?: boolean }) {
  const { ink } = MASCOT;
  if (open) {
    return (
      <g>
        <path d="M83 116 Q100 141 117 116 Z" fill={ink} strokeLinejoin="round" />
        <path d="M91 128 Q100 135 109 128 Q100 131 91 128 Z" fill="#FF8FA3" />
      </g>
    );
  }
  return <path d={d} stroke={ink} strokeWidth={3.4} strokeLinecap="round" fill="none" />;
}

/** Head, tuft and tapered body in one gradient, with an optional soft highlight. */
function Body({ fill }: { fill: string }) {
  return (
    <>
      <path d={BODY} fill={fill} />
      <path d={TUFT} fill={fill} />
      <ellipse cx={74} cy={70} rx={13} ry={7} fill="#fff" opacity={0.35} transform="rotate(-38 74 70)" />
    </>
  );
}

function Shadow({ className, style }: { className?: string; style?: CSSProperties }) {
  return <ellipse cx={100} cy={247} rx={32} ry={5} fill={MASCOT.deep} opacity={0.22} className={className} style={style} />;
}

function Legs({ fill }: { fill: string }) {
  return (
    <>
      <Limb d="M93 198 V240 H87" fill={fill} />
      <Limb d="M107 198 V240 H113" fill={fill} />
    </>
  );
}

function Cap() {
  const { ink, yellow } = MASCOT;
  return (
    <g transform="rotate(-14 76 40)">
      <path d="M62 44 V53 Q76 60 90 53 V44 Z" fill={ink} />
      <path d="M48 41 L76 29 L104 41 L76 53 Z" fill={ink} />
      <path d="M76 41 L52 47 V58" stroke={yellow} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <rect x={49} y={56} width={6} height={9} rx={2} fill={yellow} />
    </g>
  );
}

function Sparkle({ x, y, s, className, delay = 0 }: { x: number; y: number; s: number; className?: string; delay?: number }) {
  return (
    <path
      d={`M${x} ${y - s} Q${x + s * 0.12} ${y - s * 0.12} ${x + s} ${y} Q${x + s * 0.12} ${y + s * 0.12} ${x} ${y + s} Q${x - s * 0.12} ${y + s * 0.12} ${x - s} ${y} Q${x - s * 0.12} ${y - s * 0.12} ${x} ${y - s} Z`}
      fill={MASCOT.yellow}
      className={className}
      style={{ ...origin(x, y), animationDelay: `${delay}ms` }}
    />
  );
}

// ---------------------------------------------------------------------------
// Moods
// ---------------------------------------------------------------------------

function Wave({ fill }: { fill: string }) {
  return (
    <>
      <Shadow className="bd-shadow-bob" style={origin(100, 247)} />
      <g className="bd-bob">
        <Limb d="M124 158 Q133 176 131 196" fill={fill} />
        <Legs fill={fill} />
        <Body fill={fill} />
        <Brows />
        <Eyes pupilsClass="bd-look" />
        <Mouth />
        <Limb d="M77 160 Q47 158 33 124" fill={fill} front className="bd-wave" style={origin(77, 160)} />
      </g>
    </>
  );
}

function Study({ fill }: { fill: string }) {
  const { ink, yellow } = MASCOT;
  return (
    <>
      <Shadow />
      <g className="bd-sway" style={origin(100, 244)}>
        <Legs fill={fill} />
        <Body fill={fill} />
        <Brows d="M78 80 Q86 77 94 80 M106 80 Q114 77 122 80" />
        <Eyes pupilsClass="bd-read" />
        {/* Round glasses */}
        <g stroke={ink} strokeWidth={2.6} fill="#fff" fillOpacity={0.12}>
          <circle cx={86} cy={98} r={15} />
          <circle cx={114} cy={98} r={15} />
        </g>
        <Mouth d="M93 125 Q100 128 107 125" />
        {/* Open book with a page that turns */}
        <path d="M58 152 L100 160 L142 152 V188 L100 196 L58 188 Z" fill={yellow} stroke={ink} strokeWidth={2.4} strokeLinejoin="round" />
        <path d="M100 160 V196 M66 164 L90 168 M66 172 L90 176 M66 180 L84 183 M110 168 L134 164 M110 176 L134 172" stroke={ink} strokeWidth={1.8} strokeLinecap="round" />
        <path
          d="M100 160 L141 152.5 V187.5 L100 195.5 Z"
          fill="#FFE39A"
          stroke={ink}
          strokeWidth={2}
          strokeLinejoin="round"
          className="bd-flip"
          style={origin(100, 176)}
        />
        <Limb d="M77 158 Q64 164 60 170" fill={fill} front />
        <Limb d="M123 158 Q136 164 140 170" fill={fill} front />
      </g>
    </>
  );
}

function Play({ fill }: { fill: string }) {
  const { ink } = MASCOT;
  return (
    <>
      <Shadow />
      <g className="bd-play-hop">
        <Limb d="M77 158 Q60 162 53 149" fill={fill} />
        <Limb d="M123 158 Q140 165 147 156" fill={fill} front />
        <Limb d="M93 198 V240 H87" fill={fill} />
        <Body fill={fill} />
        <Brows d="M78 78 Q86 73 94 78 M106 78 Q114 73 122 78" />
        <Eyes look={[3, 0]} pupilsClass="bd-follow" />
        <Mouth open />
        <Limb d="M107 198 V240 H114" fill={fill} className="bd-kick" style={origin(107, 198)} />
      </g>
      {/* Football, juggled off the right foot */}
      <g className="bd-ball">
        <g transform="translate(5 12)">
          <circle cx={127} cy={219} r={10} fill="#fff" stroke={ink} strokeWidth={2} />
          <path d="M127 214.5 L131.3 217.6 L129.6 222.6 H124.4 L122.7 217.6 Z" fill={ink} />
          <path d="M127 209 V214.5 M131.3 217.6 L136.5 216 M129.6 222.6 L132.5 227 M124.4 222.6 L121.5 227 M122.7 217.6 L117.5 216" stroke={ink} strokeWidth={1.4} />
        </g>
      </g>
    </>
  );
}

function Celebrate({ fill, cap }: { fill: string; cap: boolean }) {
  const { ink } = MASCOT;
  return (
    <>
      <Shadow className="bd-jump-shadow" style={origin(100, 247)} />
      <g className="bd-burst" stroke={ink} strokeWidth={3} strokeLinecap="round" style={origin(100, 60)}>
        <path d="M52 52 L42 44" />
        <path d="M72 22 L68 10" />
        <path d="M152 50 L163 43" />
      </g>
      <g className="bd-jump" style={origin(100, 244)}>
        <Limb d="M93 198 L88 238 H81" fill={fill} />
        <Limb d="M107 198 L112 238 H119" fill={fill} />
        <Body fill={fill} />
        <Limb d="M78 160 Q50 152 33 121" fill={fill} front />
        <Limb d="M122 160 Q150 152 167 121" fill={fill} front />
        <Brows d="M78 77 Q86 72 94 77 M106 77 Q114 72 122 77" />
        <Eyes look={[0, -1.5]} />
        <Mouth open />
        {cap && <Cap />}
      </g>
    </>
  );
}

function Run({ fill }: { fill: string }) {
  const { mid } = MASCOT;
  return (
    <>
      <Shadow className="bd-shadow-run" style={origin(100, 247)} />
      <g stroke={mid} strokeWidth={4} strokeLinecap="round">
        <path d="M18 116 H40" className="bd-speed" />
        <path d="M10 138 H36" className="bd-speed" style={{ animationDelay: "-0.2s" }} />
        <path d="M18 160 H38" className="bd-speed" style={{ animationDelay: "-0.4s" }} />
      </g>
      <g className="bd-run-bob">
        <g transform="rotate(7 100 244)">
          <Limb d="M77 158 Q66 172 71 188" fill={fill} className="bd-swing" style={origin(77, 158)} />
          <Limb d="M93 198 V238 H101" fill={fill} className="bd-swing bd-swing-late" style={origin(93, 198)} />
          <Body fill={fill} />
          <Brows d="M80 80 Q88 77 96 81 M108 81 Q116 77 124 80" />
          <Eyes look={[3.5, 0]} />
          <Mouth d="M88 119 Q102 130 116 118" />
          <Limb d="M107 198 V238 H115" fill={fill} className="bd-swing" style={origin(107, 198)} />
          <Limb d="M123 158 Q134 172 129 188" fill={fill} front className="bd-swing bd-swing-late" style={origin(123, 158)} />
        </g>
      </g>
    </>
  );
}

function BulbProp() {
  const { ink, yellow, cream, orange } = MASCOT;
  return (
    <>
      <circle cx={58} cy={52} r={2.6} fill={MASCOT.mid} />
      <circle cx={49} cy={41} r={3.6} fill={MASCOT.mid} />
      <g className="bd-bulb" style={origin(30, 22)}>
        <path d="M13 6 L9 2 M30 0 V-5 M47 6 L51 2" stroke={yellow} strokeWidth={3} strokeLinecap="round" className="bd-rays" />
        <path d="M30 6 C21 6 16 12 16 19 C16 24 19 27 22 31 H38 C41 27 44 24 44 19 C44 12 39 6 30 6 Z" fill={yellow} stroke={ink} strokeWidth={2.2} />
        <rect x={23} y={31} width={14} height={8} rx={2} fill={cream} stroke={ink} strokeWidth={2.2} />
        <path d="M25 19 Q30 14 35 19" stroke={orange} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      </g>
    </>
  );
}

function Think({ fill, bulb }: { fill: string; bulb: boolean }) {
  return (
    <>
      <Shadow />
      {bulb && <BulbProp />}
      <g className="bd-tilt" style={origin(100, 244)}>
        <Limb d="M77 158 Q68 176 71 194" fill={fill} />
        <Legs fill={fill} />
        <Body fill={fill} />
        <Brows d="M78 75 Q86 69 94 75 M106 80 Q114 78 122 80" />
        <Eyes look={[-3, -4]} />
        <Mouth d="M94 124 Q101 121 108 124" />
        <Limb d="M123 162 Q151 156 129 134" fill={fill} front />
      </g>
    </>
  );
}

function Zen({ fill }: { fill: string }) {
  return (
    <>
      <Shadow className="bd-float-shadow" style={origin(100, 247)} />
      <Sparkle x={34} y={70} s={8} className="bd-twinkle" />
      <Sparkle x={168} y={58} s={6} className="bd-twinkle" delay={700} />
      <Sparkle x={160} y={150} s={5} className="bd-twinkle" delay={1400} />
      <g className="bd-float">
        <Limb d="M93 196 Q78 210 64 204" fill={fill} />
        <Limb d="M107 196 Q122 210 136 204" fill={fill} />
        <Limb d="M66 210 Q100 222 134 210" fill={fill} />
        <Body fill={fill} />
        <Brows d="M78 81 Q86 78 94 81 M106 81 Q114 78 122 81" />
        <Eyes closed />
        <Mouth d="M90 120 Q100 128 110 120" />
        <Limb d="M77 158 Q58 178 63 202" fill={fill} front />
        <Limb d="M123 158 Q142 178 137 202" fill={fill} front />
      </g>
    </>
  );
}

export function Mascot({
  mood = "wave",
  width = 160,
  cap = false,
  bulb = true,
  className,
  label,
}: {
  mood?: Mood;
  /** Width in px; height follows the 200×256 canvas. */
  width?: number;
  /** Graduation cap (celebrate only). */
  cap?: boolean;
  /** Thought lightbulb (think only). */
  bulb?: boolean;
  className?: string;
  /** Accessible description; the mascot is decorative without one. */
  label?: string;
}) {
  const id = `bd${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const fill = `url(#${id})`;
  const { light, mid, deep } = MASCOT;
  const moods: Record<Mood, ReactNode> = {
    wave: <Wave fill={fill} />,
    study: <Study fill={fill} />,
    play: <Play fill={fill} />,
    celebrate: <Celebrate fill={fill} cap={cap} />,
    run: <Run fill={fill} />,
    think: <Think fill={fill} bulb={bulb} />,
    zen: <Zen fill={fill} />,
  };
  return (
    <svg
      width={width}
      height={(width * 256) / 200}
      viewBox="0 0 200 256"
      overflow="visible"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        {/* User-space gradient so the head, tuft and limbs shade as one form, lit from the upper left. */}
        <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={92} cy={88} r={130}>
          <stop offset="0" stopColor={light} />
          <stop offset="0.36" stopColor={mid} />
          <stop offset="1" stopColor={deep} />
        </radialGradient>
      </defs>
      {moods[mood]}
    </svg>
  );
}

export type PropKind = "book" | "pencil" | "checklist" | "grade" | "sparkle" | "bulb";

/** Small flat stickers (book, pencil, grade…) that float around the page, on a 48×48 canvas. */
export function Sticker({ kind, size = 48, className }: { kind: PropKind; size?: number; className?: string }) {
  const { ink, yellow, orange, green, cream } = MASCOT;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      {kind === "book" && (
        <>
          <path d="M3 12 L24 16 L45 12 V38 L24 42 L3 38 Z" fill={yellow} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
          <path d="M24 16 V42 M8 20 L19 22 M8 26 L19 28 M8 32 L19 34 M29 22 L40 20 M29 28 L40 26" stroke={ink} strokeWidth={1.5} strokeLinecap="round" />
        </>
      )}
      {kind === "pencil" && (
        <>
          <path d="M12 32 L32 8 L40 15 L20 39 Z" fill={orange} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
          <path d="M12 32 L20 39 L9 43 Z" fill={cream} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
          <path d="M9 43 L10.5 38.5 L13.5 41 Z" fill={ink} />
          <path d="M32 8 L35 4.5 L43 11.5 L40 15 Z" fill={yellow} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
        </>
      )}
      {kind === "checklist" && (
        <>
          <rect x={8} y={5} width={32} height={39} rx={4} fill="#fff" stroke={ink} strokeWidth={2} />
          {[14, 24, 34].map((y) => (
            <path key={y} d={`M13 ${y} L16 ${y + 3} L21 ${y - 3}`} stroke={green} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
          <path d="M25 14 H35 M25 24 H35 M25 34 H32" stroke={ink} strokeWidth={1.8} strokeLinecap="round" />
        </>
      )}
      {kind === "grade" && (
        <>
          <circle cx={24} cy={24} r={19} fill={yellow} stroke={ink} strokeWidth={2} />
          <text x={24} y={31} fontSize={19} fontWeight={800} fill={ink} textAnchor="middle" fontFamily="system-ui, sans-serif">
            A+
          </text>
        </>
      )}
      {kind === "sparkle" && <path d="M24 4 Q26.5 21.5 44 24 Q26.5 26.5 24 44 Q21.5 26.5 4 24 Q21.5 21.5 24 4 Z" fill={yellow} />}
      {kind === "bulb" && (
        <>
          <path d="M24 6 C14 6 9 13 9 20 C9 26 13 29 16 33 H32 C35 29 39 26 39 20 C39 13 34 6 24 6 Z" fill={yellow} stroke={ink} strokeWidth={2} />
          <rect x={17} y={33} width={14} height={8} rx={2} fill={cream} stroke={ink} strokeWidth={2} />
          <path d="M19 20 Q24 14 29 20" stroke={orange} strokeWidth={2} fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
