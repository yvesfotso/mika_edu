import { z } from "zod";
import { learnerRoute, preflight } from "@/server/http";
import { listMistakes } from "@/server/learner/mistakes";

const filterSchema = z.object({
  status: z.enum(["open", "recovered", "all"]).default("all"),
  chapterId: z.uuid().optional(),
});

export const GET = learnerRoute(async ({ db, userId }, request) => {
  const params = new URL(request.url).searchParams;
  const filter = filterSchema.parse({ status: params.get("status") ?? undefined, chapterId: params.get("chapterId") ?? undefined });
  return listMistakes(db, userId, filter);
});

export const OPTIONS = preflight;
