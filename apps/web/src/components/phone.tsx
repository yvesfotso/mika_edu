import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import type { Dictionary } from "@/content/dictionary";

/**
 * A 390×844 phone screen in a device frame, scaled by the `--s` custom property
 * (set it with a class, e.g. `[--s:0.6] lg:[--s:0.75]`). Screens are drawn at the app's real
 * sizes so spacing and type match apps/mobile one to one.
 */
export function Phone({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`phone-shell ${className}`} role="img" aria-label={label}>
      <div className="phone">
        <div className="phone-screen">{children}</div>
        <div className="phone-island" />
      </div>
    </div>
  );
}

export type Tone = "lavender" | "mint" | "peach" | "sky" | "lemon";

export const TONE_CLASS: Record<Tone, string> = {
  lavender: "bg-lavender text-lavender-ink",
  mint: "bg-mint text-mint-ink",
  peach: "bg-peach text-peach-ink",
  sky: "bg-sky text-sky-ink",
  lemon: "bg-lemon text-lemon-ink",
};

export function TileIcon({ name, tone, size = 40 }: { name: IconName; tone: Tone; size?: number }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${TONE_CLASS[tone]}`}
      style={{ width: size, height: size, borderRadius: size * 0.3 }}
    >
      <Icon name={name} size={size * 0.5} />
    </span>
  );
}

export function ProgressRing({ value, size = 34, stroke = 3.5, showLabel = true }: { value: number; size?: number; stroke?: number; showLabel?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-track)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--color-success)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - value)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {showLabel && <span className="min-w-[34px] text-[13px] font-bold text-ink">{Math.round(value * 100)}%</span>}
    </span>
  );
}

export function StatusBar({ time, dark = false }: { time: string; dark?: boolean }) {
  return (
    <div className={`flex h-[54px] items-center justify-between px-[34px] pt-[6px] text-[16px] font-semibold ${dark ? "text-white" : "text-ink"}`}>
      <span>{time}</span>
      <span className="flex items-center gap-[6px]">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" aria-hidden="true">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" aria-hidden="true">
          <path d="M8 2.3c2.3 0 4.4.9 6 2.4l1.1-1.2A10.2 10.2 0 0 0 8 .7C5.3.7 2.8 1.7.9 3.5L2 4.7a8.6 8.6 0 0 1 6-2.4Zm0 3.3c1.4 0 2.7.5 3.7 1.4l1.1-1.2A7 7 0 0 0 8 4c-1.8 0-3.5.7-4.8 1.8L4.3 7c1-.9 2.3-1.4 3.7-1.4Zm0 3.3c-.6 0-1.1.2-1.5.6L8 11.3l1.5-1.8c-.4-.4-.9-.6-1.5-.6Z" />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none" aria-hidden="true">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="currentColor" opacity="0.4" />
          <rect x="2" y="2" width="17" height="9" rx="2" fill="currentColor" />
          <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" opacity="0.4" />
        </svg>
      </span>
    </div>
  );
}

type Tab = "home" | "subjects" | "progress" | "messages" | "profile";

const TAB_ICONS: Record<Tab, IconName> = { home: "grid", subjects: "library", progress: "chart", messages: "chats", profile: "user" };

/** The app's dark bottom bar with a lime pill behind the active tab. */
export function TabBar({ active, t }: { active: Tab; t: Dictionary["app"] }) {
  return (
    <div className="absolute inset-x-0 bottom-0 bg-strong px-2 pb-[30px] pt-2">
      <div className="flex">
        {(Object.keys(TAB_ICONS) as Tab[]).map((tab) => {
          const on = tab === active;
          return (
            <div key={tab} className="flex flex-1 flex-col items-center gap-[3px]">
              <span className={`relative rounded-full px-4 py-[5px] ${on ? "bg-lime text-strong" : "text-strong-muted"}`}>
                <Icon name={TAB_ICONS[tab]} size={20} strokeWidth={on ? 2.4 : 1.8} />
                {tab === "messages" && !on && (
                  <span className="absolute -top-1 right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                    2
                  </span>
                )}
              </span>
              <span className={`text-[11px] ${on ? "font-bold text-white" : "text-strong-muted"}`}>{t.tabs[tab]}</span>
            </div>
          );
        })}
      </div>
      <div className="absolute bottom-[8px] left-1/2 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-white/80" />
    </div>
  );
}

/** Keeps the home indicator on screens that have no tab bar. */
export function HomeIndicator({ dark = false }: { dark?: boolean }) {
  return <div className={`absolute bottom-[8px] left-1/2 h-[5px] w-[134px] -translate-x-1/2 rounded-full ${dark ? "bg-white/80" : "bg-ink"}`} />;
}
