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
        good ? "bg-brand-soft text-brand-strong" : "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300"
      }`}
    >
      {up ? <TrendUpIcon size={12} /> : <TrendDownIcon size={12} />}
      {up ? "+" : "−"}
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}

export function Widget({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-3xl bg-card p-5 ${className}`}>{children}</section>;
}

/* ------------------------------------------------------------------ KPI tile */

const KPI_TONES = {
  lime: "bg-brand-soft text-brand-strong",
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300",
  rose: "bg-rose-100 text-rose-500 dark:bg-rose-950 dark:text-rose-300",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
};

/** Small white tile: big number, caption, and a round tinted icon — the top row of the overview. */
export function Kpi({
  value,
  label,
  icon,
  tone,
  delta,
}: {
  value: ReactNode;
  label: string;
  icon: ReactNode;
  tone: keyof typeof KPI_TONES;
  delta?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-3xl bg-card p-5">
      <div className="min-w-0">
        <div className="text-2xl font-semibold tabular-nums text-ink">{value}</div>
        <div className="mt-0.5 text-sm leading-snug text-muted">
          {label}
        </div>
        {delta && <div className="mt-2">{delta}</div>}
      </div>
      <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full ${KPI_TONES[tone]}`}>{icon}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ area chart */

type Pt = [number, number];

/** Catmull-Rom → cubic Bézier, with control points clamped so the curve never dips past the chart floor. */
function smoothPath(pts: Pt[], top: number, bottom: number) {
  if (pts.length === 0) return "";
  const clampY = (y: number) => Math.min(bottom, Math.max(top, y));
  let d = `M${pts[0]![0].toFixed(1)},${pts[0]![1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, clampY(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, clampY(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(v));
  const n = v / step;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * step;
}

const LIME_LINE = "#9DC22B";

/**
 * Two series over the same days: `current` as a lime area (the last point highlighted with a value pill)
 * and `previous` as a thin ink line for comparison.
 */
export function AreaChart({
  points,
  format,
  label,
}: {
  points: { label: string; current: number; previous: number }[];
  format: (v: number) => string;
  label: string;
}) {
  const W = 640;
  const H = 230;
  const padL = 40;
  const padR = 16;
  const top = 30;
  const bottom = H - 28;
  const max = niceMax(Math.max(...points.flatMap((p) => [p.current, p.previous])) * 1.1);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, points.length - 1);
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const cur: Pt[] = points.map((p, i) => [x(i), y(p.current)]);
  const prev: Pt[] = points.map((p, i) => [x(i), y(p.previous)]);
  const curPath = smoothPath(cur, top, bottom);
  const last = points.length - 1;
  const lastPt = cur[last];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
      <defs>
        <linearGradient id="area-lime" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--brand)" stopOpacity={0.75} />
          <stop offset="1" stopColor="var(--brand)" stopOpacity={0.12} />
        </linearGradient>
      </defs>
      {ticks.map((tk) => (
        <g key={tk}>
          <line x1={padL} x2={W - padR} y1={y(tk)} y2={y(tk)} className="stroke-line" />
          <text x={padL - 10} y={y(tk) + 4} textAnchor="end" className="fill-muted text-[11px]">
            {format(tk)}
          </text>
        </g>
      ))}
      {lastPt && <line x1={lastPt[0]} x2={lastPt[0]} y1={lastPt[1]} y2={bottom} stroke={LIME_LINE} strokeWidth={2} />}
      {curPath && <path d={`${curPath} L${x(last)},${bottom} L${x(0)},${bottom} Z`} fill="url(#area-lime)" />}
      {curPath && <path d={curPath} fill="none" stroke={LIME_LINE} strokeWidth={2.5} strokeLinecap="round" />}
      <path d={smoothPath(prev, top, bottom)} fill="none" className="stroke-ink" strokeWidth={2.2} strokeLinecap="round" />
      {lastPt && (
        <g>
          <circle cx={lastPt[0]} cy={lastPt[1]} r={6} fill="var(--card)" stroke={LIME_LINE} strokeWidth={3} />
          <rect x={Math.min(lastPt[0] - 28, W - padR - 56)} y={lastPt[1] - 34} width={56} height={22} rx={6} fill="var(--brand)" />
          <text
            x={Math.min(lastPt[0], W - padR - 28)}
            y={lastPt[1] - 19}
            textAnchor="middle"
            className="text-[11px] font-semibold"
            fill="var(--brand-ink)"
          >
            {format(points[last]!.current)}
          </text>
        </g>
      )}
      {points.map((p, i) => (
        <text key={p.label + i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted text-[11px]">
          {p.label}
        </text>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ meter */

/** Thin lime progress bar with an optional caption row above it. */
export function Meter({ value, label, right }: { value: number; label?: ReactNode; right?: ReactNode }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      {(label || right) && (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted">
          <span>{label}</span>
          <span className="font-semibold tabular-nums text-ink">{right}</span>
        </div>
      )}
      <div
        className="h-2 overflow-hidden rounded-full bg-ocean-soft"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ calendar */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month grid (Monday first) for the month containing `today`; `marked` days get a lime circle, today a dark one. */
export function MonthCalendar({ today, marked }: { today: string; marked: Set<string> }) {
  const [yy, mm, dd] = today.split("-").map(Number) as [number, number, number];
  const first = new Date(Date.UTC(yy, mm - 1, 1));
  const daysInMonth = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const iso = (d: number) => `${yy}-${String(mm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const month = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">Study days</h2>
        <span className="text-xs font-medium text-ink">{month}</span>
      </div>
      <div className="grid grid-cols-7 gap-y-1.5 text-center text-xs">
        {WEEKDAYS.map((w) => (
          <span key={w} className="pb-1 font-medium text-muted">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={`blank-${i}`} />;
          const isToday = d === dd;
          const on = marked.has(iso(d));
          return (
            <span key={d} className="flex justify-center">
              <span
                className={`inline-flex size-7 items-center justify-center rounded-full tabular-nums ${
                  isToday ? "bg-ink font-semibold text-frame" : on ? "bg-brand font-medium text-brand-ink" : d > dd ? "text-muted" : "text-ink"
                }`}
                title={on ? "Learners studied" : undefined}
              >
                {d}
              </span>
            </span>
          );
        })}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-brand" /> Learners studied
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-ink" /> Today
        </span>
      </div>
    </div>
  );
}
