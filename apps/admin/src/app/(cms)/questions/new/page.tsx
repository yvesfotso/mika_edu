import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { must } from "@/server/db";
import { requireStaffPage } from "@/server/staff";
import { chapterOptions } from "../chapters";
import { QuestionEditor } from "../question-editor";

export default async function NewQuestionPage({ searchParams }: PageProps<"/questions/new">) {
  const { chapter } = await searchParams;
  const { db } = await requireStaffPage();
  if (typeof chapter !== "string" || !/^[0-9a-f-]{36}$/i.test(chapter)) notFound();

  const row = must(await db.from("chapters").select("id, subject_id").eq("id", chapter).maybeSingle(), "loading chapter") as {
    id: string;
    subject_id: string;
  } | null;
  if (!row) notFound();

  return (
    <>
      <PageHeader title="New question" description="New questions start as drafts and go through review before learners see them." />
      <Card>
        <QuestionEditor
          readOnly={false}
          chapters={await chapterOptions(db, row.subject_id)}
          value={{
            subjectId: row.subject_id,
            chapterId: row.id,
            type: "single_choice",
            prompt: {},
            difficulty: 2,
            sourceType: "original",
            sourceYear: null,
            officialSourceUrl: null,
            numericAnswer: null,
            numericTolerance: null,
            options: [],
            explanation: {},
          }}
        />
      </Card>
    </>
  );
}
