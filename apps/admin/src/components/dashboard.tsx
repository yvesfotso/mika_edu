import type { ReactNode } from "react";
import { TrendDownIcon, TrendUpIcon } from "./icons";

/** "+2.6%" style change pill. `value` is a percentage-point or percent change; null hides it. */
export function Delta({
  value,
  suffix = "%",
  inverted = false,
}: {
  value: number | null;
  suffix?: string;
  inverted?: boolean;
}) {
  if (value === null || !Number.isFinite(value)) return null;
  const up = value >= 0;
  const good = inverted ? !up : up;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
        good
          ? "bg-brand-soft text-brand-strong"
          : "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300"
      }`}
    >
      {up ? <TrendUpIcon size={12} /> : <TrendDownIcon size={12} />}
      {up ? "+" : "−"}
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}

export function Widget({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-4xl bg-card p-5 md:p-6 ${className}`}>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ dot matrix */

const DOT_LEVELS = [
  "bg-ocean-soft",
  "bg-ocean-mute",
  "bg-ocean",
  "bg-ocean-strong",
];

/** One column per day; the column height is how many learners studied, the shade is total time. */
export function DotMatrix({
  days,
  rows = 7,
}: {
  days: { date: string; learners: number; seconds: number }[];
  rows?: number;
}) {
  const maxLearners = Math.max(1, ...days.map((d) => d.learners));
  const maxSeconds = Math.max(1, ...days.map((d) => d.seconds));
  return (
    <div>
      <div
        className="flex items-end justify-between gap-[3px]"
        role="img"
        aria-label="Daily study activity for the last four weeks"
      >
        {days.map((d) => {
          const filled =
            d.learners === 0
              ? 0
              : Math.max(1, Math.round((d.learners / maxLearners) * rows));
          const level = Math.min(3, Math.floor((d.seconds / maxSeconds) * 4));
          return (
            <div
              key={d.date}
              className="flex flex-1 flex-col-reverse items-center gap-[3px]"
              title={`${d.date}: ${d.learners} learner(s), ${Math.round(d.seconds / 60)} min`}
            >
              {Array.from({ length: rows }, (_, i) => (
                <span
                  key={i}
                  className={`aspect-square w-full max-w-[11px] rounded-full ${i < filled ? DOT_LEVELS[level] : "bg-transparent"}`}
                />
              ))}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>4 weeks ago</span>
        <span className="flex items-center gap-1">
          Less
          {DOT_LEVELS.map((c) => (
            <span key={c} className={`size-2.5 rounded-[3px] ${c}`} />
          ))}
          More
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ line chart */

export function LineChart({
  points,
  min = 0,
  max = 100,
  ticks = [40, 60, 80],
  format = (v: number) => `${Math.round(v)}%`,
}: {
  points: { label: string; value: number | null }[];
  min?: number;
  max?: number;
  ticks?: number[];
  format?: (v: number) => string;
}) {
  const W = 210;
  const H = 110;
  const padL = 28;
  const x = (i: number) =>
    padL + (i * (W - padL - 8)) / Math.max(1, points.length - 1);
  const y = (v: number) => 8 + (1 - (v - min) / (max - min)) * (H - 20);
  const known = points
    .map((p, i) => ({ ...p, i }))
    .filter(
      (p): p is { label: string; value: number; i: number } => p.value !== null,
    );
  const path = known
    .map(
      (p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.value).toFixed(1)}`,
    )
    .join(" ");
  const last = known.at(-1);

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 16}`}
      className="mx-auto w-full max-w-[300px]"
      role="img"
      aria-label="Average quiz score per day"
    >
      {ticks.map((tk) => (
        <g key={tk}>
          <line
            x1={padL}
            x2={W}
            y1={y(tk)}
            y2={y(tk)}
            className="stroke-line"
            strokeDasharray="3 4"
          />
          <text x={0} y={y(tk) + 4} className="fill-muted text-[10px]">
            {format(tk)}
          </text>
        </g>
      ))}
      <path
        d={path}
        fill="none"
        className="stroke-ocean"
        strokeWidth={2.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last && (
        <g>
          <line
            x1={x(last.i)}
            x2={x(last.i)}
            y1={y(last.value)}
            y2={H}
            className="stroke-ocean-mute"
            strokeDasharray="2 3"
          />
          <circle
            cx={x(last.i)}
            cy={y(last.value)}
            r={6}
            className="fill-frame stroke-ocean"
            strokeWidth={2.5}
          />
          <rect
            x={Math.min(x(last.i), W - 23) - 22}
            y={y(last.value) + 10}
            width={44}
            height={20}
            rx={10}
            className="fill-ink"
          />
          <text
            x={Math.min(x(last.i), W - 23)}
            y={y(last.value) + 24}
            textAnchor="middle"
            className="fill-frame text-[10px] font-semibold"
          >
            {format(last.value)}
          </text>
        </g>
      )}
      {points.map((p, i) => (
        <text
          key={p.label + i}
          x={x(i)}
          y={H + 14}
          textAnchor="middle"
          className="fill-muted text-[10px]"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ gauge */

export interface GaugeSegment {
  label: string;
  value: number;
  className: string; // stroke-* class
  swatch: string; // bg-* class for the legend
}

/** Semicircle split into segments with small gaps, like a speedometer. */
export function Gauge({
  segments,
  center,
  caption,
}: {
  segments: GaugeSegment[];
  center: ReactNode;
  caption: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const R = 80;
  const cx = 100;
  const cy = 100;
  const gap = 3; // degrees
  const visible = segments.filter((s) => s.value > 0);
  const arcs = visible.map((s, i) => {
    const start =
      180 +
      (visible.slice(0, i).reduce((a, v) => a + v.value, 0) / total) * 180;
    const sweep = (s.value / total) * 180;
    const a0 = start + gap / 2;
    const a1 = start + sweep - gap / 2;
    const p = (deg: number) => [
      cx + R * Math.cos((deg * Math.PI) / 180),
      cy + R * Math.sin((deg * Math.PI) / 180),
    ];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(Math.max(a0, a1));
    return {
      ...s,
      d: `M${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`,
    };
  });

  return (
    <div className="relative mx-auto w-full max-w-[240px]">
      <svg
        viewBox="0 0 200 110"
        className="w-full"
        role="img"
        aria-label={caption}
      >
        {arcs.map((a) => (
          <path
            key={a.label}
            d={a.d}
            fill="none"
            strokeWidth={30}
            className={a.className}
          />
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="text-4xl font-medium tabular-nums text-ink">
          {center}
        </div>
        <div className="text-xs text-muted">{caption}</div>
      </div>
    </div>
  );
}

export function Legend({
  items,
}: {
  items: { label: string; value: ReactNode; swatch: string }[];
}) {
  return (
    <ul className="space-y-2.5 text-sm">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-3">
          <span className={`size-4 rounded-md ${it.swatch}`} />
          <span className="flex-1 text-ink">{it.label}</span>
          <span className="font-semibold tabular-nums text-ink">
            {it.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ result bars */

/** One pill-shaped bar per quiz, green when passed. Height tracks the score. */
export function ResultBars({
  scores,
  passMark = 50,
}: {
  scores: number[];
  passMark?: number;
}) {
  return (
    <div
      className="flex h-24 items-end gap-[5px]"
      role="img"
      aria-label={`Last ${scores.length} quiz results`}
    >
      {scores.map((s, i) => (
        <span
          key={i}
          title={`${Math.round(s)}%`}
          className={`flex-1 rounded-full ${s >= passMark ? "bg-brand" : "bg-line"}`}
          style={{ height: `${Math.max(28, s)}%` }}
        />
      ))}
    </div>
  );
}
