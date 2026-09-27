import Link from "next/link";
import { Card, PageHeader, t } from "@/components/ui";
import { must } from "@/server/db";
import { requireStaffPage } from "@/server/staff";
import { ExamForm } from "./exam-form";

export default async function ExamsPage() {
  const { db } = await requireStaffPage(["admin"]);
  const exams = must(
    await db.from("exams").select("id, slug, name, level, exam_date, verified_at, active, exam_tracks(count)").order("slug"),
    "loading exams",
  ) as {
    id: string;
    slug: string;
    name: Record<string, string>;
    level: string;
    exam_date: string | null;
    verified_at: string | null;
    active: boolean;
    exam_tracks: { count: number }[];
  }[];

  return (
    <>
      <PageHeader title="Exams & tracks" description="Exams learners can prepare for, their tracks/series and subject coefficients." />
      <Card>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="pb-2 font-medium">Exam</th>
              <th className="pb-2 font-medium">Level</th>
              <th className="pb-2 font-medium">Tracks</th>
              <th className="pb-2 font-medium">Exam date</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {exams.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="py-2">
                  <Link href={`/exams/${e.id}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                    {t(e.name)}
                  </Link>
                  <div className="text-xs text-slate-500">{e.slug}</div>
                </td>
                <td className="py-2">{e.level}</td>
                <td className="py-2 tabular-nums">{e.exam_tracks[0]?.count ?? 0}</td>
                <td className="py-2">
                  {e.exam_date ?? "—"}{" "}
                  {e.exam_date && !e.verified_at && <span className="text-xs text-amber-600">(unverified)</span>}
                </td>
                <td className="py-2">{e.active ? "Active" : "Hidden"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Add an exam">
        <ExamForm />
      </Card>
    </>
  );
}
