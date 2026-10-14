import type { Dictionary } from "@/content/dictionary";
import { Icon } from "../icons";
import { Mascot } from "../mascot";
import { Container, delay, Kicker } from "../ui";

export function Faq({ d }: { d: Dictionary }) {
  const t = d.faq;
  return (
    <section id="faq" className="py-16 lg:py-24">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div data-reveal className="flex flex-col items-start gap-5 lg:sticky lg:top-28 lg:self-start">
            <Kicker>{t.kicker}</Kicker>
            <h2 className="display text-[clamp(2.2rem,5vw,3.75rem)] text-ink">{t.title}</h2>
            <div className="relative mt-40 w-full max-w-[420px] rounded-[28px] bg-strong p-6 pt-8">
              <Mascot mood="think" width={128} className="absolute bottom-full left-10 -mb-1" />
              <p className="text-[17px] font-bold text-white">{t.moreTitle}</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-strong-muted">{t.moreText}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {t.items.map((item, i) => (
              <details key={item.q} data-reveal style={delay(i % 3)} className="group rounded-[24px] bg-card" open={i === 0}>
                <summary className="flex cursor-pointer items-center justify-between gap-4 rounded-[24px] px-6 py-5 text-[17px] font-semibold text-ink">
                  {item.q}
                  <span className="faq-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-ink transition-[rotate,background-color] duration-300">
                    <Icon name="plus" size={18} />
                  </span>
                </summary>
                <p className="px-6 pb-6 text-[15.5px] leading-relaxed text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
