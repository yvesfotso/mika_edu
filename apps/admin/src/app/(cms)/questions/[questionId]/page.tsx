import { canEdit, type ContentStatus, type LocalizedText, type QuestionSource, type QuestionType } from "@eduprep/core";
import { notFound } from "next/navigation";
import { StatusActions } from "@/components/status-actions";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { transitionQuestion } from "@/server/cms/actions";
import { must } from "@/server/db";
import { requireStaffPage } from "@/server/staff";
import { chapterOptions } from "../chapters";
import { QuestionEditor } from "../question-editor";

export default async function QuestionPage({ params, searchParams }: PageProps<"/questions/[questionId]">) {
  const { questionId } = await params;
  const { created } = await searchParams;
  const staff = await requireStaffPage();
  if (!/^[0-9a-f-]{36}$/i.test(questionId)) notFound();

  const q = must(
    await staff.db
      .from("questions")
      .select(
        "id, subject_id, chapter_id, type, prompt, difficulty, source_type, source_year, official_source_url, numeric_answer, numeric_tolerance, status, question_options(id, text, is_correct, order_index), solutions(explanation)",
      )
      .eq("id", questionId)
      .maybeSingle(),
    "loading question",
  ) as {
    id: string;
    subject_id: string;
    chapter_id: string | null;
    type: QuestionType;
    prompt: LocalizedText;
    difficulty: number;
    source_type: QuestionSource;
    source_year: number | null;
    official_source_url: string | null;
    numeric_answer: number | null;
    numeric_tolerance: number | null;
    status: ContentStatus;
    question_options: { id: string; text: LocalizedText; is_correct: boolean; order_index: number }[];
    solutions: { explanation: LocalizedText } | null;
  } | null;
  if (!q) notFound();

  return (
    <>
      <PageHeader
        title="Edit question"
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={q.status} />
            <StatusActions id={q.id} status={q.status} role={staff.role} action={transitionQuestion} />
          </div>
        }
      />
      {created && (
        <p role="status" className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          Question created as a draft. Submit it for review when it&apos;s ready.
        </p>
      )}
      <Card>
        <QuestionEditor
          readOnly={!canEdit(q.status, staff.role)}
          chapters={await chapterOptions(staff.db, q.subject_id)}
          value={{
            id: q.id,
            subjectId: q.subject_id,
            chapterId: q.chapter_id,
            type: q.type,
            prompt: q.prompt,
            difficulty: q.difficulty,
            sourceType: q.source_type,
            sourceYear: q.source_year,
            officialSourceUrl: q.official_source_url,
            numericAnswer: q.numeric_answer,
            numericTolerance: q.numeric_tolerance,
            options: [...q.question_options]
              .sort((a, b) => a.order_index - b.order_index)
              .map((o) => ({ id: o.id, text: o.text, isCorrect: o.is_correct })),
            explanation: q.solutions?.explanation ?? {},
          }}
        />
      </Card>
    </>
  );
}
