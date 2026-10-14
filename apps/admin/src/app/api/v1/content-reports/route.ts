import { contentReportSchema } from "@eduprep/core";
import { learnerRoute, preflight, readJson } from "@/server/http";
import { reportContent } from "@/server/learner/reports";

export const POST = learnerRoute(async ({ db, userId }, request) => reportContent(db, userId, await readJson(request, contentReportSchema)));

export const OPTIONS = preflight;
