import type { Metadata } from "next";
import Link from "next/link";
import { Card, Chip, Empty, PageHeader, secondaryButtonClass, t } from "@/components/ui";
import { closeContentReport } from "@/server/cms/actions";
import { listOpenContentReports } from "@/server/learner/reports";
import { requireStaffPage } from "@/server/staff";

export const metadata: Metadata = { title: "Content reports" };

const REASON_LABEL: Record<string, string> = {
  wrong_answer: "Answer looks wrong",
  unclear: "Unclear",
  typo: "Typo",
  other: "Other",
};

export default async function ContentReportsPage() {
  const staff = await requireStaffPage();
  const reports = await listOpenContentReports(staff.db);
  const canClose = staff.role === "reviewer" || staff.role === "admin";

  return (
    <>
      <PageHeader
        title="Content reports"
        description="Learners flag questions and lessons that look wrong. Fix the item (a new question version is created when its content changes), then resolve the report."
      />
      <Card>
        {reports.length === 0 ? (
          <Empty>No open reports.</Empty>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-4 py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="waiting">{REASON_LABEL[r.reason] ?? r.reason}</Chip>
                    <span className="text-xs text-slate-500">{new Date(r.created_at).toLocaleString("en-GB", { timeZone: "Africa/Douala" })}</span>
                    {r.question && r.question_version !== null && r.question_version !== r.question.version && (
                      <Chip tone="neutral">Reported on v{r.question_version}, now v{r.question.version}</Chip>
                    )}
                  </div>
                  {r.question && (
                    <Link href={`/questions/${r.question.id}`} className="block font-medium hover:underline">
                      {t(r.question.prompt)}
                    </Link>
                  )}
                  {r.lesson && (
                    <Link href={`/lessons/${r.lesson.id}`} className="block font-medium hover:underline">
                      Lesson: {t(r.lesson.title)}
                    </Link>
                  )}
                  {r.message && <p className="text-sm text-slate-600 dark:text-slate-300">“{r.message}”</p>}
                </div>
                {canClose && (
                  <div className="flex gap-2">
                    {(["resolved", "dismissed"] as const).map((status) => (
                      <form key={status} action={closeContentReport}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value={status} />
                        <button type="submit" className={secondaryButtonClass}>
                          {status === "resolved" ? "Resolved" : "Dismiss"}
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
