import { addDays, localDate } from "@eduprep/core";
import Link from "next/link";
import { AreaChart, Delta, Kpi, Meter, MonthCalendar, Widget } from "@/components/dashboard";
import { ArrowRightIcon, BookIcon, ClockIcon, MailIcon, PlusIcon, TargetIcon, UsersIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { Avatar, buttonClass, Chip, darkButtonClass, iconButtonClass, secondaryButtonClass, t, TZ, type Tone } from "@/components/ui";
import { must } from "@/server/db";
import { requireStaffPage } from "@/server/staff";

type Activity = { user_id: string; activity_date: string; seconds: number };
type Attempt = { user_id: string; percentage: number | null; submitted_at: string };
type NewLearner = {
  id: string;
  display_name: string | null;
  created_at: string;
  onboarding_completed: boolean;
  exam_tracks: { name: Record<string, string> } | null;
};

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

  // Study hours per day this week vs the same weekday last week.
  const dayHours = (date: string) => activity.filter((a) => a.activity_date === date).reduce((s, a) => s + a.seconds, 0) / 3600;
  const weekChart = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      label: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)),
      current: dayHours(date),
      previous: dayHours(addDays(date, -7)),
    };
  });
  const studyDays = new Set(days.filter((d) => d.learners > 0).map((d) => d.date));
  const passRate = recentScores.length ? Math.round((passed / recentScores.length) * 100) : null;
  const hoursLabel = (v: number) => (v >= 10 ? `${Math.round(v)} h` : `${v.toFixed(1)} h`);

  const learnerStatus = (l: NewLearner): { tone: Tone; label: string } =>
    !l.onboarding_completed
      ? { tone: "waiting", label: "Setting up" }
      : activeNow.has(l.id)
        ? { tone: "done", label: "Active" }
        : { tone: "failed", label: "Inactive" };

  const topLearner = topIds[0];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <h1 className="sr-only">Overview</h1>

        {/* KPI row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi value={learners} label="Registered learners" icon={<UsersIcon size={18} />} tone="lime" />
          <Kpi
            value={`${Math.round(activePct)}%`}
            label="Active this week"
            icon={<TargetIcon size={18} />}
            tone="rose"
            delta={<Delta value={activePct - activePctBefore} suffix=" pts" />}
          />
          <Kpi
            value={hoursThisWeek.toFixed(1)}
            label="Study hours this week"
            icon={<ClockIcon size={18} />}
            tone="sky"
            delta={<Delta value={pctChange(hoursThisWeek, hours(lastWeek))} />}
          />
          <Kpi
            value={avgScore === null ? "—" : `${Math.round(avgScore)}%`}
            label="Avg. quiz score"
            icon={<BookIcon size={18} />}
            tone="amber"
            delta={<Delta value={pctChange(avgScore, avg(prevScores))} />}
          />
        </div>

        {/* Activity chart + question bank progress */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <Widget>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-ink">Study activity</h2>
              <div className="flex items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-brand" /> This week
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-ink" /> Last week
                </span>
                <span className="rounded-full bg-ink px-3 py-1 font-medium text-frame">
                  {shortDate(weekStart)} – {shortDate(today)}
                </span>
              </div>
            </div>
            <AreaChart points={weekChart} format={hoursLabel} label="Study hours per day, this week compared with last week" />
          </Widget>

          <Widget className="relative overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold text-ink">Question bank</h2>
              <Link href="/questions/import" aria-label="Import questions" className={iconButtonClass}>
                <PlusIcon size={16} />
              </Link>
            </div>
            <div className="relative mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
              <dl className="space-y-4">
                {[
                  { n: qPublished, label: "Published questions" },
                  { n: qApproved, label: "Approved, not yet live" },
                  { n: qReview + qDraft, label: "Draft & in review" },
                ].map((row) => (
                  <div key={row.label}>
                    <dt className="sr-only">{row.label}</dt>
                    <dd>
                      <div className="text-lg font-semibold tabular-nums text-ink">{row.n}</div>
                      <div className="mb-1.5 text-xs text-muted">{row.label}</div>
                      <Meter value={qTotal ? (row.n / qTotal) * 100 : 0} />
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-col items-center justify-end">
                <div className="relative flex size-28 items-end justify-center overflow-hidden rounded-full bg-brand">
                  <Mascot width={110} accessories={["glasses"]} className="translate-x-2 translate-y-1" />
                </div>
                <div className="mt-2 text-center text-xs text-muted">
                  <b className="text-base font-semibold text-ink tabular-nums">{publishedPct}%</b>
                  <br />
                  live
                </div>
              </div>
            </div>
          </Widget>
        </div>

        {/* Bottom row */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Widget className="flex flex-col">
            <h2 className="text-base font-semibold text-ink">Review queue</h2>
            <div className="mt-3 text-xs text-muted">Waiting for a reviewer</div>
            <div className="text-sm font-semibold text-ink">
              {qReview} question{qReview === 1 ? "" : "s"} · {lessonsInReview.count ?? 0} lesson{lessonsInReview.count === 1 ? "" : "s"}
            </div>
            <div className="my-3 flex flex-1 items-end justify-center rounded-2xl bg-brand-soft pt-4">
              <Mascot width={150} accessories={["book"]} />
            </div>
            <Link href="/questions?status=review" className={`${buttonClass} w-full`}>
              Open review queue
            </Link>
          </Widget>

          <Widget>
            <h2 className="text-base font-semibold text-ink">Quiz results</h2>
            <ul className="mt-3 divide-y divide-line">
              <li className="flex items-center justify-between gap-3 py-3">
                <div>
                  <div className="text-xs text-muted">Submitted, last 7 days</div>
                  <div className="text-sm font-semibold text-ink tabular-nums">{weekScores.length} quizzes</div>
                </div>
                <Link href="/learners" className={buttonClass.replace("px-5 py-2.5", "px-4 py-1.5")}>
                  Learners
                </Link>
              </li>
              <li className="flex items-center justify-between gap-3 py-3">
                <div>
                  <div className="text-xs text-muted">Pass rate, last {recentScores.length} quizzes</div>
                  <div className="text-sm font-semibold text-ink tabular-nums">
                    {passRate === null ? "No quizzes yet" : `${passRate}% · ${passed} passed`}
                  </div>
                </div>
                <Link href="/curriculum" className={darkButtonClass.replace("py-2", "py-1.5")}>
                  Content
                </Link>
              </li>
              <li className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted">Most study time this week</div>
                  <div className="truncate text-sm font-semibold text-ink">
                    {topLearner ? `${topNames.get(topLearner[0]) ?? "Learner"} · ${(topLearner[1] / 3600).toFixed(1)} h` : "Nobody yet"}
                  </div>
                </div>
                <Link href="/inbox" className={darkButtonClass.replace("py-2", "py-1.5")}>
                  Message
                </Link>
              </li>
            </ul>
          </Widget>

          <Widget className="md:col-span-2 lg:col-span-1">
            <h2 className="text-base font-semibold text-ink">Hardest chapters</h2>
            {hardest.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Not enough practice data yet (needs 3+ learners per chapter).</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {hardest.map((h) => {
                  const pct = Math.round(h.avg * 100);
                  return (
                    <li key={h.id} className="flex items-center gap-3 rounded-2xl bg-frame p-2">
                      <span
                        className={`inline-flex size-12 shrink-0 items-center justify-center rounded-xl text-sm font-semibold tabular-nums ${
                          pct < 50 ? "bg-ink text-brand" : "bg-brand text-brand-ink"
                        }`}
                      >
                        {pct}%
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink">{t(h.title)}</div>
                        <div className="text-xs text-muted">Average mastery · {h.n} learners</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Widget>
        </div>
      </div>

      {/* Right panel */}
      <aside className="flex min-w-0 flex-col gap-5 rounded-3xl bg-panel p-5">
        <div className="flex items-center gap-3">
          <Avatar name={staff.displayName ?? staff.email} size={56} tone="brand" />
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-ink">{staff.displayName ?? staff.email}</div>
            <div className="text-xs text-muted capitalize">{staff.role} · Cameroon pilot</div>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-xs">
          {[
            { label: "Learners", value: learners },
            { label: "Questions live", value: qPublished },
            { label: "In review", value: qReview + (lessonsInReview.count ?? 0) },
          ].map((s) => (
            <div key={s.label}>
              <dt className="text-muted">{s.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>

        <hr className="border-line" />
        <MonthCalendar today={today} marked={studyDays} />

        <hr className="border-line" />
        <div>
          <h2 className="mb-3 text-base font-semibold text-ink">Weekly engagement</h2>
          <Meter value={activePct} label="Learners active in the last 7 days" right={`${Math.round(activePct)}%`} />
        </div>

        <hr className="border-line" />
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">New learners</h2>
            <Link href="/learners" className="text-xs font-medium text-brand-strong hover:underline">
              View all
            </Link>
          </div>
          <ul className="space-y-1">
            {newest.map((l) => {
              const s = learnerStatus(l);
              return (
                <li key={l.id}>
                  <Link
                    href={`/learners?q=${encodeURIComponent(l.display_name ?? "")}`}
                    className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-frame"
                  >
                    <Avatar name={l.display_name} size={36} tone="brand" />
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
          <Link href="/inbox" className={`${secondaryButtonClass} mt-3 w-full`}>
            <MailIcon size={15} /> Message learners <ArrowRightIcon size={14} />
          </Link>
        </div>
      </aside>
    </div>
  );
}
