import { sendMessageSchema } from "@eduprep/core";
import { z } from "zod";
import { idParam, learnerRoute, preflight, readJson } from "@/server/http";
import { listMessagesForMember, sendMessage } from "@/server/learner/messages";

const beforeSchema = z.iso.datetime({ offset: true }).optional();

export const GET = learnerRoute<{ conversationId: string }>(async ({ db, userId }, request, params) => {
  const before = beforeSchema.parse(new URL(request.url).searchParams.get("before") ?? undefined);
  return listMessagesForMember(db, userId, idParam(params.conversationId, "Conversation"), before);
});

export const POST = learnerRoute<{ conversationId: string }>(async ({ db, userId, now }, request, params) => ({
  message: await sendMessage(db, userId, idParam(params.conversationId, "Conversation"), await readJson(request, sendMessageSchema), now),
}));

export const OPTIONS = preflight;
