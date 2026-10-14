import type { Dictionary } from "@/content/dictionary";
import { Phone } from "../phone";
import { DashboardScreen, LessonScreen, MessagesScreen, ProgressScreen, SubjectsScreen } from "../screens";
import { Container, delay, SectionHeader } from "../ui";

export function Gallery({ d }: { d: Dictionary }) {
  const t = d.gallery;
  const screens = [DashboardScreen, SubjectsScreen, LessonScreen, MessagesScreen, ProgressScreen];
  return (
    <section aria-labelledby="gallery-title" className="relative overflow-hidden bg-strong py-16 lg:py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-20 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(213_242_106/0.18),transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 bottom-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(106_79_214/0.25),transparent)]"
      />
      <Container className="relative">
        <SectionHeader id="gallery-title" dark kicker={t.kicker} title={t.title} lead={t.lead} />
      </Container>

      {/* Scrolls sideways on small screens; fits in one row from 1240px. */}
      <div className="no-scrollbar relative mt-14 overflow-x-auto lg:mt-16">
        <ul className="mx-auto flex w-max snap-x snap-mandatory gap-4 px-4 pb-6 sm:px-6 lg:pb-16 xl:gap-5">
          {screens.map((Screen, i) => (
            <li key={t.labels[i]} data-reveal style={delay(i)} className={`flex snap-center flex-col items-center gap-5 ${i % 2 ? "lg:translate-y-10" : ""}`}>
              <Phone label={`EduPrep · ${t.labels[i]}`} className="[--s:0.6] xl:[--s:0.56]">
                <Screen t={d.app} />
              </Phone>
              <span className="rounded-full bg-white/10 px-4 py-1.5 text-[13px] font-semibold text-white">{t.labels[i]}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
