import { idParam, learnerRoute, preflight } from "@/server/http";
import { loadTrackState, subjectSummaries } from "@/server/learner/curriculum";

export const GET = learnerRoute<{ trackId: string }>(async ({ db, userId, now }, _req, params) => {
  const state = await loadTrackState(db, userId, idParam(params.trackId, "Track"));
  return { subjects: subjectSummaries(state, now) };
});

export const OPTIONS = preflight;
