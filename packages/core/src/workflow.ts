import type { ContentStatus, UserRole } from "./types";

type Transition = { from: ContentStatus; to: ContentStatus; roles: UserRole[] };

/** Draft → Review → Approved → Published, with rejection paths back to draft. */
const TRANSITIONS: Transition[] = [
  { from: "draft", to: "review", roles: ["teacher", "reviewer", "admin"] },
  { from: "review", to: "draft", roles: ["reviewer", "admin"] },
  { from: "review", to: "approved", roles: ["reviewer", "admin"] },
  { from: "approved", to: "draft", roles: ["reviewer", "admin"] },
  { from: "approved", to: "published", roles: ["admin"] },
  { from: "published", to: "draft", roles: ["admin"] },
  { from: "published", to: "archived", roles: ["admin"] },
  { from: "archived", to: "draft", roles: ["admin"] },
];

export const STAFF_ROLES: UserRole[] = ["teacher", "reviewer", "admin"];

export function isStaff(role: UserRole | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

export function allowedTransitions(status: ContentStatus, role: UserRole): ContentStatus[] {
  return TRANSITIONS.filter((t) => t.from === status && t.roles.includes(role)).map((t) => t.to);
}

export function canTransition(from: ContentStatus, to: ContentStatus, role: UserRole): boolean {
  return allowedTransitions(from, role).includes(to);
}

/** Teachers edit drafts, reviewers can fix content under review, admins can edit anything. */
export function canEdit(status: ContentStatus, role: UserRole): boolean {
  if (role === "admin") return true;
  if (role === "reviewer") return status === "draft" || status === "review";
  if (role === "teacher") return status === "draft";
  return false;
}
