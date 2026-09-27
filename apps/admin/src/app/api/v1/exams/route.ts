import { serviceDb } from "@/server/db";
import { preflight, publicRoute } from "@/server/http";
import { listExams } from "@/server/learner/dashboard";

export const GET = publicRoute(async () => ({ exams: await listExams(serviceDb()) }));

export const OPTIONS = preflight;
