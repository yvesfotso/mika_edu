import type { ReactNode } from "react";
import { fill, type Dictionary } from "@/content/dictionary";
import { Icon, type IconName } from "./icons";
import { Mascot, Sticker } from "./mascot";
import { HomeIndicator, ProgressRing, StatusBar, TabBar, TileIcon, type Tone } from "./phone";

/**
 * Learner-app screens for the phone mockups. Each one recreates a screen in apps/mobile/src/app
 * with the demo account's data (Amina, Baccalauréat Série D).
 */
type App = Dictionary["app"];

/** BAC Série D subjects from the seed, heaviest coefficient first, with demo mastery. */
const SERIES_D: { key: keyof App["subjects"]; icon: IconName; tone: Tone; coef: number; chapters: number; mastery: number }[] = [
  { key: "biology", icon: "leaf", tone: "mint", coef: 5, chapters: 3, mastery: 0.58 },
  { key: "maths", icon: "calculator", tone: "peach", coef: 4, chapters: 5, mastery: 0.72 },
  { key: "physics", icon: "atom", tone: "lavender", coef: 3, chapters: 3, mastery: 0.64 },
  { key: "chemistry", icon: "flask", tone: "sky", coef: 2, chapters: 2, mastery: 0.41 },
  { key: "philosophy", icon: "bulb", tone: "lemon", coef: 2, chapters: 2, mastery: 0.3 },
  { key: "french", icon: "pen", tone: "peach", coef: 2, chapters: 2, mastery: 0.55 },
  { key: "english", icon: "book", tone: "lavender", coef: 2, chapters: 2, mastery: 0.7 },
];

function Screen({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <div className={`relative h-full ${dark ? "bg-strong" : "bg-paper"}`}>{children}</div>;
}

function Panel({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-[14px] rounded-[22px] bg-card p-[18px] ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[17px] font-semibold text-ink">{title}</span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[17px] font-semibold text-ink">{title}</span>
      {action && <span className="text-[12.5px] text-app-muted underline">{action}</span>}
    </div>
  );
}

function ScreenTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <p className="text-[28px] font-bold leading-tight tracking-[-0.7px] text-ink">{title}</p>
      {sub && <p className="mt-1 text-[13px] text-app-muted">{sub}</p>}
    </div>
  );
}

function CircleButton({ icon, className = "bg-card text-ink" }: { icon: IconName; className?: string }) {
  return (
    <span className={`flex h-10 w-10 items-center justify-center rounded-full ${className}`}>
      <Icon name={icon} size={18} />
    </span>
  );
}

function LimeButton({ children }: { children: ReactNode }) {
  return <span className="flex h-[54px] flex-1 items-center justify-center rounded-full bg-lime text-[15px] font-bold text-strong">{children}</span>;
}

function StreakChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-card px-[14px] py-[9px] text-[13px] font-semibold text-ink">
      <Icon name="flame" size={16} filled strokeWidth={1.5} className="text-[#F97316]" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

function ExamCard({ t }: { t: App }) {
  return (
    <div className="relative min-h-[170px] overflow-hidden rounded-[22px] bg-strong p-[18px]">
      <div className="absolute -right-[30px] -top-[30px] h-[150px] w-[150px] rounded-full bg-raised" />
      <Mascot mood="study" width={96} className="absolute bottom-1 right-1" />
      <div className="relative flex items-center gap-1.5 text-[12px] font-semibold text-white">
        <Icon name="cap" size={14} /> EduPrep
      </div>
      <p className="relative mr-[70px] mt-3 text-[21px] font-bold leading-[1.2] tracking-[-0.3px] text-white">{t.examTitle}</p>
      <p className="relative mr-20 mt-1.5 text-[12px] text-strong-muted">{t.countdown}</p>
      <span className="relative mt-2.5 inline-block rounded-full bg-raised px-3 py-[5px] text-[12.5px] font-extrabold text-lime">{t.goalChip}</span>
      <span className="relative mt-4 flex w-fit items-center rounded-full bg-lime px-4 py-[9px] text-[12.5px] font-bold text-strong">{t.examCta}</span>
    </div>
  );
}

function RecCard({ tone, title, subject, mastery, reason, t }: { tone: Tone; title: string; subject: string; mastery: number; reason: string; t: App }) {
  return (
    <div className="flex w-[230px] shrink-0 flex-col gap-4 rounded-[22px] bg-card p-4">
      <div className="flex items-center gap-3">
        <TileIcon name="zap" tone={tone} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-ink">{title}</p>
          <p className="mt-0.5 truncate text-[12px] text-app-muted">{subject}</p>
        </div>
      </div>
      <div className="flex justify-between">
        <div className="flex flex-col gap-[3px]">
          <span className="text-[11px] text-app-muted">{t.mastery}</span>
          <span className="flex items-center gap-1 text-[13px] font-bold text-ink">
            <Icon name="star" size={12} filled strokeWidth={0} className="text-[#F5B400]" /> {mastery}%
          </span>
        </div>
        <div className="flex flex-col gap-[3px]">
          <span className="text-[11px] text-app-muted">{t.status}</span>
          <span className="text-[13px] font-semibold text-ink">{reason}</span>
        </div>
      </div>
    </div>
  );
}

export function PlanRows({ t, compact = false }: { t: App; compact?: boolean }) {
  const rows: { icon: IconName; tone: Tone; title: string; sub: string; go: boolean }[] = [
    { icon: "bookOpen", tone: "lavender", title: t.planLessonTitle, sub: t.planLesson, go: true },
    { icon: "zap", tone: "mint", title: t.planPractise, sub: t.subjects.maths, go: true },
    { icon: "clock", tone: "peach", title: t.dailyGoal, sub: t.planGoal, go: false },
    { icon: "timer", tone: "sky", title: t.timedMock, sub: t.subjects.biology, go: true },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {(compact ? rows.slice(0, 3) : rows).map((r) => (
        <div key={r.title} className="flex items-center gap-3 py-1.5">
          <TileIcon name={r.icon} tone={r.tone} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold text-ink">{r.title}</p>
            <p className="mt-0.5 truncate text-[12px] text-app-muted">{r.sub}</p>
          </div>
          {r.go && (
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-paper text-ink">
              <Icon name="chevronRight" size={14} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function DashboardScreen({ t }: { t: App }) {
  return (
    <Screen>
      <StatusBar time={t.statusTime} />
      <div className="flex flex-col gap-5 px-4 pt-1">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-card bg-lavender text-[16px] font-bold text-lavender-ink">A</span>
          <p className="text-[23px] font-bold leading-tight tracking-[-0.6px] text-ink">{t.welcome} 👋</p>
        </div>
        <StreakChip label={t.streak} />
        <ExamCard t={t} />
        <div className="flex flex-col gap-3">
          <SectionTitle title={t.recommended} action={t.viewAll} />
          <div className="-mr-4 flex gap-3 overflow-hidden">
            <RecCard t={t} tone="peach" title={t.chapters.complex} subject={t.subjects.maths} mastery={42} reason={t.reasonWeak} />
            <RecCard t={t} tone="mint" title={t.chapters.genetics} subject={t.subjects.biology} mastery={55} reason={t.reasonForgetting} />
          </div>
        </div>
        <Panel title={t.todaysPlan}>
          <PlanRows t={t} />
        </Panel>
      </div>
      <TabBar active="home" t={t} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

export function SubjectsScreen({ t }: { t: App }) {
  return (
    <Screen>
      <StatusBar time={t.statusTime} />
      <div className="flex flex-col gap-4 px-4 pt-2">
        <ScreenTitle title={t.tabs.subjects} sub={t.examTitle} />
        <div className="flex flex-col gap-2.5">
          {SERIES_D.map((s) => (
            <div key={s.key} className="flex items-center gap-[14px] rounded-[18px] bg-card p-3">
              <TileIcon name={s.icon} tone={s.tone} />
              <div className="min-w-0 flex-[1.4]">
                <p className="truncate text-[14px] font-semibold text-ink">{t.subjects[s.key]}</p>
                <p className="mt-0.5 text-[12px] text-app-muted">{fill(t.chaptersCount, { n: s.chapters })}</p>
              </div>
              <span className="flex-1 text-[13px] font-semibold text-ink">{fill(t.coef, { n: s.coef })}</span>
              <ProgressRing value={s.mastery} />
            </div>
          ))}
        </div>
      </div>
      <TabBar active="subjects" t={t} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Lesson
// ---------------------------------------------------------------------------

export function LessonScreen({ t }: { t: App }) {
  return (
    <Screen>
      <StatusBar time={t.statusTime} />
      <div className="flex flex-col gap-4 px-4 pt-1">
        <div className="flex items-center justify-between">
          <CircleButton icon="chevronLeft" />
          <span className="flex items-center gap-1.5 rounded-full bg-mint px-3 py-[7px] text-[12px] font-semibold text-mint-ink">
            <Icon name="download" size={14} /> {t.savedOffline}
          </span>
        </div>
        <div>
          <p className="text-[13px] text-app-muted">{t.lessonMeta}</p>
          <p className="mt-1 text-[26px] font-bold leading-[1.15] tracking-[-0.6px] text-ink">{t.lessonTitle}</p>
        </div>
        <div className="flex flex-col gap-4 rounded-[22px] bg-card p-5 text-[15px] leading-[1.55] text-ink">
          <p>{t.lessonIntro}</p>
          <p className="rounded-[14px] bg-lime-soft py-4 text-center font-serif text-[26px] italic">
            z = a + <span className="not-italic">i</span>b
          </p>
          <ul className="flex flex-col gap-2.5">
            {t.lessonPoints.map((p) => (
              <li key={p} className="flex gap-2.5">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex bg-paper px-4 pb-[34px] pt-3">
        <LimeButton>
          <Icon name="check" size={18} strokeWidth={2.6} className="mr-2" />
          {t.markComplete}
        </LimeButton>
      </div>
      <HomeIndicator />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Quiz (mock exam)
// ---------------------------------------------------------------------------

export function QuizScreen({ t }: { t: App }) {
  const letters = ["A", "B", "C", "D"];
  return (
    <Screen>
      <StatusBar time={t.statusTime} />
      <div className="flex flex-col gap-4 px-4 pt-1">
        <div className="flex items-center justify-between">
          <CircleButton icon="x" />
          <span className="text-[15px] font-semibold text-ink">{t.modeMock}</span>
          <span className="flex items-center gap-1.5 rounded-full bg-strong px-3 py-2 text-[13px] font-extrabold tabular-nums text-lime">
            <Icon name="timer" size={14} /> {t.timeLeft}
          </span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded ${i === 2 ? "bg-lime" : i < 2 ? "bg-strong" : "bg-track"}`} />
          ))}
        </div>
        <div className="flex flex-col gap-2.5 rounded-[22px] bg-card p-5">
          <p className="text-[13px] text-app-muted">{t.question}</p>
          <p className="text-[22px] font-bold leading-[1.3] tracking-[-0.3px] text-ink">{t.prompt}</p>
        </div>
        <div className="flex flex-col gap-2.5">
          {t.options.map((o, i) => {
            const on = i === 0;
            return (
              <div key={o} className={`flex items-center gap-3 rounded-[22px] border-2 p-[14px] ${on ? "border-strong bg-lime-soft" : "border-transparent bg-card"}`}>
                <span
                  className={`flex h-[34px] w-[34px] items-center justify-center rounded-full text-[14px] font-extrabold ${on ? "bg-strong text-lime" : "bg-paper text-ink"}`}
                >
                  {letters[i]}
                </span>
                <span className="text-[15px] font-semibold text-ink">{o}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex gap-3 px-4 pb-[34px] pt-3">
        <span className="flex h-[54px] flex-1 items-center justify-center rounded-full bg-card text-[15px] font-bold text-ink">{t.previous}</span>
        <LimeButton>{t.next}</LimeButton>
      </div>
      <HomeIndicator />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export function ResultsScreen({ t }: { t: App }) {
  const chapters = [
    { name: t.chapters.quadratic, pct: 90 },
    { name: t.chapters.complex, pct: 75 },
    { name: t.chapters.sequences, pct: 60 },
  ];
  const ring = 2 * Math.PI * 40;
  return (
    <Screen>
      <StatusBar time={t.statusTime} />
      <div className="flex flex-col gap-4 px-4 pt-1">
        <ScreenTitle title={t.results} sub={`${t.subjects.maths} · ${t.modeMock}`} />
        <div className="relative overflow-hidden rounded-[22px] bg-strong p-5">
          <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-raised" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[12px] text-strong-muted">{t.score}</p>
              <p className="mt-1 text-[44px] font-bold leading-none tracking-[-1px] text-white">
                8<span className="text-[26px] text-strong-muted">/10</span>
              </p>
              <span className="mt-3 inline-block rounded-full bg-lime px-3 py-[5px] text-[12.5px] font-extrabold text-strong">{t.scoreGreat} · 80%</span>
              <p className="mt-3 flex items-center gap-1.5 text-[12px] text-strong-muted">
                <Icon name="clock" size={13} /> {t.time} · 31:06
              </p>
            </div>
            <svg width="96" height="96" aria-hidden="true">
              <circle cx="48" cy="48" r="40" stroke="var(--color-raised)" strokeWidth="9" fill="none" />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="var(--color-lime)"
                strokeWidth="9"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${ring} ${ring}`}
                strokeDashoffset={ring * 0.2}
                transform="rotate(-90 48 48)"
              />
              <text x="48" y="54" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="800">
                80%
              </text>
            </svg>
          </div>
        </div>
        <Panel title={t.byChapter}>
          {chapters.map((c) => (
            <div key={c.name} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[13px]">
                <span className="font-semibold text-ink">{c.name}</span>
                <span className="font-bold text-ink">{c.pct}%</span>
              </div>
              <span className="h-2 rounded-full bg-track">
                <span className="block h-full rounded-full bg-strong" style={{ width: `${c.pct}%` }} />
              </span>
            </div>
          ))}
        </Panel>
        <Panel title={t.review}>
          <div className="flex flex-col gap-2 rounded-[16px] bg-paper p-3">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-mint-ink">
              <Icon name="check" size={15} strokeWidth={2.6} /> {t.correct} · {t.prompt}
            </span>
            <p className="text-[12.5px] leading-[1.45] text-ink">{t.explanation}</p>
          </div>
        </Panel>
      </div>
      <Sticker kind="grade" size={54} className="absolute right-5 top-[64px] rotate-12" />
      <div className="absolute inset-x-0 bottom-0 flex bg-paper px-4 pb-[34px] pt-3">
        <LimeButton>{t.practiceAgain}</LimeButton>
      </div>
      <HomeIndicator />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Onboarding: série and target average
// ---------------------------------------------------------------------------

export function OnboardingScreen({ t }: { t: App }) {
  const tracks = [
    { name: t.trackC, n: 7 },
    { name: t.trackD, n: 7, on: true },
    { name: t.trackA4, n: 6 },
  ];
  return (
    <Screen>
      <StatusBar time={t.statusTime} />
      <div className="flex flex-col gap-5 px-5 pt-1">
        <div className="flex items-center gap-3">
          <CircleButton icon="chevronLeft" />
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-app-muted">{t.stepOf}</span>
            <span className="flex gap-1">
              <span className="h-1.5 flex-1 rounded bg-strong" />
              <span className="h-1.5 flex-1 rounded bg-lime" />
              <span className="h-1.5 flex-1 rounded bg-track" />
            </span>
          </div>
        </div>
        <div className="relative">
          <Mascot mood="think" bulb={false} width={84} className="absolute -top-7 right-1" />
          <p className="mr-24 text-[28px] font-bold leading-[1.15] tracking-[-0.7px] text-ink">{t.whichTrack}</p>
          <p className="mt-1.5 text-[14px] text-app-muted">Baccalauréat</p>
        </div>
        <div className="flex flex-col gap-2.5">
          {tracks.map((tr) => (
            <div key={tr.name} className={`flex items-center gap-3 rounded-[22px] border-2 p-4 ${tr.on ? "border-strong bg-lime-soft" : "border-transparent bg-card"}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${tr.on ? "bg-strong text-lime" : "border-2 border-track"}`}>
                {tr.on && <Icon name="check" size={14} strokeWidth={3} />}
              </span>
              <span className="flex-1 text-[16px] font-bold text-ink">{tr.name}</span>
              <span className="text-[13px] text-app-muted">{fill(t.subjectsCount, { n: tr.n })}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-[22px] bg-card p-4">
          <p className="text-[15px] font-semibold text-ink">{t.whatTarget}</p>
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-paper text-[22px] font-bold text-ink">−</span>
            <p className="text-[40px] font-bold tracking-[-1px] text-ink">
              14<span className="text-[20px] text-app-muted">/20</span>
            </p>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-strong text-[22px] font-bold text-lime">+</span>
            <span className="rounded-full bg-mint px-3 py-1.5 text-[12px] font-bold text-mint-ink">{t.mentionGood}</span>
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex px-5 pb-[34px] pt-3">
        <LimeButton>{t.continue}</LimeButton>
      </div>
      <HomeIndicator />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export function VerifiedBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-[3px] rounded-full bg-sky px-[7px] py-[2px] text-[11px] font-bold text-sky-ink">
      <Icon name="badgeCheck" size={12} strokeWidth={2.4} /> {label}
    </span>
  );
}

export function MessagesScreen({ t }: { t: App }) {
  return (
    <Screen>
      <StatusBar time={t.statusTime} />
      <div className="flex flex-col gap-4 px-4 pt-1">
        <div className="flex items-center justify-between">
          <ScreenTitle title={t.tabs.messages} />
          <CircleButton icon="plus" className="bg-lime text-strong" />
        </div>
        <div className="flex h-12 items-center gap-2.5 rounded-full bg-card px-4 text-[14px] text-app-muted">
          <Icon name="search" size={17} /> {t.search}
        </div>
        <div className="relative overflow-hidden rounded-[22px] bg-strong p-[18px]">
          <div className="absolute -bottom-10 -right-6 h-32 w-32 rounded-full bg-raised" />
          <p className="relative text-[12px] text-strong-muted">{t.friendCode}</p>
          <div className="relative mt-1 flex items-center justify-between">
            <p className="text-[28px] font-bold tracking-[4px] text-white">{t.friendCodeValue}</p>
            <span className="rounded-full bg-lime px-4 py-2 text-[12.5px] font-bold text-strong">{t.copy}</span>
          </div>
        </div>
        <SectionTitle title={t.conversations} />
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3 rounded-[22px] bg-card p-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-strong text-white">
              <Icon name="cap" size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-bold text-ink">{t.supportTeam}</span>
                <VerifiedBadge label={t.verified} />
              </div>
              <p className="mt-0.5 truncate text-[13px] text-app-muted">{t.supportPreview}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[11px] text-app-muted">09:12</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-lime px-1.5 text-[11px] font-bold text-strong">1</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-[22px] bg-card p-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-peach text-[18px] font-bold text-peach-ink">P</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-bold text-ink">{t.friendName}</span>
                <span className="rounded-full bg-paper px-2 py-[2px] text-[11px] font-semibold text-app-muted">{t.studyFriend}</span>
              </div>
              <p className="mt-0.5 truncate text-[13px] font-semibold text-ink">{t.friendPreview}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[11px] text-app-muted">08:47</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-lime px-1.5 text-[11px] font-bold text-strong">1</span>
            </div>
          </div>
        </div>
      </div>
      <TabBar active="messages" t={t} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export const WEEK_MINUTES = [22, 35, 18, 30, 26, 8, 25];

export function WeekBars({ days, height = 110, dark = false }: { days: string[]; height?: number; dark?: boolean }) {
  const max = Math.max(...WEEK_MINUTES);
  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {WEEK_MINUTES.map((m, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <span
            className={`w-full max-w-[28px] rounded-[8px] ${i === WEEK_MINUTES.length - 1 ? "bg-lime" : dark ? "bg-white/85" : "bg-strong"}`}
            style={{ height: (m / max) * (height - 24) }}
          />
          <span className={`text-[11px] ${dark ? "text-strong-muted" : "text-app-muted"}`}>{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function ProgressScreen({ t }: { t: App }) {
  return (
    <Screen>
      <StatusBar time={t.statusTime} />
      <div className="flex flex-col gap-4 px-4 pt-1">
        <ScreenTitle title={t.tabs.progress} />
        <div className="flex items-center justify-between rounded-[22px] bg-card p-5">
          <div>
            <p className="text-[13px] text-app-muted">{t.overallMastery}</p>
            <p className="mt-1 text-[40px] font-bold leading-none tracking-[-1px] text-ink">68%</p>
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-[12px] font-bold text-mint-ink">
              <Icon name="trendingUp" size={13} /> +6%
            </span>
          </div>
          <ProgressRing value={0.68} size={92} stroke={10} showLabel={false} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-3 rounded-[22px] bg-card p-4">
            <TileIcon name="flame" tone="lemon" size={38} />
            <div>
              <p className="text-[12px] text-app-muted">{t.streakNow}</p>
              <p className="text-[20px] font-bold text-ink">{fill(t.days, { n: 12 })}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-[22px] bg-card p-4">
            <TileIcon name="star" tone="lavender" size={38} />
            <div>
              <p className="text-[12px] text-app-muted">{t.bestStreak}</p>
              <p className="text-[20px] font-bold text-ink">{fill(t.days, { n: 21 })}</p>
            </div>
          </div>
        </div>
        <Panel title={t.thisWeek} action={<span className="text-[13px] font-bold text-ink">164 min</span>}>
          <WeekBars days={t.weekDays} />
        </Panel>
      </div>
      <TabBar active="progress" t={t} />
    </Screen>
  );
}
