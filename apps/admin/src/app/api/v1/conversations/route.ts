import { learnerRoute, preflight } from "@/server/http";
import { listConversations } from "@/server/learner/messages";

export const GET = learnerRoute(async ({ db, userId }) => ({ conversations: await listConversations(db, userId) }));

export const OPTIONS = preflight;
