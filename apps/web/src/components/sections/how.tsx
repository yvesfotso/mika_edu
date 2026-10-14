import type { Dictionary } from "@/content/dictionary";
import { Phone } from "../phone";
import { OnboardingScreen, QuizScreen, ResultsScreen } from "../screens";
import { Container, delay, SectionHeader } from "../ui";

const STAGES = ["bg-lavender", "bg-lime", "bg-mint"];

export function How({ d }: { d: Dictionary }) {
  const t = d.how;
  const screens = [OnboardingScreen, QuizScreen, ResultsScreen];
  return (
    <section id="how" className="py-16 lg:py-24">
      <Container>
        <div className="rounded-[40px] bg-card px-5 py-14 sm:px-10 lg:px-14 lg:py-20">
          <SectionHeader center onCard kicker={t.kicker} title={t.title} />
          <ol className="mt-14 grid gap-10 lg:mt-16 lg:grid-cols-3 lg:gap-5">
            {t.steps.map((step, i) => {
              const Screen = screens[i]!;
              return (
                <li key={step.title} data-reveal style={delay(i)} className="flex flex-col">
                  {/* Phone cropped by its stage, the way app flows are shown in screen libraries */}
                  <div className={`relative flex h-[420px] justify-center overflow-hidden rounded-[28px] pt-10 ${STAGES[i]}`}>
                    <Phone label={`EduPrep · ${step.title}`} className="[--s:0.64]">
                      <Screen t={d.app} />
                    </Phone>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/[0.06] to-transparent" />
                  </div>
                  <div className="mt-6 flex gap-4 px-1">
                    <span className="display flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-strong text-[17px] text-lime">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="display text-[24px] leading-tight text-ink">{step.title}</h3>
                      <p className="mt-2 text-[15px] leading-relaxed text-muted">{step.text}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </Container>
    </section>
  );
}
