import { idParam, learnerRoute, preflight } from "@/server/http";
import { loadLearnerTrack, subjectSummaries } from "@/server/learner/curriculum";
import { getProfileRow } from "@/server/learner/profile";

export const GET = learnerRoute<{ trackId: string }>(async ({ db, userId, now }, _req, params) => {
  const profile = await getProfileRow(db, userId);
  const { track, learning } = await loadLearnerTrack(db, profile, idParam(params.trackId, "Track"), now);
  return { subjects: subjectSummaries(track, now, learning) };
});

export const OPTIONS = preflight;
