import { learnerRoute, preflight } from "@/server/http";
import { listRecentAttempts } from "@/server/learner/attempts";

export const GET = learnerRoute(async ({ db, userId }) => ({ attempts: await listRecentAttempts(db, userId) }));

export const OPTIONS = preflight;
