import type { Dictionary } from "@/content/dictionary";
import type { Locale } from "@/content/locales";
import { PHOTOS } from "@/lib/site";
import { Icon } from "../icons";
import { Mascot, Sticker } from "../mascot";
import { Container, Photo } from "../ui";

export function Cta({ d, lang, signUp }: { d: Dictionary; lang: Locale; signUp: string }) {
  const t = d.cta;
  return (
    <section id="start" className="py-10 lg:py-16">
      <Container>
        <div data-reveal className="relative grid gap-12 overflow-hidden rounded-[40px] bg-lime px-6 py-14 sm:px-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-16 lg:py-20">
          <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full border-[40px] border-strong/[0.05]" />
          <div className="relative flex flex-col items-start">
            <h2 className="display text-[clamp(2.5rem,6vw,4.75rem)] text-strong">{t.title}</h2>
            <p className="mt-6 max-w-[480px] text-[17px] leading-relaxed text-strong/75">{t.lead}</p>
            <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <a
                href={signUp}
                className="group inline-flex h-14 items-center justify-center gap-3 rounded-full bg-strong pl-7 pr-2 text-[16px] font-bold text-white transition-transform hover:-translate-y-0.5"
              >
                {t.primary}
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-lime text-strong transition-transform group-hover:rotate-45">
                  <Icon name="arrowUpRight" size={18} strokeWidth={2.4} />
                </span>
              </a>
              <a href="#faq" className="inline-flex h-14 items-center justify-center rounded-full bg-white/55 px-7 text-[16px] font-semibold text-strong transition-colors hover:bg-white/80">
                {t.secondary}
              </a>
            </div>
            <p className="mt-5 text-[13px] font-semibold text-strong/60">{d.hero.platforms}</p>
          </div>

          <div className="relative mx-auto w-full max-w-[440px] pt-36">
            <div className="relative rotate-2">
              <Mascot mood="celebrate" cap width={128} className="absolute bottom-full left-8 -mb-2" />
              <div className="relative h-[340px] overflow-hidden rounded-[32px] border-[6px] border-card bg-track shadow-[0_40px_80px_-40px_rgb(23_23_31/0.6)] sm:h-[400px]">
                <Photo photo={PHOTOS.graduates} lang={lang} sizes="(min-width: 1024px) 440px, 90vw" />
              </div>
            </div>
            <Sticker kind="grade" size={78} className="absolute -right-3 bottom-10 rotate-12 animate-float" />
            <Sticker kind="sparkle" size={36} className="absolute right-10 top-6 animate-float-slow" />
          </div>
        </div>
      </Container>
    </section>
  );
}
