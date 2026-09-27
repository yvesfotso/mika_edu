"use server";

import {
  canEdit,
  canTransition,
  contentStatusSchema,
  convertImportRows,
  examFormSchema,
  lessonFormSchema,
  localizedTextSchema,
  parseCsv,
  questionFormSchema,
  sendMessageSchema,
  type ContentStatus,
  type QuestionFormInput,
} from "@eduprep/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sessionClient } from "@/lib/supabase/server";
import { ApiError, must, notFound, type Db } from "../db";
import { openSupportConversation, sendStaffReply } from "../learner/messages";
import { audit, requireStaffAction, type StaffContext } from "../staff";
import { localized, num, optStr, runAction, str } from "./form";
import type { ActionState } from "./state";

const uuid = z.uuid();

export async function signOut(): Promise<void> {
  const supabase = await sessionClient();
  await supabase.auth.signOut();
  redirect("/login");
}
const slug = z.string().regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, digits and dashes only");

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

// ---------------------------------------------------------------------------
// Exams, tracks, subjects (admin only)
// ---------------------------------------------------------------------------

export async function saveExam(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  const state = await runAction(async () => {
    const staff = await requireStaffAction(["admin"]);
    const examId = optStr(fd, "examId");
    const input = examFormSchema.parse({
      countryCode: str(fd, "countryCode"),
      slug: str(fd, "slug"),
      name: localized(fd, "name"),
      description: localized(fd, "description"),
      level: str(fd, "level"),
      primaryLanguage: str(fd, "primaryLanguage"),
      examDate: optStr(fd, "examDate"),
      registrationDeadline: optStr(fd, "registrationDeadline"),
      sourceUrl: optStr(fd, "sourceUrl"),
      active: fd.get("active") === "on",
    });

    const row: Record<string, unknown> = {
      country_code: input.countryCode,
      slug: input.slug,
      name: input.name,
      description: input.description,
      level: input.level,
      primary_language: input.primaryLanguage,
      exam_date: input.examDate,
      registration_deadline: input.registrationDeadline,
      source_url: input.sourceUrl,
      active: input.active,
    };

    const verify = fd.get("markVerified") === "on";
    if (verify) {
      if (!input.sourceUrl) throw new ApiError(422, "source_required", "Official facts need a source URL before verification.");
      row.verified_at = new Date().toISOString();
      row.verified_by = staff.userId;
    }

    if (examId) {
      const current = must(
        await staff.db.from("exams").select("exam_date, registration_deadline, source_url").eq("id", examId).maybeSingle(),
        "loading exam",
      ) as { exam_date: string | null; registration_deadline: string | null; source_url: string | null } | null;
      if (!current) throw notFound("Exam");
      const factsChanged =
        current.exam_date !== input.examDate ||
        current.registration_deadline !== input.registrationDeadline ||
        current.source_url !== input.sourceUrl;
      // Changed official facts are hidden from learners until someone verifies them again.
      if (factsChanged && !verify) {
        row.verified_at = null;
        row.verified_by = null;
      }
      const res = await staff.db.from("exams").update(row).eq("id", examId);
      if (isUniqueViolation(res.error)) throw new ApiError(409, "slug_taken", "Another exam already uses this slug.");
      must(res, "updating exam");
      await audit(staff, "exam.update", "exam", examId, { ...row, factsChanged });
    } else {
      const res = await staff.db.from("exams").insert(row).select("id").single<{ id: string }>();
      if (isUniqueViolation(res.error)) throw new ApiError(409, "slug_taken", "Another exam already uses this slug.");
      createdId = must(res, "creating exam").id;
      await audit(staff, "exam.create", "exam", createdId, row);
    }
    revalidatePath("/exams");
    return { ok: true, message: verify ? "Saved and marked as verified" : "Saved" };
  });
  if (createdId) redirect(`/exams/${createdId}`);
  return state;
}

export async function createTrack(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await requireStaffAction(["admin"]);
    const examId = uuid.parse(str(fd, "examId"));
    const row = {
      exam_id: examId,
      slug: slug.parse(str(fd, "slug")),
      name: localizedTextSchema.parse(localized(fd, "name")),
      order_index: num(fd, "orderIndex", 0),
    };
    const res = await staff.db.from("exam_tracks").insert(row).select("id").single<{ id: string }>();
    if (isUniqueViolation(res.error)) throw new ApiError(409, "slug_taken", "This exam already has a track with that slug.");
    const { id } = must(res, "creating track");
    await audit(staff, "track.create", "exam_track", id, row);
    revalidatePath(`/exams/${examId}`);
    return { ok: true, message: "Track added" };
  });
}

export async function setTrackSubject(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await requireStaffAction(["admin"]);
    const trackId = uuid.parse(str(fd, "trackId"));
    const subjectId = uuid.parse(str(fd, "subjectId"));
    const coefficient = z.number().positive().max(20).parse(num(fd, "coefficient", 1));
    const row = { track_id: trackId, subject_id: subjectId, coefficient, order_index: num(fd, "orderIndex", 0) };
    must(await staff.db.from("track_subjects").upsert(row), "saving track subject");
    await audit(staff, "track_subject.upsert", "exam_track", trackId, row);
    revalidatePath("/exams", "layout");
    return { ok: true, message: "Subject saved" };
  });
}

export async function removeTrackSubject(fd: FormData): Promise<void> {
  const staff = await requireStaffAction(["admin"]);
  const trackId = uuid.parse(str(fd, "trackId"));
  const subjectId = uuid.parse(str(fd, "subjectId"));
  must(
    await staff.db.from("track_subjects").delete().eq("track_id", trackId).eq("subject_id", subjectId),
    "removing track subject",
  );
  await audit(staff, "track_subject.delete", "exam_track", trackId, { subjectId });
  revalidatePath("/exams", "layout");
}

export async function createSubject(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await requireStaffAction(["admin"]);
    const row = {
      slug: slug.parse(str(fd, "slug")),
      name: localizedTextSchema.parse(localized(fd, "name")),
      icon: optStr(fd, "icon"),
    };
    const res = await staff.db.from("subjects").insert(row).select("id").single<{ id: string }>();
    if (isUniqueViolation(res.error)) throw new ApiError(409, "slug_taken", "A subject with this slug already exists.");
    const { id } = must(res, "creating subject");
    await audit(staff, "subject.create", "subject", id, row);
    revalidatePath("/subjects");
    return { ok: true, message: "Subject created" };
  });
}

// ---------------------------------------------------------------------------
// Review workflow
// ---------------------------------------------------------------------------

type ContentTable = "chapters" | "lessons" | "questions";

async function loadStatus(db: Db, table: ContentTable, id: string): Promise<ContentStatus> {
  const row = must(await db.from(table).select("status").eq("id", id).maybeSingle(), `loading ${table}`) as {
    status: ContentStatus;
  } | null;
  if (!row) throw notFound("Content");
  return row.status;
}

async function assertEditable(staff: StaffContext, table: ContentTable, id: string): Promise<ContentStatus> {
  const status = await loadStatus(staff.db, table, id);
  if (!canEdit(status, staff.role)) {
    throw new ApiError(403, "locked", `Content in "${status}" status can't be edited with your role.`);
  }
  return status;
}

async function transition(table: ContentTable, fd: FormData): Promise<void> {
  const staff = await requireStaffAction();
  const id = uuid.parse(str(fd, "id"));
  const to = contentStatusSchema.parse(str(fd, "to"));
  const from = await loadStatus(staff.db, table, id);
  if (!canTransition(from, to, staff.role)) {
    throw new ApiError(403, "forbidden_transition", `A ${staff.role} can't move content from ${from} to ${to}.`);
  }
  // Guard against a concurrent change of status between the check and the write.
  must(await staff.db.from(table).update({ status: to }).eq("id", id).eq("status", from), `updating ${table} status`);
  await audit(staff, `${table}.status`, table, id, { from, to });
}

export async function transitionChapter(fd: FormData) {
  await transition("chapters", fd);
  revalidatePath("/curriculum");
}

export async function transitionLesson(fd: FormData) {
  await transition("lessons", fd);
  revalidatePath(`/lessons/${str(fd, "id")}`);
  revalidatePath("/curriculum");
}

export async function transitionQuestion(fd: FormData) {
  await transition("questions", fd);
  revalidatePath(`/questions/${str(fd, "id")}`);
  revalidatePath("/questions");
}

// ---------------------------------------------------------------------------
// Chapters and lessons
// ---------------------------------------------------------------------------

export async function createChapter(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await requireStaffAction();
    const trackId = uuid.parse(str(fd, "trackId"));
    const subjectId = uuid.parse(str(fd, "subjectId"));
    const inTrack = must(
      await staff.db.from("track_subjects").select("subject_id").eq("track_id", trackId).eq("subject_id", subjectId).maybeSingle(),
      "checking track subject",
    );
    if (!inTrack) throw new ApiError(422, "subject_not_in_track", "Add this subject to the track first.");
    const row = {
      track_id: trackId,
      subject_id: subjectId,
      title: localizedTextSchema.parse(localized(fd, "title")),
      order_index: num(fd, "orderIndex", 0),
      status: "draft",
    };
    const { id } = must(await staff.db.from("chapters").insert(row).select("id").single<{ id: string }>(), "creating chapter");
    await audit(staff, "chapter.create", "chapters", id, row);
    revalidatePath("/curriculum");
    return { ok: true, message: "Chapter created as draft" };
  });
}

export async function updateChapter(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await requireStaffAction();
    const id = uuid.parse(str(fd, "id"));
    await assertEditable(staff, "chapters", id);
    const patch = { title: localizedTextSchema.parse(localized(fd, "title")), order_index: num(fd, "orderIndex", 0) };
    must(await staff.db.from("chapters").update(patch).eq("id", id), "updating chapter");
    await audit(staff, "chapter.update", "chapters", id, patch);
    revalidatePath("/curriculum");
    return { ok: true, message: "Chapter saved" };
  });
}

export async function createLesson(fd: FormData): Promise<void> {
  const staff = await requireStaffAction();
  const chapterId = uuid.parse(str(fd, "chapterId"));
  const { count } = await staff.db.from("lessons").select("id", { count: "exact", head: true }).eq("chapter_id", chapterId);
  const row = {
    chapter_id: chapterId,
    title: { en: "Untitled lesson", fr: "Leçon sans titre" },
    body: {},
    order_index: count ?? 0,
    status: "draft",
    created_by: staff.userId,
    updated_by: staff.userId,
  };
  const { id } = must(await staff.db.from("lessons").insert(row).select("id").single<{ id: string }>(), "creating lesson");
  await audit(staff, "lesson.create", "lessons", id, { chapterId });
  redirect(`/lessons/${id}`);
}

/** The editor's datetime-local value is entered in UTC. */
function parsePublishAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(`${value.length === 16 ? `${value}:00` : value}Z`);
  if (Number.isNaN(date.getTime())) throw new ApiError(422, "invalid_date", "Invalid publish date.");
  return date.toISOString();
}

export async function saveLesson(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await requireStaffAction();
    const id = uuid.parse(str(fd, "id"));
    const status = await assertEditable(staff, "lessons", id);
    const input = lessonFormSchema.parse({
      chapterId: str(fd, "chapterId"),
      title: localized(fd, "title"),
      body: { en: str(fd, "body_en") || undefined, fr: str(fd, "body_fr") || undefined },
      estimatedMinutes: num(fd, "estimatedMinutes", 10),
      orderIndex: num(fd, "orderIndex", 0),
    });
    const current = must(await staff.db.from("lessons").select("version").eq("id", id).single(), "loading lesson") as {
      version: number;
    };
    const patch = {
      title: input.title,
      body: input.body,
      estimated_minutes: input.estimatedMinutes,
      order_index: input.orderIndex,
      publish_at: parsePublishAt(optStr(fd, "publishAt")),
      updated_by: staff.userId,
      // Editing live content creates a new version so learners' completion records stay meaningful.
      version: status === "published" ? current.version + 1 : current.version,
    };
    must(await staff.db.from("lessons").update(patch).eq("id", id), "saving lesson");
    await audit(staff, "lesson.update", "lessons", id, { version: patch.version });
    revalidatePath(`/lessons/${id}`);
    return { ok: true, message: status === "published" ? `Saved as version ${patch.version}` : "Saved" };
  });
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

async function assertChapterMatchesSubject(db: Db, chapterId: string | null, subjectId: string) {
  if (!chapterId) return;
  const chapter = must(await db.from("chapters").select("subject_id").eq("id", chapterId).maybeSingle(), "checking chapter") as {
    subject_id: string;
  } | null;
  if (!chapter) throw notFound("Chapter");
  if (chapter.subject_id !== subjectId) throw new ApiError(422, "chapter_mismatch", "The chapter belongs to a different subject.");
}

function questionRow(q: QuestionFormInput, userId: string) {
  return {
    subject_id: q.subjectId,
    chapter_id: q.chapterId,
    type: q.type,
    prompt: q.prompt,
    difficulty: q.difficulty,
    source_type: q.sourceType,
    source_year: q.sourceYear,
    official_source_url: q.officialSourceUrl,
    numeric_answer: q.type === "numeric" ? q.numericAnswer : null,
    numeric_tolerance: q.type === "numeric" ? q.numericTolerance : null,
    updated_by: userId,
  };
}

async function insertQuestion(db: Db, q: QuestionFormInput, userId: string): Promise<string> {
  const { id } = must(
    await db
      .from("questions")
      .insert({ ...questionRow(q, userId), status: "draft", created_by: userId })
      .select("id")
      .single<{ id: string }>(),
    "creating question",
  );
  if (q.type !== "numeric" && q.options.length > 0) {
    must(
      await db.from("question_options").insert(
        q.options.map((o, i) => ({ question_id: id, text: o.text, is_correct: o.isCorrect, order_index: i })),
      ),
      "creating options",
    );
  }
  must(await db.from("solutions").upsert({ question_id: id, explanation: q.explanation }), "saving explanation");
  return id;
}

export async function saveQuestion(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  const state = await runAction(async () => {
    const staff = await requireStaffAction();
    const id = optStr(fd, "id");
    let payload: unknown;
    try {
      payload = JSON.parse(str(fd, "payload"));
    } catch {
      throw new ApiError(400, "invalid_payload", "The form could not be read. Reload and try again.");
    }
    const q = questionFormSchema.parse(payload);
    if (q.sourceType === "official_past_paper" && staff.role === "teacher") {
      throw new ApiError(403, "forbidden", "Only reviewers and admins can label questions as official past-paper questions.");
    }
    await assertChapterMatchesSubject(staff.db, q.chapterId, q.subjectId);

    if (!id) {
      createdId = await insertQuestion(staff.db, q, staff.userId);
      await audit(staff, "question.create", "questions", createdId, { chapterId: q.chapterId });
      return;
    }

    uuid.parse(id);
    await assertEditable(staff, "questions", id);
    must(await staff.db.from("questions").update(questionRow(q, staff.userId)).eq("id", id), "updating question");

    // Keep option ids stable so past answers still point at the right choice.
    const existing = must(await staff.db.from("question_options").select("id").eq("question_id", id), "loading options") as {
      id: string;
    }[];
    const options = q.type === "numeric" ? [] : q.options;
    const keep = new Set(options.map((o) => o.id).filter(Boolean));
    const removed = existing.map((o) => o.id).filter((oid) => !keep.has(oid));
    if (removed.length > 0) must(await staff.db.from("question_options").delete().in("id", removed), "removing options");
    for (const [i, o] of options.entries()) {
      const row = { question_id: id, text: o.text, is_correct: o.isCorrect, order_index: i };
      if (o.id && existing.some((e) => e.id === o.id)) {
        must(await staff.db.from("question_options").update(row).eq("id", o.id), "updating option");
      } else {
        must(await staff.db.from("question_options").insert(row), "adding option");
      }
    }
    must(await staff.db.from("solutions").upsert({ question_id: id, explanation: q.explanation }), "saving explanation");
    await audit(staff, "question.update", "questions", id, { chapterId: q.chapterId });
    revalidatePath(`/questions/${id}`);
    return { ok: true, message: "Question saved" };
  });
  if (createdId) redirect(`/questions/${createdId}?created=1`);
  return state;
}

export async function importQuestions(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await requireStaffAction();
    const subjectId = uuid.parse(str(fd, "subjectId"));
    const chapterId = optStr(fd, "chapterId");
    if (chapterId) uuid.parse(chapterId);
    await assertChapterMatchesSubject(staff.db, chapterId, subjectId);

    const file = fd.get("file");
    let text = str(fd, "text");
    if (file instanceof File && file.size > 0) {
      if (file.size > 2 * 1024 * 1024) throw new ApiError(413, "too_large", "Import files are limited to 2 MB.");
      text = await file.text();
    }
    if (!text) throw new ApiError(422, "empty", "Paste CSV/JSON or choose a file.");

    let rows: unknown[];
    if (text.trimStart().startsWith("[")) {
      try {
        rows = JSON.parse(text);
      } catch {
        throw new ApiError(422, "invalid_json", "The JSON could not be parsed.");
      }
      if (!Array.isArray(rows)) throw new ApiError(422, "invalid_json", "JSON imports must be an array of rows.");
    } else {
      rows = parseCsv(text);
    }
    if (rows.length === 0) throw new ApiError(422, "empty", "No rows found.");
    if (rows.length > 500) throw new ApiError(413, "too_many", "Import at most 500 questions at a time.");

    const results = convertImportRows(rows, subjectId, chapterId);
    const valid = results.filter((r) => r.question);
    const failures = results.filter((r) => !r.question).map((r) => ({ row: r.row, errors: r.errors }));

    // Import is all-or-nothing on validation so a half-imported file never needs cleanup.
    if (failures.length > 0) {
      return { ok: false, error: `${failures.length} row(s) have errors. Nothing was imported.`, report: failures };
    }
    const officialByTeacher = valid.some((r) => r.question!.sourceType === "official_past_paper") && staff.role === "teacher";
    if (officialByTeacher) {
      throw new ApiError(403, "forbidden", "Only reviewers and admins can import official past-paper questions.");
    }
    for (const r of valid) {
      await assertChapterMatchesSubject(staff.db, r.question!.chapterId, subjectId);
    }
    const ids: string[] = [];
    for (const r of valid) ids.push(await insertQuestion(staff.db, r.question!, staff.userId));
    await audit(staff, "question.import", "questions", null, { count: ids.length, subjectId, chapterId });
    revalidatePath("/questions");
    return { ok: true, message: `Imported ${ids.length} question(s) as drafts.` };
  });
}

// ---------------------------------------------------------------------------
// Support inbox and moderation
// ---------------------------------------------------------------------------

export async function replyToSupport(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await requireStaffAction();
    const conversationId = uuid.parse(str(fd, "conversationId"));
    const input = sendMessageSchema.parse({ clientMessageId: str(fd, "clientMessageId"), body: str(fd, "body") });
    const message = await sendStaffReply(staff.db, staff.userId, conversationId, input, new Date());
    await audit(staff, "support.reply", "conversations", conversationId, { messageId: message.id });
    revalidatePath(`/inbox/${conversationId}`);
    revalidatePath("/inbox");
    return { ok: true, message: "Reply sent" };
  });
}

/** Opens (or reuses) a learner's support conversation so staff can write first. */
export async function startSupportChat(fd: FormData): Promise<void> {
  const staff = await requireStaffAction();
  const studentId = uuid.parse(str(fd, "studentId"));
  const student = must(
    await staff.db.from("profiles").select("id, role").eq("id", studentId).maybeSingle<{ id: string; role: string }>(),
    "loading learner",
  );
  if (!student || student.role !== "student") throw notFound("Learner");
  const conv = await openSupportConversation(staff.db, studentId);
  await audit(staff, "support.start", "conversations", conv.id, { studentId });
  redirect(`/inbox/${conv.id}`);
}

export async function resolveReport(fd: FormData): Promise<void> {
  const staff = await requireStaffAction(["reviewer", "admin"]);
  const id = z.coerce.number().int().positive().parse(str(fd, "id"));
  must(await staff.db.from("message_reports").update({ status: "resolved" }).eq("id", id), "resolving report");
  await audit(staff, "report.resolve", "message_reports", String(id));
  revalidatePath("/inbox");
}

// ---------------------------------------------------------------------------
// Learners
// ---------------------------------------------------------------------------

/** Moves a learner to another exam/track. Their program settings are reset for the new program. */
export async function reassignProgram(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await requireStaffAction(["admin"]);
    const userId = uuid.parse(str(fd, "userId"));
    const [examId, trackId] = str(fd, "program").split(":");
    const exam = uuid.parse(examId);
    const track = uuid.parse(trackId);
    const res = await staff.db.rpc("admin_reassign_program", { p_user: userId, p_exam: exam, p_track: track });
    if (res.error?.message.includes("invalid_track")) throw new ApiError(422, "invalid_track", "That track doesn't belong to the exam.");
    must(res, "reassigning program");
    await audit(staff, "learner.reassign_program", "profiles", userId, { examId: exam, trackId: track });
    revalidatePath("/learners");
    return { ok: true, message: "Exam updated. The learner will choose their program settings again." };
  });
}
