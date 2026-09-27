import { allowedTransitions, type ContentStatus, type UserRole } from "@eduprep/core";
import { secondaryButtonClass } from "./ui";

const LABELS: Partial<Record<ContentStatus, string>> = {
  review: "Submit for review",
  approved: "Approve",
  published: "Publish",
  archived: "Archive",
  draft: "Back to draft",
};

/** Buttons for the workflow moves this role may make from the current status. */
export function StatusActions({
  id,
  status,
  role,
  action,
}: {
  id: string;
  status: ContentStatus;
  role: UserRole;
  action: (fd: FormData) => Promise<void>;
}) {
  const targets = allowedTransitions(status, role);
  if (targets.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {targets.map((to) => (
        <form key={to} action={action}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="to" value={to} />
          <button type="submit" className={secondaryButtonClass}>
            {LABELS[to] ?? to}
          </button>
        </form>
      ))}
    </div>
  );
}
