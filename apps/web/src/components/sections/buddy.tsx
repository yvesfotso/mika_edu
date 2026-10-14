import type { Dictionary } from "@/content/dictionary";
import { Mascot, type Mood } from "../mascot";
import { Container, delay, SectionHeader } from "../ui";

/** One tile per mood, in the order of `d.buddy.items`. */
const TILES: { mood: Mood; tone: string }[] = [
  { mood: "study", tone: "bg-lavender" },
  { mood: "play", tone: "bg-mint" },
  { mood: "run", tone: "bg-peach" },
  { mood: "think", tone: "bg-lemon" },
  { mood: "zen", tone: "bg-sky" },
  { mood: "celebrate", tone: "bg-lime" },
];

export function Buddy({ d }: { d: Dictionary }) {
  const t = d.buddy;
  return (
    <section id="buddy" className="py-16 lg:py-24">
      <Container>
        <SectionHeader kicker={t.kicker} title={t.title} lead={t.lead} />
        <ul className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-16 lg:grid-cols-3">
          {TILES.map((tile, i) => {
            const item = t.items[i]!;
            return (
              <li key={tile.mood} data-reveal style={delay(i % 3)} className={`relative flex flex-col items-center overflow-hidden rounded-[28px] px-4 pb-6 pt-14 sm:rounded-[32px] sm:pt-16 ${tile.tone}`}>
                <span className="absolute left-4 top-4 rounded-full bg-white/75 px-3 py-1 text-[12px] font-bold text-ink sm:left-5 sm:top-5 sm:text-[13px]">{item.label}</span>
                <Mascot mood={tile.mood} cap={tile.mood === "celebrate"} width={190} className="h-auto w-[124px] sm:w-[190px]" />
                <p className="mt-4 max-w-[240px] text-center text-[13.5px] font-semibold leading-snug text-ink sm:text-[15px]">{item.text}</p>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
