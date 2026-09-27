import { learnerRoute, preflight } from "@/server/http";
import { getDashboard } from "@/server/learner/dashboard";

export const GET = learnerRoute(async ({ db, userId, now }) => getDashboard(db, userId, now));

export const OPTIONS = preflight;
