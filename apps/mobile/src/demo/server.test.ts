import type { AttemptResultDto, DashboardDto, ExamDto, ProfileDto } from "@eduprep/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttemptView } from "@/lib/learning";

const memory = new Map<string, unknown>();
vi.mock("@/lib/storage", () => ({
  store: {
    get: (k: string) => (memory.has(k) ? structuredClone(memory.get(k)) : null),
    set: (k: string, v: unknown) => memory.set(k, structuredClone(v)),
    remove: (k: string) => memory.delete(k),
    removePrefix: () => undefined,
  },
}));
vi.mock("@/lib/ids", () => ({ randomId: () => crypto.randomUUID() }));
vi.mock("@/lib/learning", () => ({}));

const { DEMO_ACCOUNT, demoRequest, ensureDemoUserState } = await import("./server");
const content = (await import("./content.json")).default;

const demo = DEMO_ACCOUNT.userId;
const call = <T>(method: string, path: string, body?: unknown, user: string | null = demo) =>
  demoRequest<T>(method, path, body, user);

/** Answers every question correctly using the demo content's answer keys. */
function correctAnswers(view: AttemptView) {
  const questions = new Map(content.chapters.flatMap((c) => c.questions.map((q) => [q.id, q])));
  return view.attempt.questions.map((q) => {
    const key = questions.get(q.id)!;
    return key.type === "numeric"
      ? { questionId: q.id, numericValue: key.numericAnswer! }
      : { questionId: q.id, selectedOptionIds: key.options.filter((o) => o.isCorrect).map((o) => o.id) };
  });
}

beforeEach(() => {
  memory.clear();
  ensureDemoUserState(demo, "Amina", "fr");
});

describe("demo backend", () => {
  it("serves a populated dashboard for the demo account", async () => {
    const d = await call<DashboardDto>("GET", "/me/dashboard");
    expect(d.profile.onboardingCompleted).toBe(true);
    expect(d.exam?.slug).toBe("cm-bac");
    expect(d.daysUntilExam).toBeNull();
    expect(d.recommendations.length).toBeGreaterThan(0);
    expect(d.subjects.some((s) => s.chapterCount > 0 && s.mastery > 0)).toBe(true);
    expect(d.continueLesson).not.toBeNull();
    expect(d.activity).toHaveLength(42);
    expect(d.activity.at(-2)!.minutes).toBe(25);
    expect(d.activity.at(-1)!.minutes).toBe(0);
    expect(d.activity.at(-4)!.minutes).toBe(0);
  });

  it("runs the full practice loop: start, score, mastery, streak", async () => {
    const before = await call<DashboardDto>("GET", "/me/dashboard");
    const chapterId = before.recommendations[0]!.chapterId;
    const clientAttemptId = crypto.randomUUID();

    const view = await call<AttemptView>("POST", "/quiz-attempts", { clientAttemptId, mode: "practice", chapterId });
    expect(view.attempt.questions.length).toBeGreaterThan(0);
    expect(JSON.stringify(view)).not.toContain("isCorrect");

    const retry = await call<AttemptView>("POST", "/quiz-attempts", { clientAttemptId, mode: "practice", chapterId });
    expect(retry.attempt.id).toBe(view.attempt.id);

    const { result } = await call<{ result: AttemptResultDto }>("POST", `/quiz-attempts/${view.attempt.id}/submit`, {
      answers: correctAnswers(view),
    });
    expect(result.score).toBe(result.maxScore);
    expect(result.results.every((r) => r.correct)).toBe(true);

    const again = await call<{ result: AttemptResultDto }>("POST", `/quiz-attempts/${view.attempt.id}/submit`, { answers: [] });
    expect(again.result.score).toBe(result.score);

    const after = await call<DashboardDto>("GET", "/me/dashboard");
    expect(after.streak.activeToday).toBe(true);
    expect(after.streak.currentDays).toBe(3);
    const history = await call<{ attempts: unknown[] }>("GET", "/me/attempts");
    expect(history.attempts).toHaveLength(1);
  });

  it("scores wrong answers as incorrect and reveals the right ones", async () => {
    const d = await call<DashboardDto>("GET", "/me/dashboard");
    const view = await call<AttemptView>("POST", "/quiz-attempts", {
      clientAttemptId: crypto.randomUUID(),
      mode: "practice",
      chapterId: d.recommendations[0]!.chapterId,
    });
    const { result } = await call<{ result: AttemptResultDto }>("POST", `/quiz-attempts/${view.attempt.id}/submit`, {
      answers: [],
    });
    expect(result.score).toBe(0);
    expect(result.results.every((r) => !r.answered && (r.correctOptionIds.length > 0 || r.correctNumericValue !== null))).toBe(true);
  });

  it("reports no past-paper questions honestly", async () => {
    const d = await call<DashboardDto>("GET", "/me/dashboard");
    const subjectId = d.subjects.find((s) => s.chapterCount > 0)!.id;
    await expect(
      call("POST", "/quiz-attempts", { clientAttemptId: crypto.randomUUID(), mode: "past_paper", subjectId }),
    ).rejects.toMatchObject({ status: 404, code: "no_questions" });
  });

  it("completes lessons idempotently", async () => {
    const d = await call<DashboardDto>("GET", "/me/dashboard");
    const lessonId = d.continueLesson!.id;
    const first = await call<{ firstCompletion: boolean }>("POST", `/lessons/${lessonId}/complete`, { secondsSpent: 300 });
    const second = await call<{ firstCompletion: boolean }>("POST", `/lessons/${lessonId}/complete`, { secondsSpent: 300 });
    expect(first.firstCompletion).toBe(true);
    expect(second.firstCompletion).toBe(false);
    const after = await call<DashboardDto>("GET", "/me/dashboard");
    expect(after.todayMinutes).toBe(5);
  });

  it("onboards a brand-new account", async () => {
    const user = crypto.randomUUID();
    ensureDemoUserState(user, "Paul", "en");
    const { exams } = await call<{ exams: ExamDto[] }>("GET", "/exams", undefined, null);
    const gce = exams.find((e) => e.slug === "cm-gce-o-level")!;
    await expect(call("PATCH", "/me", { onboardingCompleted: true }, user)).rejects.toMatchObject({ status: 422 });
    const track = gce.tracks[0]!.id;
    await expect(
      call("PATCH", "/me", { targetExamId: gce.id, targetTrackId: track, onboardingCompleted: true }, user),
    ).rejects.toMatchObject({ status: 422, code: "subjects_required" });
    const trackSubjects = content.exams.find((e) => e.id === gce.id)!.tracks[0]!.subjects.map((x) => x.subjectId);
    const { profile } = await call<{ profile: ProfileDto }>(
      "PATCH",
      "/me",
      {
        targetExamId: gce.id,
        targetTrackId: track,
        dailyGoalMinutes: 45,
        onboardingCompleted: true,
        programSettings: { subjects: trackSubjects.slice(0, 4) },
      },
      user,
    );
    expect(profile.onboardingCompleted).toBe(true);
    expect(profile.canChangeProgram).toBe(false);
    const d = await call<DashboardDto>("GET", "/me/dashboard", undefined, user);
    expect(d.recommendations.every((r) => r.reason === "not_started")).toBe(true);
    expect(d.streak.currentDays).toBe(0);
  });

  it("rejects signed-out calls", async () => {
    await expect(call("GET", "/me/dashboard", undefined, null)).rejects.toMatchObject({ status: 401 });
  });
});

describe("demo messaging", () => {
  type Conversations = { conversations: import("@eduprep/core").ConversationDto[] };
  type Messages = { messages: import("@eduprep/core").MessageDto[]; hasMore: boolean };
  const send = (conversationId: string, body: string, user = demo) =>
    call<{ message: import("@eduprep/core").MessageDto }>("POST", `/conversations/${conversationId}/messages`, { clientMessageId: crypto.randomUUID(), body }, user);

  it("seeds a support chat and an unread message from a study friend", async () => {
    const { conversations } = await call<Conversations>("GET", "/conversations");
    expect(conversations.map((c) => c.kind)).toEqual(["support", "direct"]);
    expect(conversations[1]!.peer?.displayName).toBe("Paul");
    expect(conversations[1]!.unreadCount).toBe(1);
    const { messages } = await call<Messages>("GET", `/conversations/${conversations[0]!.id}/messages`);
    expect(messages[0]!.sender?.verified).toBe(true);
  });

  it("answers support messages from a verified team member after a short delay", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-09-26T10:00:00Z"));
      const { conversationId } = await call<{ conversationId: string }>("POST", "/conversations/support");
      const sent = await send(conversationId, "Comment calculer un module ?");
      expect(sent.message.mine).toBe(true);
      let page = await call<Messages>("GET", `/conversations/${conversationId}/messages`);
      expect(page.messages.at(-1)!.mine).toBe(true);

      vi.setSystemTime(new Date("2026-09-26T10:00:05Z"));
      page = await call<Messages>("GET", `/conversations/${conversationId}/messages`);
      const reply = page.messages.at(-1)!;
      expect(reply.mine).toBe(false);
      expect(reply.sender?.verified).toBe(true);
      expect(reply.sender?.role).toBe("admin");
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens chats by friend code and rejects bad codes", async () => {
    const { conversations } = await call<Conversations>("GET", "/conversations");
    const seeded = conversations.find((c) => c.kind === "direct")!;
    const opened = await call<{ conversationId: string }>("POST", "/conversations/direct", { friendCode: " bac-4me " });
    expect(opened.conversationId).toBe(seeded.id);
    await expect(call("POST", "/conversations/direct", { friendCode: "ZZZZ99" })).rejects.toMatchObject({ status: 404 });
    await expect(call("POST", "/conversations/direct", { friendCode: "AMNA27" })).rejects.toMatchObject({ status: 422 });
  });

  it("lets two local accounts message each other", async () => {
    const other = crypto.randomUUID();
    ensureDemoUserState(other, "Brenda", "en");
    const { profile } = await call<{ profile: ProfileDto }>("GET", "/me", undefined, other);
    const { conversationId } = await call<{ conversationId: string }>("POST", "/conversations/direct", { friendCode: profile.friendCode });
    await send(conversationId, "Hi Brenda, shall we revise together?");
    const inbox = await call<Conversations>("GET", "/conversations", undefined, other);
    expect(inbox.conversations).toHaveLength(1);
    expect(inbox.conversations[0]!.peer?.displayName).toBe("Amina");
    expect(inbox.conversations[0]!.unreadCount).toBe(1);
    await call("POST", `/conversations/${conversationId}/read`, {}, other);
    expect((await call<Conversations>("GET", "/conversations", undefined, other)).conversations[0]!.unreadCount).toBe(0);
  });

  it("blocks, unblocks and reports", async () => {
    const { conversations } = await call<Conversations>("GET", "/conversations");
    const direct = conversations.find((c) => c.kind === "direct")!;
    const support = conversations.find((c) => c.kind === "support")!;
    await call("POST", `/users/${direct.peer!.id}/block`, {});
    expect((await call<{ conversation: { blocked: boolean } }>("GET", `/conversations/${direct.id}`)).conversation.blocked).toBe(true);
    await expect(send(direct.id, "hello?")).rejects.toMatchObject({ status: 403 });
    await call("POST", `/users/${direct.peer!.id}/unblock`, {});
    await expect(send(direct.id, "sorry, unblocked")).resolves.toBeTruthy();

    const teamMessage = (await call<Messages>("GET", `/conversations/${support.id}/messages`)).messages[0]!;
    await expect(call("POST", `/users/${teamMessage.sender!.id}/block`, {})).rejects.toMatchObject({ status: 422 });

    const { messages } = await call<Messages>("GET", `/conversations/${direct.id}/messages`);
    const theirs = messages.find((m) => !m.mine)!;
    const mine = messages.find((m) => m.mine)!;
    await expect(call("POST", `/messages/${theirs.id}/report`, { reason: "spam" })).resolves.toEqual({ ok: true });
    await expect(call("POST", `/messages/${mine.id}/report`, {})).rejects.toMatchObject({ status: 422 });
  });

  it("is idempotent on retries and rate-limits floods", async () => {
    const { conversationId } = await call<{ conversationId: string }>("POST", "/conversations/support");
    const clientMessageId = crypto.randomUUID();
    const a = await call<{ message: { id: string } }>("POST", `/conversations/${conversationId}/messages`, { clientMessageId, body: "once" });
    const b = await call<{ message: { id: string } }>("POST", `/conversations/${conversationId}/messages`, { clientMessageId, body: "once" });
    expect(b.message.id).toBe(a.message.id);
    for (let i = 0; i < 19; i++) await send(conversationId, `msg ${i}`);
    await expect(send(conversationId, "one too many")).rejects.toMatchObject({ status: 429 });
  }, 20000);
});

describe("program lock and program settings", () => {
  it("locks the exam once onboarding is done", async () => {
    const { exams } = await call<{ exams: ExamDto[] }>("GET", "/exams", undefined, null);
    const gce = exams.find((e) => e.slug === "cm-gce-a-level")!;
    const me = await call<{ profile: ProfileDto }>("GET", "/me");
    expect(me.profile.canChangeProgram).toBe(false);
    await expect(call("PATCH", "/me", { targetExamId: gce.id, targetTrackId: gce.tracks[0]!.id })).rejects.toMatchObject({
      status: 403,
      code: "program_locked",
    });
    await expect(call("PATCH", "/me", { onboardingCompleted: false })).rejects.toMatchObject({ status: 403 });
    // Other settings still work.
    const updated = await call<{ profile: ProfileDto }>("PATCH", "/me", { dailyGoalMinutes: 60 });
    expect(updated.profile.dailyGoalMinutes).toBe(60);
  });

  it("uses a target average for BAC and validates it", async () => {
    const me = await call<{ profile: ProfileDto }>("GET", "/me");
    expect(me.profile.programSettings).toEqual({ targetAverage: 14 });
    const { profile } = await call<{ profile: ProfileDto }>("PATCH", "/me", { programSettings: { targetAverage: 16 } });
    expect(profile.programSettings).toEqual({ targetAverage: 16 });
    await expect(call("PATCH", "/me", { programSettings: { targetAverage: 25 } })).rejects.toMatchObject({ status: 422 });
    const { exams } = await call<{ exams: ExamDto[] }>("GET", "/exams", undefined, null);
    expect(exams.find((e) => e.slug === "cm-bac")!.program.kind).toBe("average");
  });

  it("shows GCE learners only the subjects they chose, with target grades", async () => {
    const user = crypto.randomUUID();
    ensureDemoUserState(user, "Paul", "en");
    const gceExam = content.exams.find((e) => e.slug === "cm-gce-a-level")!;
    const science = gceExam.tracks.find((t) => t.slug === "science")!;
    const subjectIds = science.subjects.map((x) => x.subjectId);
    const [maths, physics] = [subjectIds[0]!, subjectIds[1]!];
    await call(
      "PATCH",
      "/me",
      {
        targetExamId: gceExam.id,
        targetTrackId: science.id,
        onboardingCompleted: true,
        programSettings: { subjects: [maths, physics], targetGrades: { [maths]: "A", [physics]: "B" } },
      },
      user,
    );
    const d = await call<DashboardDto>("GET", "/me/dashboard", undefined, user);
    expect(d.subjects.map((x) => x.id).sort()).toEqual([maths, physics].sort());
    expect(d.subjects.find((x) => x.id === maths)!.targetGrade).toBe("A");
    // Chemistry was not chosen, so its chapter is never recommended.
    const chemistryChapters = content.chapters.filter((c) => c.trackId === science.id && !([maths, physics] as string[]).includes(c.subjectId));
    expect(chemistryChapters.length).toBeGreaterThan(0);
    expect(d.recommendations.some((r) => chemistryChapters.some((c) => c.id === r.chapterId))).toBe(false);

    await expect(
      call("PATCH", "/me", { programSettings: { subjects: [maths] } }, user),
    ).rejects.toMatchObject({ status: 422, code: "invalid_program_settings" });
  });
});
