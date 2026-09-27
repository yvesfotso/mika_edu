import { idParam, learnerRoute, preflight } from "@/server/http";
import { chaptersForSubject, loadTrackState } from "@/server/learner/curriculum";

export const GET = learnerRoute<{ trackId: string; subjectId: string }>(async ({ db, userId, now }, _req, params) => {
  const state = await loadTrackState(db, userId, idParam(params.trackId, "Track"));
  const subjectId = idParam(params.subjectId, "Subject");
  const subject = state.subjects.find((s) => s.subjects.id === subjectId)?.subjects;
  return {
    subject: subject ? { id: subject.id, name: subject.name, icon: subject.icon } : null,
    chapters: chaptersForSubject(state, subjectId, now),
  };
});

export const OPTIONS = preflight;
