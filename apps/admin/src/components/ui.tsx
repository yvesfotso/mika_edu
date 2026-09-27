import { localize, type ContentStatus, type LocalizedText } from "@eduprep/core";
import type { ReactNode } from "react";

export const t = (text: LocalizedText | null | undefined) => localize(text, "en") || "—";

export const inputClass =
  "w-full rounded-2xl border border-line bg-frame px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-ocean focus:outline-none focus:ring-4 focus:ring-ocean-soft";

export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full border border-line bg-frame px-4 py-2 text-sm font-medium text-ink transition hover:bg-card";

export const iconButtonClass =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-frame text-ink transition hover:bg-card";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-2 text-xs text-muted">
          <span className="font-medium text-ink">Portal</span> <span className="mx-1">›</span> {title}
        </div>
        <h1 className="text-3xl font-medium tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mb-6 rounded-4xl bg-card p-6">
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-lg font-medium text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export type Tone = "neutral" | "waiting" | "info" | "done" | "failed";

const TONE_STYLES: Record<Tone, string> = {
  neutral: "text-muted",
  waiting: "text-amber-600 dark:text-amber-300",
  info: "text-ocean-strong",
  done: "text-brand-strong",
  failed: "text-rose-500 dark:text-rose-300",
};

/** Outlined pill with a status dot, as used across the dashboard. */
export function Chip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-frame px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_STYLES[tone]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

const STATUS_TONE: Record<ContentStatus, Tone> = {
  draft: "neutral",
  review: "waiting",
  approved: "info",
  published: "done",
  archived: "failed",
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  return (
    <Chip tone={STATUS_TONE[status]}>
      <span className="capitalize">{status}</span>
    </Chip>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-4xl bg-card p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-3xl font-medium tabular-nums text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-3xl border border-dashed border-line p-6 text-center text-sm text-muted">{children}</p>;
}

export function Avatar({ name, size = 40, tone = "ocean" }: { name: string | null; size?: number; tone?: "ocean" | "brand" }) {
  const initials =
    (name ?? "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";
  const colors = tone === "brand" ? "bg-brand-soft text-brand-strong" : "bg-ocean-soft text-ocean-strong";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${colors}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export function LocalizedInputs({
  name,
  label,
  value,
  required,
}: {
  name: string;
  label: string;
  value?: LocalizedText;
  required?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={`${label} (English)`}>
        <input name={`${name}_en`} defaultValue={value?.en ?? ""} className={inputClass} />
      </Field>
      <Field label={`${label} (Français)`} hint={required ? "At least one language is required." : undefined}>
        <input name={`${name}_fr`} defaultValue={value?.fr ?? ""} className={inputClass} />
      </Field>
    </div>
  );
}
