import type { Dictionary } from "@/content/dictionary";
import { Container, delay, SectionHeader } from "../ui";

const LOOK = [
  { tile: "bg-lavender", ink: "text-lavender-ink", mark: "A–E" },
  { tile: "bg-sky", ink: "text-sky-ink", mark: "A–E" },
  { tile: "bg-mint", ink: "text-mint-ink", mark: "/20" },
  { tile: "bg-peach", ink: "text-peach-ink", mark: "/20" },
];

export function Exams({ d }: { d: Dictionary }) {
  const t = d.exams;
  return (
    <section id="exams" className="py-16 lg:py-24">
      <Container>
        <SectionHeader kicker={t.kicker} title={t.title} lead={t.lead} />

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {t.items.map((exam, i) => {
            const look = LOOK[i]!;
            return (
              <li
                key={exam.name}
                data-reveal
                style={delay(i)}
                className="group relative flex min-h-[300px] flex-col overflow-hidden rounded-[32px] bg-card p-6 transition-transform duration-300 hover:-translate-y-1"
              >
                <span className={`self-start rounded-full px-3 py-1 text-[12px] font-bold ${look.tile} ${look.ink}`}>
                  {exam.system === "anglophone" ? t.anglophone : t.francophone}
                </span>
                <h3 className="display mt-6 text-[34px] text-ink">{exam.name}</h3>
                <p className="mt-2 text-[14px] font-semibold text-ink">{exam.grading}</p>
                <p className="mt-3 max-w-[260px] text-[15px] leading-relaxed text-muted">{exam.text}</p>
                <span
                  aria-hidden="true"
                  className={`display pointer-events-none absolute -bottom-4 right-5 text-[96px] opacity-[0.16] transition-transform duration-500 group-hover:-translate-y-1 ${look.ink}`}
                >
                  {look.mark}
                </span>
              </li>
            );
          })}
        </ul>

        <dl data-reveal className="mt-4 grid grid-cols-2 overflow-hidden rounded-[32px] bg-strong lg:grid-cols-4">
          {t.stats.map((s, i) => (
            <div key={s.label} className={`flex flex-col gap-1 p-6 sm:p-8 ${i % 2 ? "border-l border-white/10" : ""} ${i > 1 ? "border-t border-white/10 lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}>
              <dt className="order-2 text-[14px] text-strong-muted">{s.label}</dt>
              <dd className="display order-1 text-[clamp(1.9rem,4vw,2.9rem)] text-lime">{s.value}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
