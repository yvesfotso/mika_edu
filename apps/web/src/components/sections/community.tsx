import type { Dictionary } from "@/content/dictionary";
import type { Locale } from "@/content/locales";
import { PHOTOS } from "@/lib/site";
import { Icon, type IconName } from "../icons";
import { TileIcon, type Tone } from "../phone";
import { VerifiedBadge } from "../screens";
import { Container, delay, Kicker, Photo } from "../ui";

const POINTS: { icon: IconName; tone: Tone }[] = [
  { icon: "badgeCheck", tone: "sky" },
  { icon: "hash", tone: "lemon" },
  { icon: "ban", tone: "peach" },
];

function ChatCard({ app }: { app: Dictionary["app"] }) {
  return (
    <div className="w-full max-w-[360px] rounded-[28px] bg-card p-4 shadow-[0_30px_70px_-30px_rgb(23_23_31/0.55)]">
      <div className="flex items-center gap-3 border-b border-track pb-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-peach text-[15px] font-bold text-peach-ink">P</span>
        <div className="flex-1">
          <p className="text-[14.5px] font-bold text-ink">{app.friendName}</p>
          <p className="text-[12px] text-app-muted">{app.studyFriend}</p>
        </div>
        <span className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-muted">{app.today}</span>
      </div>
      <div className="flex flex-col gap-2 pt-3 text-[13.5px] leading-snug">
        <p className="max-w-[82%] self-end rounded-[18px] rounded-br-[6px] bg-strong px-3.5 py-2.5 text-white">{app.myMessage}</p>
        <p className="max-w-[82%] self-start rounded-[18px] rounded-bl-[6px] bg-paper px-3.5 py-2.5 text-ink">{app.friendMessage}</p>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-full bg-paper py-1.5 pl-4 pr-1.5 text-[13px] text-app-muted">
        <span className="flex-1">{app.typeMessage}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-strong">
          <Icon name="send" size={15} />
        </span>
      </div>
    </div>
  );
}

function TeamCard({ app }: { app: Dictionary["app"] }) {
  return (
    <div className="w-full max-w-[300px] rounded-[24px] bg-card p-4 shadow-[0_24px_60px_-28px_rgb(23_23_31/0.55)]">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-strong text-white">
          <Icon name="cap" size={17} />
        </span>
        <span className="text-[13.5px] font-bold text-ink">{app.supportTeam}</span>
        <VerifiedBadge label={app.verified} />
      </div>
      <p className="mt-2.5 text-[13px] leading-snug text-muted">{app.teamMessage}</p>
    </div>
  );
}

export function Community({ d, lang }: { d: Dictionary; lang: Locale }) {
  const t = d.community;
  return (
    <section id="community" className="py-16 lg:py-24">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-16">
          <div className="flex flex-col">
            <div data-reveal className="flex flex-col items-start gap-5">
              <Kicker>{t.kicker}</Kicker>
              <h2 className="display text-[clamp(2.2rem,5vw,3.75rem)] text-ink">{t.title}</h2>
              <p className="max-w-[500px] text-[17px] leading-relaxed text-muted">{t.lead}</p>
            </div>
            <ul className="mt-10 flex flex-col gap-3">
              {t.points.map((p, i) => (
                <li key={p.title} data-reveal style={delay(i)} className="flex gap-4 rounded-[24px] bg-card p-5">
                  <TileIcon name={POINTS[i]!.icon} tone={POINTS[i]!.tone} size={44} />
                  <div>
                    <h3 className="text-[16.5px] font-bold text-ink">{p.title}</h3>
                    <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{p.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div data-reveal className="relative">
            <div className="relative h-[420px] overflow-hidden rounded-[36px] bg-track sm:h-[600px]">
              <Photo photo={PHOTOS.friends} lang={lang} sizes="(min-width: 1024px) 640px, 100vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-strong/45 to-transparent" />
              <span className="absolute right-5 top-5 hidden items-center gap-2 rounded-full bg-strong/85 py-2 pl-2 pr-4 text-white backdrop-blur-md sm:inline-flex">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime text-strong">
                  <Icon name="hash" size={14} />
                </span>
                <span className="text-[12px] text-strong-muted">{d.app.friendCode}</span>
                <span className="text-[14px] font-bold tracking-[3px]">{d.app.friendCodeValue}</span>
              </span>
            </div>
            <div className="absolute left-6 top-6 hidden animate-float-slow xl:block">
              <TeamCard app={d.app} />
            </div>
            <div className="relative -mt-28 flex justify-center px-3 sm:absolute sm:bottom-6 sm:right-6 sm:mt-0 sm:px-0">
              <ChatCard app={d.app} />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
