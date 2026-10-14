import { idParam, learnerRoute, preflight } from "@/server/http";
import { chaptersForSubject, loadLearnerTrack } from "@/server/learner/curriculum";
import { getProfileRow } from "@/server/learner/profile";

export const GET = learnerRoute<{ trackId: string; subjectId: string }>(async ({ db, userId, now }, _req, params) => {
  const profile = await getProfileRow(db, userId);
  const { track, learning } = await loadLearnerTrack(db, profile, idParam(params.trackId, "Track"), now);
  const subjectId = idParam(params.subjectId, "Subject");
  const subject = track.subjects.find((s) => s.subjects.id === subjectId)?.subjects;
  return {
    subject: subject ? { id: subject.id, name: subject.name, icon: subject.icon } : null,
    chapters: chaptersForSubject(track, subjectId, now, learning),
  };
});

export const OPTIONS = preflight;
