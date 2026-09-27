import { updateProfileSchema } from "@eduprep/core";
import { learnerRoute, preflight, readJson } from "@/server/http";
import { getProfile, updateProfile } from "@/server/learner/profile";

export const GET = learnerRoute(async ({ db, userId }) => ({ profile: await getProfile(db, userId) }));

export const PATCH = learnerRoute(async ({ db, userId }, request) => ({
  profile: await updateProfile(db, userId, await readJson(request, updateProfileSchema)),
}));

export const OPTIONS = preflight;
