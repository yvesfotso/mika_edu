import type { Dictionary } from "@/content/dictionary";
import { Icon } from "./icons";
import { Mascot } from "./mascot";
import { TileIcon } from "./phone";

/** Floating UI cards for the hero, built from the same pieces as the app. */
type Hero = Dictionary["hero"];
type App = Dictionary["app"];

export function StreakChip({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full bg-card/90 py-2 pl-2 pr-4 text-[14px] font-semibold text-ink shadow-[0_18px_40px_-18px_rgb(23_23_31/0.45)] backdrop-blur-md ${className}`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lemon text-[#F97316]">
        <Icon name="flame" size={17} filled strokeWidth={1.5} />
      </span>
      {label}
    </span>
  );
}

export function GoalCard({ t, className = "" }: { t: Hero; className?: string }) {
  return (
    <div className={`w-[230px] rounded-[22px] bg-card/90 p-4 shadow-[0_24px_50px_-24px_rgb(23_23_31/0.5)] backdrop-blur-md ${className}`}>
      <div className="flex items-center gap-3">
        <TileIcon name="clock" tone="peach" size={36} />
        <div>
          <p className="text-[12px] text-muted">{t.todayGoal}</p>
          <p className="text-[17px] font-bold text-ink">{t.todayValue}</p>
        </div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-track">
        <div className="h-full w-[83%] rounded-full bg-strong" />
      </div>
    </div>
  );
}

export function CountdownCard({ t }: { t: Hero }) {
  return (
    <div className="relative flex-1 overflow-hidden rounded-[32px] bg-strong p-6 text-white">
      <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-raised" />
      <Mascot mood="celebrate" width={118} className="absolute bottom-1 right-3" />
      <p className="relative flex items-center gap-2 text-[13px] font-semibold">
        <Icon name="calendarCheck" size={16} className="text-lime" />
        {t.countdownLabel}
      </p>
      <p className="display relative mt-6 text-[64px] text-lime">{t.countdownValue}</p>
      <p className="relative mt-1 text-[14px] text-strong-muted">{t.countdownSub}</p>
    </div>
  );
}

export function MasteryCard({ t, app }: { t: Hero; app: App }) {
  const rows = [
    { name: app.subjects.biology, pct: 58, color: "bg-mint-ink" },
    { name: app.subjects.maths, pct: 72, color: "bg-strong" },
    { name: app.subjects.physics, pct: 64, color: "bg-lavender-ink" },
  ];
  return (
    <div className="rounded-[32px] bg-card p-6">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold text-ink">{t.masteryTitle}</p>
        <span className="flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-[12px] font-bold text-mint-ink">
          <Icon name="trendingUp" size={13} /> +6%
        </span>
      </div>
      <div className="mt-5 flex flex-col gap-4">
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex justify-between text-[13px]">
              <span className="font-medium text-muted">{r.name}</span>
              <span className="font-bold text-ink">{r.pct}%</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-track">
              <div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NextUpCard({ t }: { t: Hero }) {
  return (
    <div className="flex items-center gap-3 rounded-full bg-lime p-2 pr-3">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-strong text-lime">
        <Icon name="zap" size={20} />
      </span>
      <div className="flex-1">
        <p className="text-[12px] font-semibold text-strong/70">{t.nextUp}</p>
        <p className="text-[15px] font-bold text-strong">{t.nextUpValue}</p>
      </div>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-strong">
        <Icon name="arrowRight" size={18} />
      </span>
    </div>
  );
}
