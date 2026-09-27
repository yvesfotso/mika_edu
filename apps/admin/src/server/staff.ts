import "server-only";
import { isStaff, type UserRole } from "@eduprep/core";
import { redirect } from "next/navigation";
import { cache } from "react";
import { sessionClient } from "@/lib/supabase/server";
import { ApiError, serviceDb, type Db } from "./db";

export interface StaffContext {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  db: Db;
}

/** The signed-in staff member, or null. Cached per request. */
export const currentStaff = cache(async (): Promise<StaffContext | null> => {
  const supabase = await sessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = serviceDb();
  const { data: profile } = await db
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .maybeSingle<{ role: UserRole; display_name: string | null }>();
  if (!profile || !isStaff(profile.role)) return null;
  return { userId: user.id, email: user.email ?? null, displayName: profile.display_name, role: profile.role, db };
});

/** For pages: redirect away unless the user has one of the roles. */
export async function requireStaffPage(roles?: UserRole[]): Promise<StaffContext> {
  const staff = await currentStaff();
  if (!staff) redirect("/login?error=forbidden");
  if (roles && !roles.includes(staff.role)) redirect("/?error=forbidden");
  return staff;
}

/** For server actions: throw instead of redirecting so the form can show the error. */
export async function requireStaffAction(roles?: UserRole[]): Promise<StaffContext> {
  const staff = await currentStaff();
  if (!staff) throw new ApiError(401, "unauthenticated", "Your session has expired. Sign in again.");
  if (roles && !roles.includes(staff.role)) {
    throw new ApiError(403, "forbidden", "You don't have permission to do this.");
  }
  return staff;
}

export async function audit(
  staff: StaffContext,
  action: string,
  entity: string,
  entityId: string | null,
  payload?: unknown,
): Promise<void> {
  const { error } = await staff.db.from("audit_logs").insert({
    actor_id: staff.userId,
    action,
    entity,
    entity_id: entityId,
    payload: payload ?? null,
  });
  if (error) console.error("[audit] failed to write audit log", error);
}
