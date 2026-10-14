import type { ProgressDto } from "@eduprep/core";
import { learnerRoute, preflight } from "@/server/http";
import { loadLearnerTrack } from "@/server/learner/curriculum";
import { progressDto } from "@/server/learner/learning";
import { getProfileRow } from "@/server/learner/profile";

export const GET = learnerRoute(async ({ db, userId, now }): Promise<ProgressDto> => {
  const profile = await getProfileRow(db, userId);
  if (!profile.target_track_id) return { subjects: [], totals: { not_assessed: 0, learning: 0, needs_review: 0, mastered: 0 } };
  const { learning } = await loadLearnerTrack(db, profile, profile.target_track_id, now);
  return progressDto(learning);
});

export const OPTIONS = preflight;
