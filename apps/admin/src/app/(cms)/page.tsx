import { addDays, localDate } from "@eduprep/core";
import Link from "next/link";
import { Delta, DotMatrix, Gauge, Legend, LineChart, ResultBars, Widget } from "@/components/dashboard";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  BookIcon,
  CalendarIcon,
  ClockIcon,
  InfoIcon,
  MailIcon,
  PlusIcon,
  TargetIcon,
  UsersIcon,
} from "@/components/icons";
import { Avatar, buttonClass, Chip, iconButtonClass, secondaryButtonClass, t, type Tone } from "@/components/ui";
import { must } from "@/server/db";
import { requireStaffPage } from "@/server/staff";

const TZ = "Africa/Douala";

type Activity = { user_id: string; activity_date: string; seconds: number };
type Attempt = { user_id: string; percentage: number | null; submitted_at: string };
type NewLearner = {
  id: string;
  display_name: string | null;
  created_at: string;
  onboarding_completed: boolean;
  exam_tracks: { name: Record<string, string> } | null;
};

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(now));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

const shortDate = (d: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

function relativeDay(iso: string, today: string) {
  const days = Math.round((Date.parse(today) - Date.parse(localDate(new Date(iso), TZ))) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pctChange = (now: number | null, before: number | null) => (now === null || !before ? null : ((now - before) / before) * 100);

export default async function OverviewPage() {
  const staff = await requireStaffPage();
  const { db } = staff;
  const now = new Date();
  const today = localDate(now, TZ);
  const from28 = addDays(today, -27);
  const weekStart = addDays(today, -6);
  const prevWeekStart = addDays(today, -13);

  const count = (table: string) => db.from(table).select("*", { count: "exact", head: true });

  const [learnersRes, lessonsInReview, activityRes, attemptsRes, questionsRes, newestRes, masteryRes] = await Promise.all([
    count("profiles").eq("role", "student"),
    count("lessons").eq("status", "review"),
    db.from("daily_activity").select("user_id, activity_date, seconds").gte("activity_date", from28).limit(20000),
    db
      .from("quiz_attempts")
      .select("user_id, percentage, submitted_at")
      .gte("submitted_at", `${prevWeekStart}T00:00:00Z`)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: true })
      .limit(5000),
    db.from("questions").select("status").limit(20000),
    db
      .from("profiles")
      .select("id, display_name, created_at, onboarding_completed, exam_tracks(name)")
      .eq("role", "student")
      .order("created_at", { ascending: false })
      .limit(5),
    db.from("mastery").select("chapter_id, score, chapters(title)").limit(5000),
  ]);

  const learners = learnersRes.count ?? 0;
  const activity = must(activityRes, "loading activity") as Activity[];
  const attempts = must(attemptsRes, "loading attempts") as Attempt[];
  const questionStatuses = must(questionsRes, "loading questions") as { status: string }[];
  const newest = must(newestRes, "loading learners") as unknown as NewLearner[];

  // Study time
  const inRange = (a: Activity, lo: string, hi: string) => a.activity_date >= lo && a.activity_date <= hi;
  const thisWeek = activity.filter((a) => inRange(a, weekStart, today));
  const lastWeek = activity.filter((a) => inRange(a, prevWeekStart, addDays(weekStart, -1)));
  const hours = (rows: Activity[]) => rows.reduce((s, a) => s + a.seconds, 0) / 3600;
  const hoursThisWeek = hours(thisWeek);
  const days = Array.from({ length: 28 }, (_, i) => {
    const date = addDays(from28, i);
    const rows = activity.filter((a) => a.activity_date === date);
    return { date, learners: rows.length, seconds: rows.reduce((s, a) => s + a.seconds, 0) };
  });

  // Engagement
  const activeNow = new Set(thisWeek.map((a) => a.user_id));
  const activeBefore = new Set(lastWeek.map((a) => a.user_id)).size;
  const activePct = learners ? (activeNow.size / learners) * 100 : 0;
  const activePctBefore = learners ? (activeBefore / learners) * 100 : 0;

  // Scores
  const dayOf = (a: Attempt) => localDate(new Date(a.submitted_at), TZ);
  const scoreOf = (a: Attempt) => Number(a.percentage ?? 0);
  const weekScores = attempts.filter((a) => dayOf(a) >= weekStart).map(scoreOf);
  const prevScores = attempts.filter((a) => dayOf(a) < weekStart).map(scoreOf);
  const avgScore = avg(weekScores);
  const scoreByDay = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const v = avg(attempts.filter((a) => dayOf(a) === date).map(scoreOf));
    return { label: new Intl.DateTimeFormat("en-GB", { weekday: "narrow", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)), value: v };
  });
  const recentScores = attempts.slice(-24).map(scoreOf);
  const passed = recentScores.filter((s) => s >= 50).length;

  // Top learners this week by study time
  const timeByLearner = new Map<string, number>();
  for (const a of thisWeek) timeByLearner.set(a.user_id, (timeByLearner.get(a.user_id) ?? 0) + a.seconds);
  const topIds = [...timeByLearner.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  const topRes = topIds.length
    ? await db.from("profiles").select("id, display_name").in("id", topIds.map(([id]) => id))
    : { data: [], error: null };
  const topNames = new Map((must(topRes, "loading top learners") as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name]));

  // Content pipeline
  const byStatus = (s: string) => questionStatuses.filter((q) => q.status === s).length;
  const qPublished = byStatus("published");
  const qApproved = byStatus("approved");
  const qReview = byStatus("review");
  const qDraft = byStatus("draft");
  const qTotal = qPublished + qApproved + qReview + qDraft;
  const publishedPct = qTotal ? Math.round((qPublished / qTotal) * 100) : 0;

  // Hardest chapters
  const byChapter = new Map<string, { title: Record<string, string>; total: number; n: number }>();
  for (const m of must(masteryRes, "loading mastery") as unknown as { chapter_id: string; score: number; chapters: { title: Record<string, string> } | null }[]) {
    const entry = byChapter.get(m.chapter_id) ?? { title: m.chapters?.title ?? {}, total: 0, n: 0 };
    entry.total += Number(m.score);
    entry.n++;
    byChapter.set(m.chapter_id, entry);
  }
  const hardest = [...byChapter.entries()]
    .filter(([, v]) => v.n >= 3)
    .map(([id, v]) => ({ id, title: v.title, avg: v.total / v.n, n: v.n }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 4);

  const firstName = (staff.displayName ?? staff.email ?? "there").split(/[\s@]/)[0];

  const learnerStatus = (l: NewLearner): { tone: Tone; label: string } =>
    !l.onboarding_completed
      ? { tone: "waiting", label: "Setting up" }
      : activeNow.has(l.id)
        ? { tone: "done", label: "Active" }
        : { tone: "failed", label: "Inactive" };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 text-xs text-muted">
              <span className="font-medium text-ink">Portal</span> <span className="mx-1">›</span> Overview
            </div>
            <h1 className="text-3xl font-medium tracking-tight text-ink md:text-[2.1rem]">
              {greeting(now)} {firstName}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/questions/import" className={secondaryButtonClass}>
              <PlusIcon size={16} /> Import questions
            </Link>
            <span className={secondaryButtonClass}>
              <CalendarIcon size={16} /> {shortDate(weekStart)} – {shortDate(today)}
            </span>
            <Link href="/questions?status=review" className={buttonClass}>
              Review queue
            </Link>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-6 lg:grid-cols-12">
          {/* Profile */}
          <section className="relative flex min-h-[300px] flex-col justify-end overflow-hidden rounded-4xl bg-gradient-to-br from-ocean-soft via-panel to-brand-soft p-3 md:col-span-3 lg:col-span-3">
            <div className="absolute inset-x-0 top-6 flex justify-center">
              <div className="rounded-full bg-frame/60 p-3 backdrop-blur">
                <Avatar name={staff.displayName ?? staff.email} size={112} tone="brand" />
              </div>
            </div>
            <span className="absolute top-[9.5rem] left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs whitespace-nowrap text-frame">
              Cameroon pilot · 4 exams <ArrowUpRightIcon size={12} />
            </span>
            <div className="relative flex items-center gap-2 rounded-3xl bg-ink/55 p-3 text-white backdrop-blur-md">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{staff.displayName ?? staff.email}</div>
                <div className="text-xs capitalize opacity-75">{staff.role}</div>
              </div>
              <Link href="/inbox" aria-label="Inbox" className="inline-flex size-9 items-center justify-center rounded-full bg-white text-slate-900">
                <MailIcon size={16} />
              </Link>
              <Link href="/curriculum" aria-label="Curriculum" className="inline-flex size-9 items-center justify-center rounded-full bg-slate-900 text-white">
                <BookIcon size={16} />
              </Link>
            </div>
          </section>

          {/* Study time */}
          <Widget className="md:col-span-3 lg:col-span-6">
            <div className="mb-4 flex items-start gap-3">
              <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-ocean text-white">
                <ClockIcon size={20} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-4xl font-medium tabular-nums text-ink">{hoursThisWeek.toFixed(1)}</span>
                  <Delta value={pctChange(hoursThisWeek, hours(lastWeek))} />
                </div>
                <div className="text-xs text-muted">study hours this week, all learners</div>
              </div>
            </div>
            <DotMatrix days={days} />
          </Widget>

          {/* Engagement tiles */}
          <div className="grid gap-3 rounded-4xl border-2 border-ocean p-1.5 md:col-span-6 md:grid-cols-2 lg:col-span-3 lg:grid-cols-1">
            <div className="rounded-[1.4rem] bg-ocean p-4 text-white">
              <div className="flex items-center justify-between">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/15">
                  <UsersIcon size={16} />
                </span>
                <span className="text-xs font-semibold tabular-nums">
                  {activePct >= activePctBefore ? "+" : "−"}
                  {Math.abs(activePct - activePctBefore).toFixed(1)} pts
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-medium tabular-nums">{Math.round(activePct)}%</span>
                <span className="text-xs opacity-80">active this week</span>
              </div>
            </div>
            <div className="rounded-[1.4rem] bg-frame p-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-ocean-soft text-ocean-strong">
                  <TargetIcon size={16} />
                </span>
                <Delta value={pctChange(avgScore, avg(prevScores))} />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-medium tabular-nums text-ink">{avgScore === null ? "—" : `${Math.round(avgScore)}%`}</span>
                <span className="text-xs text-muted">avg. quiz score</span>
              </div>
            </div>
          </div>

          {/* Quiz score trend */}
          <Widget className="md:col-span-3 lg:col-span-3">
            <div className="text-sm text-muted">Average quiz score</div>
            <div className="mt-1 mb-3 flex items-center justify-between">
              <span className="text-2xl font-medium tabular-nums text-ink">{avgScore === null ? "—" : `${Math.round(avgScore)}%`}</span>
              <Delta value={pctChange(avgScore, avg(prevScores))} />
            </div>
            <LineChart points={scoreByDay} />
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
              <InfoIcon size={13} /> {weekScores.length} quizzes submitted in the last 7 days
            </p>
          </Widget>

          {/* Content pipeline */}
          <Widget className="md:col-span-3 lg:col-span-4">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="text-sm text-muted">Question bank</div>
                <h2 className="text-xl font-medium text-ink">Track your content</h2>
              </div>
              <Link href="/questions" aria-label="Open question bank" className={iconButtonClass}>
                <ArrowRightIcon size={16} />
              </Link>
            </div>
            <Gauge
              caption="Total questions"
              center={qTotal}
              segments={[
                { label: "Published", value: qPublished, className: "stroke-brand", swatch: "bg-brand" },
                { label: "Approved", value: qApproved, className: "stroke-ocean", swatch: "bg-ocean" },
                { label: "In progress", value: qReview + qDraft, className: "stroke-line", swatch: "bg-line" },
              ]}
            />
            <div className="mt-5">
              <Legend
                items={[
                  { label: "Published", value: qPublished, swatch: "bg-brand" },
                  { label: "Approved", value: qApproved, swatch: "bg-ocean" },
                  { label: "Draft & in review", value: qReview + qDraft, swatch: "bg-line" },
                ]}
              />
            </div>
          </Widget>

          {/* Practice results */}
          <Widget className="md:col-span-6 lg:col-span-5">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="text-sm text-muted">Practice statistics</div>
                <h2 className="text-xl font-medium text-ink">Quiz results</h2>
              </div>
              <Link href="/learners" aria-label="Open learners" className={iconButtonClass}>
                <ArrowRightIcon size={16} />
              </Link>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {topIds.map(([id, secs], i) => (
                <div key={id} className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-3xl bg-frame p-2 text-center">
                  <Avatar name={topNames.get(id) ?? null} size={52} tone={i ? "brand" : "ocean"} />
                  <div className="w-full truncate text-xs font-medium text-ink">{topNames.get(id)?.split(" ")[0] ?? "Learner"}</div>
                  <div className="text-[11px] text-muted">{(secs / 3600).toFixed(1)} h this week</div>
                </div>
              ))}
              <Link
                href="/inbox"
                className="col-start-3 flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-3xl bg-ocean text-white transition hover:bg-ocean-strong"
              >
                <MailIcon size={22} />
                <span className="text-xs">Message learners</span>
              </Link>
            </div>
            <div className="mb-2 flex justify-between text-xs text-muted">
              <span>
                <b className="font-semibold text-ink">{passed}</b> passed
              </span>
              <span>
                <b className="font-semibold text-ink">{recentScores.length - passed}</b> below 50%
              </span>
            </div>
            {recentScores.length ? <ResultBars scores={recentScores} /> : <p className="text-sm text-muted">No quizzes yet.</p>}
            <div className="mt-3 flex gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-brand" /> Passed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-line" /> Below pass mark
              </span>
            </div>
          </Widget>
        </div>
      </div>

      {/* Right panel */}
      <aside className="flex min-w-0 flex-col gap-5 rounded-4xl bg-panel p-5 xl:-my-2">
        <div>
          <div className="text-sm text-muted">Joined recently</div>
          <h2 className="mb-4 text-xl font-medium text-ink">New learners</h2>
          <ul className="space-y-1.5">
            {newest.map((l, i) => {
              const s = learnerStatus(l);
              return (
                <li key={l.id}>
                  <Link
                    href={`/learners?q=${encodeURIComponent(l.display_name ?? "")}`}
                    className={`flex items-center gap-3 rounded-2xl p-2.5 transition hover:bg-frame ${i === 1 ? "bg-ocean-soft" : ""}`}
                  >
                    <Avatar name={l.display_name} size={40} tone={i % 2 ? "brand" : "ocean"} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{l.display_name ?? "Unnamed learner"}</div>
                      <div className="truncate text-xs text-muted">
                        {l.exam_tracks ? t(l.exam_tracks.name) : "No track yet"} · {relativeDay(l.created_at, today)}
                      </div>
                    </div>
                    <Chip tone={s.tone}>{s.label}</Chip>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link href="/learners" className="mt-3 inline-flex items-center gap-1 px-2.5 text-sm font-medium text-ocean-strong hover:underline">
            All {learners} learners <ArrowRightIcon size={14} />
          </Link>
        </div>

        {/* Review queue */}
        <section className="rounded-4xl bg-ocean p-4 text-white">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-2">
              <Link href="/questions?status=review" className="flex items-center justify-between rounded-full bg-brand px-4 py-2.5 text-sm text-brand-ink">
                <span>Questions in review</span>
                <b className="tabular-nums">{qReview}</b>
              </Link>
              <Link href="/curriculum" className="flex items-center justify-between rounded-full bg-white px-4 py-2.5 text-sm text-slate-900">
                <span>Lessons in review</span>
                <b className="tabular-nums">{lessonsInReview.count ?? 0}</b>
              </Link>
              <Link href="/questions?status=approved" className="flex items-center justify-between rounded-full bg-white/15 px-4 py-2.5 text-sm">
                <span>Approved</span>
                <b className="tabular-nums">{qApproved}</b>
              </Link>
            </div>
            <div className="flex flex-col items-end justify-between py-1 text-right">
              <div>
                <div className="text-xs opacity-80">Published</div>
                <div className="text-3xl font-medium tabular-nums">{publishedPct}%</div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <Link href="/questions?status=draft" className="rounded-full bg-white/15 px-3 py-1.5 text-xs">
              {qDraft} draft{qDraft === 1 ? "" : "s"}
            </Link>
            <div className="text-right">
              <div className="text-xs opacity-80">Questions live</div>
              <div className="text-3xl font-medium tabular-nums">{qPublished}</div>
            </div>
          </div>
        </section>

        {/* Hardest chapters */}
        <div>
          <h2 className="mb-3 text-base font-medium text-ink">Chapters learners find hardest</h2>
          {hardest.length === 0 ? (
            <p className="text-sm text-muted">Not enough practice data yet (needs 3+ learners per chapter).</p>
          ) : (
            <ul className="space-y-3">
              {hardest.map((h) => (
                <li key={h.id}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="truncate text-ink">{t(h.title)}</span>
                    <span className="font-semibold tabular-nums text-ink">{Math.round(h.avg * 100)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-frame">
                    <div className="h-full rounded-full bg-ocean" style={{ width: `${Math.round(h.avg * 100)}%` }} />
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{h.n} learners</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
