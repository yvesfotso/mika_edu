import type { ReactNode } from "react";
import type { Dictionary } from "@/content/dictionary";
import type { Locale } from "@/content/locales";
import { PHOTOS } from "@/lib/site";
import { Icon, type IconName } from "../icons";
import { Mascot, Sticker } from "../mascot";
import { TileIcon, type Tone } from "../phone";
import { PlanRows, WeekBars } from "../screens";
import { Container, delay, Photo, SectionHeader } from "../ui";

/** The same app strings in both languages: the bilingual card shows them side by side. */
const PAIRS: [string, string][] = [
  ["Recommended for you", "Recommandé pour toi"],
  ["Today's plan", "Programme du jour"],
  ["Mark as complete", "Marquer comme terminée"],
];

function CardText({
  icon,
  tone,
  title,
  text,
  dark = false,
  art,
}: {
  icon: IconName;
  tone: Tone;
  title: string;
  text: string;
  dark?: boolean;
  /** Replaces the icon tile, e.g. with the mascot. */
  art?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {art ?? <TileIcon name={icon} tone={tone} size={44} />}
      <h3 className={`display mt-2 text-[26px] leading-[1.05] ${dark ? "text-white" : "text-ink"}`}>{title}</h3>
      <p className={`max-w-[420px] text-[15px] leading-relaxed ${dark ? "text-strong-muted" : "text-muted"}`}>{text}</p>
    </div>
  );
}

function Card({ children, className = "", step = 0 }: { children: ReactNode; className?: string; step?: number }) {
  return (
    <div data-reveal style={delay(step)} className={`relative overflow-hidden rounded-[32px] p-6 sm:p-8 ${className}`}>
      {children}
    </div>
  );
}

export function Features({ d, lang }: { d: Dictionary; lang: Locale }) {
  const t = d.features;
  const app = d.app;
  return (
    <section id="features" className="py-16 lg:py-24">
      <Container>
        <SectionHeader kicker={t.kicker} title={t.title} lead={t.lead} />

        <div className="mt-12 grid gap-4 lg:mt-16 lg:grid-cols-12">
          {/* Today's plan */}
          <Card className="grid grid-cols-1 gap-8 bg-card md:grid-cols-[0.9fr_1.1fr] md:items-center lg:col-span-7">
            <CardText icon="listChecks" tone="lavender" title={t.plan.title} text={t.plan.text} />
            <div className="rounded-[24px] bg-paper p-4 sm:p-5">
              <p className="mb-2 text-[17px] font-semibold text-ink">{app.todaysPlan}</p>
              <PlanRows t={app} />
            </div>
          </Card>

          {/* Recommendations */}
          <Card step={1} className="flex flex-col gap-8 bg-lime lg:col-span-5">
            <div className="flex flex-col gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-strong text-lime">
                <Icon name="target" size={22} />
              </span>
              <h3 className="display mt-2 text-[26px] leading-[1.05] text-strong">{t.recs.title}</h3>
              <p className="max-w-[420px] text-[15px] leading-relaxed text-strong/75">{t.recs.text}</p>
            </div>
            <div className="mt-auto flex flex-col gap-2.5">
              {[
                { name: app.chapters.genetics, subject: app.subjects.biology, coef: 5, pct: 38, reason: app.reasonWeak, tone: "bg-peach text-peach-ink" },
                { name: app.chapters.complex, subject: app.subjects.maths, coef: 4, pct: 55, reason: app.reasonForgetting, tone: "bg-lemon text-lemon-ink" },
              ].map((r) => (
                <div key={r.name} className="flex items-center gap-3 rounded-[20px] bg-card p-3 pr-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-strong text-[13px] font-extrabold text-lime">×{r.coef}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-ink">{r.name}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="h-1.5 flex-1 rounded-full bg-track">
                        <span className="block h-full rounded-full bg-strong" style={{ width: `${r.pct}%` }} />
                      </span>
                      <span className="text-[12px] font-bold text-ink">{r.pct}%</span>
                    </div>
                  </div>
                  <span className={`hidden rounded-full px-2.5 py-1 text-[11.5px] font-bold sm:inline ${r.tone}`}>{r.reason}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Mock exams */}
          <Card step={0} className="flex flex-col gap-8 bg-strong lg:col-span-4">
            <div className="flex flex-col gap-4 rounded-[24px] bg-raised p-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-strong-muted">{app.modeMock}</span>
                <span className="flex items-center gap-1.5 rounded-full bg-strong px-3 py-1.5 text-[13px] font-extrabold tabular-nums text-lime">
                  <Icon name="timer" size={14} /> 42:18
                </span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded ${i === 2 ? "bg-lime" : i < 2 ? "bg-white/80" : "bg-white/15"}`} />
                ))}
              </div>
              <p className="text-[13px] text-strong-muted">{app.question}</p>
              <p className="text-[19px] font-bold text-white">{app.prompt}</p>
            </div>
            <CardText dark icon="timer" tone="sky" title={t.mock.title} text={t.mock.text} />
          </Card>

          {/* Offline */}
          <Card step={1} className="flex flex-col gap-8 bg-card lg:col-span-4">
            <div className="flex flex-col gap-2 rounded-[24px] bg-paper p-4">
              <span className="mb-1 inline-flex items-center gap-1.5 self-start rounded-full bg-lemon px-3 py-1.5 text-[12px] font-bold text-lemon-ink">
                <Icon name="wifiOff" size={14} /> {t.offline.chip}
              </span>
              {[app.chapters.complex, app.chapters.sequences, app.chapters.genetics].map((name) => (
                <div key={name} className="flex items-center gap-3 rounded-[16px] bg-card p-2.5">
                  <TileIcon name="bookOpen" tone="mint" size={32} />
                  <span className="flex-1 truncate text-[13.5px] font-semibold text-ink">{name}</span>
                  <Icon name="download" size={16} className="text-mint-ink" />
                </div>
              ))}
            </div>
            <CardText icon="wifiOff" tone="lemon" title={t.offline.title} text={t.offline.text} art={<Mascot mood="zen" width={86} className="-mb-2 -ml-1" />} />
          </Card>

          {/* Bilingual */}
          <Card step={2} className="flex flex-col gap-8 bg-lavender lg:col-span-4">
            <div className="flex flex-col gap-3">
              <div className="flex self-start rounded-full bg-card p-1 text-[13px] font-bold">
                <span className={`rounded-full px-4 py-1.5 ${lang === "en" ? "bg-strong text-white" : "text-muted"}`}>English</span>
                <span className={`rounded-full px-4 py-1.5 ${lang === "fr" ? "bg-strong text-white" : "text-muted"}`}>Français</span>
              </div>
              {PAIRS.map(([en, fr]) => (
                <div key={en} className="flex items-center gap-3 rounded-[16px] bg-card/70 px-4 py-2.5 text-[13.5px]">
                  <div className="min-w-0 flex-1">
                    <p lang="en" className="truncate font-semibold text-ink">
                      {en}
                    </p>
                    <p lang="fr" className="truncate font-semibold text-lavender-ink">
                      {fr}
                    </p>
                  </div>
                  <Icon name="sync" size={15} className="shrink-0 text-lavender-ink" />
                </div>
              ))}
            </div>
            <CardText icon="languages" tone="lavender" title={t.bilingual.title} text={t.bilingual.text} />
          </Card>

          {/* Photo */}
          <div data-reveal className="relative min-h-[380px] overflow-hidden rounded-[32px] bg-track lg:col-span-5">
            <Photo photo={PHOTOS.reading} lang={lang} sizes="(min-width: 1024px) 500px, 100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-strong/75 via-strong/10 to-transparent" />
            <Sticker kind="bulb" size={60} className="absolute right-6 top-6 rotate-12 animate-float" />
            <p className="display absolute bottom-7 left-7 right-7 text-[clamp(2rem,4vw,2.75rem)] text-white">
              {t.photoCaption.split(" ").map((word, i, all) => (
                <span key={i} className={i === all.length - 1 ? "text-lime" : ""}>
                  {word}{" "}
                </span>
              ))}
            </p>
          </div>

          {/* Activity */}
          <Card step={1} className="grid grid-cols-1 gap-8 bg-card md:grid-cols-[1fr_1.1fr] md:items-center lg:col-span-7">
            <div className="flex flex-col gap-6">
              <CardText icon="flame" tone="peach" title={t.activity.title} text={t.activity.text} art={<Mascot mood="run" width={96} className="-mb-2 -ml-2" />} />
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-3 py-1.5 text-[13px] font-bold text-lemon-ink">
                  <Icon name="flame" size={14} filled strokeWidth={1.5} /> {app.streak}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-[13px] font-bold text-mint-ink">
                  <Icon name="trendingUp" size={14} /> {t.activity.delta}
                </span>
              </div>
            </div>
            <div className="rounded-[24px] bg-strong p-5">
              <div className="mb-4 flex items-baseline justify-between">
                <span className="text-[15px] font-semibold text-white">{app.thisWeek}</span>
                <span className="text-[13px] font-bold text-lime">{t.activity.week}</span>
              </div>
              <WeekBars days={app.weekDays} height={150} dark />
            </div>
          </Card>
        </div>
      </Container>
    </section>
  );
}
