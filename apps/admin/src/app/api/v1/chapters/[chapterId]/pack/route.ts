import { idParam, learnerRoute, preflight } from "@/server/http";
import { getStudyPack } from "@/server/learner/packs";

export const GET = learnerRoute<{ chapterId: string }>(async ({ db, now }, _request, params) => ({
  pack: await getStudyPack(db, idParam(params.chapterId, "Chapter"), now),
}));

export const OPTIONS = preflight;
