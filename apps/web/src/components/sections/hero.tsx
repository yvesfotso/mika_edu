import type { Dictionary } from "@/content/dictionary";
import type { Locale } from "@/content/locales";
import { PHOTOS } from "@/lib/site";
import { Icon } from "../icons";
import { Mascot, Sticker } from "../mascot";
import { Phone } from "../phone";
import { DashboardScreen } from "../screens";
import { Container, delay, Photo, PrimaryButton, SecondaryButton } from "../ui";
import { CountdownCard, GoalCard, MasteryCard, NextUpCard, StreakChip } from "../widgets";

export function Hero({ d, lang, signUp }: { d: Dictionary; lang: Locale; signUp: string }) {
  const t = d.hero;
  return (
    <section className="relative overflow-hidden pb-16 pt-32 sm:pt-40 lg:pb-24">
      {/* Ambient lime glow behind the headline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-260px] h-[720px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(213_242_106/0.6),rgb(213_242_106/0)_75%)]"
      />

      <Container className="relative flex flex-col items-center text-center">
        <Mascot mood="study" width={150} className="pointer-events-none absolute left-6 top-[170px] hidden xl:block" />
        <Mascot mood="wave" width={160} className="pointer-events-none absolute right-6 top-[150px] hidden xl:block" />
        <Sticker kind="sparkle" size={30} className="pointer-events-none absolute right-[190px] top-[130px] hidden animate-float-slow xl:block" />
        <span data-reveal className="inline-flex items-center gap-2 rounded-full border border-line bg-card/80 py-1.5 pl-1.5 pr-4 text-[13px] font-semibold text-ink backdrop-blur">
          <span className="flex h-6 items-center gap-1 rounded-full bg-strong px-2.5 text-[11px] font-bold uppercase tracking-wider text-lime">
            <Icon name="sparkles" size={12} filled strokeWidth={0} /> EN · FR
          </span>
          {t.badge}
        </span>

        <h1 data-reveal style={delay(1)} className="display mt-7 max-w-[1000px] text-[clamp(2.9rem,8.4vw,6.6rem)] text-ink">
          {t.titleLead}
          <br />
          <span className="marker">{t.titleAccent}</span> {t.titleTail}
        </h1>

        <p data-reveal style={delay(2)} className="mt-7 max-w-[640px] text-[17px] leading-relaxed text-muted sm:text-[19px]">
          {t.lead}
        </p>

        <div data-reveal style={delay(3)} className="mt-9 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
          <PrimaryButton href={signUp}>{t.primary}</PrimaryButton>
          <SecondaryButton href="#how">{t.secondary}</SecondaryButton>
        </div>
        <p data-reveal style={delay(4)} className="mt-5 text-[13px] font-medium text-muted">
          {t.platforms}
        </p>
      </Container>

      {/* Showcase: photo · phone · widgets */}
      <Container className="relative mt-14 lg:mt-20">
        <div className="grid items-end gap-5 lg:grid-cols-[1fr_auto_1fr]">
          <div data-reveal style={delay(2)} className="relative hidden h-[560px] overflow-hidden rounded-[36px] bg-track lg:block">
            <Photo photo={PHOTOS.hero} lang={lang} sizes="(min-width: 1024px) 420px, 0px" preload />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-strong/60 to-transparent" />
            <StreakChip label={d.app.streak} className="absolute left-5 top-5 animate-float" />
            <GoalCard t={t} className="absolute bottom-5 left-5" />
          </div>

          <div data-reveal className="relative flex justify-center">
            <div aria-hidden="true" className="absolute bottom-6 left-1/2 aspect-square w-[min(92vw,460px)] -translate-x-1/2 rounded-full bg-lime" />
            <Sticker kind="sparkle" size={44} className="absolute right-[6%] top-[12%] animate-float-slow" />
            <Sticker kind="pencil" size={64} className="absolute left-[2%] top-[28%] hidden -rotate-12 animate-float sm:block lg:hidden" />
            <Phone label={`EduPrep · ${d.gallery.labels[0]}`} className="[--s:0.72] sm:[--s:0.8]">
              <DashboardScreen t={d.app} />
            </Phone>
            <Mascot mood="wave" width={140} className="absolute -bottom-1 left-0 h-auto w-[96px] sm:left-[calc(50%-250px)] sm:w-[140px] lg:hidden" />
            {/* On small screens the side cards collapse into one floating card */}
            <GoalCard t={t} className="absolute -right-1 bottom-[14%] w-[200px] animate-float-slow lg:hidden" />
          </div>

          <div data-reveal style={delay(2)} className="relative hidden h-[560px] flex-col gap-5 lg:flex">
            <CountdownCard t={t} />
            <MasteryCard t={t} app={d.app} />
            <NextUpCard t={t} />
          </div>
        </div>
      </Container>
    </section>
  );
}
