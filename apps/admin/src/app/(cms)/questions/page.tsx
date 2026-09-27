import { CONTENT_STATUSES, type ContentStatus, type LocalizedText } from "@eduprep/core";
import Link from "next/link";
import { Card, Empty, Field, inputClass, PageHeader, secondaryButtonClass, StatusBadge, t } from "@/components/ui";
import { must } from "@/server/db";
import { requireStaffPage } from "@/server/staff";

const PAGE_SIZE = 50;
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

export default async function QuestionsPage({ searchParams }: PageProps<"/questions">) {
  const sp = await searchParams;
  const { db } = await requireStaffPage();
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const status = CONTENT_STATUSES.includes(sp.status as ContentStatus) ? (sp.status as ContentStatus) : undefined;
  const chapterId = isUuid(sp.chapter) ? sp.chapter : undefined;

  let query = db
    .from("questions")
    .select("id, type, prompt, difficulty, status, source_type, chapters(title)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (chapterId) query = query.eq("chapter_id", chapterId);
  const res = await query;
  const rows = must(res, "loading questions") as unknown as {
    id: string;
    type: string;
    prompt: LocalizedText;
    difficulty: number;
    status: ContentStatus;
    source_type: string;
    chapters: { title: LocalizedText } | null;
  }[];
  const total = res.count ?? 0;

  const qs = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { status, chapter: chapterId, page: String(page), ...patch };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") params.set(k, String(v));
    return `/questions?${params}`;
  };

  return (
    <>
      <PageHeader
        title="Question bank"
        description={`${total} question(s)${chapterId ? " in this chapter" : ""}`}
        actions={
          <>
            <Link href="/questions/import" className={secondaryButtonClass}>
              Import CSV / JSON
            </Link>
            {chapterId && (
              <Link href={`/questions/new?chapter=${chapterId}`} className={secondaryButtonClass}>
                + New question
              </Link>
            )}
          </>
        }
      />
      <form action="/questions" className="mb-4 flex flex-wrap items-end gap-3">
        {chapterId && <input type="hidden" name="chapter" value={chapterId} />}
        <Field label="Status">
          <select name="status" defaultValue={status ?? ""} className={inputClass}>
            <option value="">All</option>
            {CONTENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <button className={secondaryButtonClass}>Filter</button>
        {chapterId && (
          <Link href="/questions" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
            Show all chapters
          </Link>
        )}
      </form>
      <Card>
        {rows.length === 0 ? (
          <Empty>No questions match. New questions are created from a chapter on the Curriculum page, or imported.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="pb-2 font-medium">Question</th>
                <th className="pb-2 font-medium">Chapter</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Diff.</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id} className="border-t border-slate-100 align-top dark:border-slate-700">
                  <td className="max-w-md py-2 pr-2">
                    <Link href={`/questions/${q.id}`} className="line-clamp-2 text-indigo-600 hover:underline dark:text-indigo-400">
                      {t(q.prompt)}
                    </Link>
                    {q.source_type === "ai_generated" && <span className="text-xs text-amber-600">AI-generated</span>}
                  </td>
                  <td className="py-2 pr-2">{q.chapters ? t(q.chapters.title) : "—"}</td>
                  <td className="py-2 pr-2 text-xs">{q.type.replace("_", " ")}</td>
                  <td className="py-2 pr-2 tabular-nums">{q.difficulty}</td>
                  <td className="py-2">
                    <StatusBadge status={q.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-4 flex justify-between text-sm">
          {page > 0 ? <Link href={qs({ page: page - 1 })}>← Previous</Link> : <span />}
          {(page + 1) * PAGE_SIZE < total && <Link href={qs({ page: page + 1 })}>Next →</Link>}
        </div>
      </Card>
    </>
  );
}
