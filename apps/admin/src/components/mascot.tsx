/** Web version of the learner app's green cat mascot (same 200×140 drawing), with CSS idle motion. */
const INK = "#17171F";
const BODY = "#3CC85F";
const YELLOW = "#FFC93C";

type Accessory = "cap" | "glasses" | "book";

export function Mascot({ width = 160, accessories = [], className = "" }: { width?: number; accessories?: Accessory[]; className?: string }) {
  const has = (a: Accessory) => accessories.includes(a);
  return (
    <svg width={width} height={(width * 140) / 200} viewBox="0 0 200 140" className={className} aria-hidden="true">
      <path className="mascot-tail" d="M124 116 H185 A9 9 0 0 1 185 134 H124 Z" fill={BODY} />
      <g className="mascot-body">
        <path
          d="M16 134 C18 108 30 74 46 50 C49 45 51 40 52 34 L55 15 Q56 9 61 12 L73 25 Q83 22 93 25 L105 12 Q110 9 111 15 L114 34 C115 40 117 45 120 50 C134 74 137 108 139 134 Z"
          fill={BODY}
        />
        <path d="M73 113 Q75 124 70 134 M92 115 Q90 125 95 134" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        <g className="mascot-eyes">
          <circle cx={94} cy={56} r={13} fill="#fff" stroke={INK} strokeWidth={2.5} />
          <circle cx={70} cy={56} r={13} fill="#fff" stroke={INK} strokeWidth={2.5} />
          <circle cx={72} cy={56} r={6.5} fill={INK} />
          <circle cx={96} cy={56} r={6.5} fill={INK} />
          <circle cx={74.2} cy={53.8} r={1.8} fill="#fff" />
          <circle cx={98.2} cy={53.8} r={1.8} fill="#fff" />
        </g>
        {has("glasses") && (
          <g stroke={INK} strokeWidth={3} fill="none">
            <circle cx={70} cy={56} r={16} />
            <circle cx={94} cy={56} r={16} />
            <path d="M54 54 L46 50 M110 54 L118 50" strokeLinecap="round" />
          </g>
        )}
        {has("book") && (
          <g>
            <path d="M54 92 L82 98 L110 92 V120 L82 126 L54 120 Z" fill={YELLOW} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
            <path d="M82 98 V126 M60 101 L76 104 M60 107 L76 110 M88 104 L104 101 M88 110 L104 107" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
            <circle cx={54} cy={106} r={6} fill={BODY} />
            <circle cx={110} cy={106} r={6} fill={BODY} />
          </g>
        )}
        {has("cap") && (
          <g>
            <path d="M68 19 V30 Q82 37 96 30 V19 Z" fill={INK} />
            <path d="M56 17 L82 6 L108 17 L82 28 Z" fill={INK} />
            <path d="M82 17 L104 21 V32" stroke={YELLOW} strokeWidth={2} fill="none" strokeLinecap="round" />
            <rect x={101} y={31} width={6} height={8} rx={2} fill={YELLOW} />
          </g>
        )}
      </g>
    </svg>
  );
}
