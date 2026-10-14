import type { Dictionary } from "@/content/dictionary";
import type { Locale } from "@/content/locales";
import { PHOTOS } from "@/lib/site";
import { Icon, type IconName } from "../icons";
import { TileIcon, type Tone } from "../phone";
import { Container, delay, Kicker, Photo } from "../ui";

const POINTS: { icon: IconName; tone: Tone }[] = [
  { icon: "shieldCheck", tone: "mint" },
  { icon: "hash", tone: "lavender" },
  { icon: "calendarCheck", tone: "sky" },
  { icon: "lock", tone: "peach" },
];

export function Trust({ d, lang }: { d: Dictionary; lang: Locale }) {
  const t = d.trust;
  return (
    <section id="trust" className="py-16 lg:py-24">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-14">
          <div data-reveal className="relative min-h-[460px] overflow-hidden rounded-[36px] bg-track sm:min-h-[560px]">
            <Photo photo={PHOTOS.classroom} lang={lang} sizes="(min-width: 1024px) 600px, 100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-strong/80 via-strong/10 to-transparent" />
            <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-card/90 py-2 pl-2 pr-4 text-[13px] font-semibold text-ink backdrop-blur-md">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime text-strong">
                <Icon name="pen" size={14} />
              </span>
              {t.photoTag}
            </span>
            {/* Draft → Review → Approved → Published, as in packages/core/src/workflow.ts */}
            <ol className="absolute inset-x-5 bottom-5 flex items-center justify-between gap-1 rounded-[22px] bg-strong/80 p-3 backdrop-blur-md sm:p-4">
              {t.workflow.map((step, i) => {
                const last = i === t.workflow.length - 1;
                return (
                  <li key={step} className="flex flex-1 items-center gap-1 last:flex-none">
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11.5px] font-bold sm:px-3 sm:text-[12.5px] ${last ? "bg-lime text-strong" : "bg-white/10 text-white"}`}
                    >
                      {step}
                    </span>
                    {!last && <span aria-hidden="true" className="h-px flex-1 bg-white/25" />}
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="flex flex-col">
            <div data-reveal className="flex flex-col items-start gap-5">
              <Kicker>{t.kicker}</Kicker>
              <h2 className="display text-[clamp(2.2rem,5vw,3.6rem)] text-ink">{t.title}</h2>
              <p className="max-w-[540px] text-[17px] leading-relaxed text-muted">{t.lead}</p>
            </div>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2">
              {t.points.map((p, i) => (
                <li key={p.title} data-reveal style={delay(i)} className="flex flex-col gap-3 rounded-[24px] bg-card p-5">
                  <TileIcon name={POINTS[i]!.icon} tone={POINTS[i]!.tone} size={40} />
                  <h3 className="mt-1 text-[16.5px] font-bold text-ink">{p.title}</h3>
                  <p className="text-[14.5px] leading-relaxed text-muted">{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
