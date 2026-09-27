"use client";

import { useActionState, type ReactNode } from "react";
import { initialActionState, type ActionState } from "@/server/cms/state";
import { buttonClass } from "./ui";

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <div role="alert" className="whitespace-pre-line rounded-md bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
        {state.error}
        {state.report && state.report.length > 0 && (
          <ul className="mt-2 list-disc pl-5">
            {state.report.slice(0, 50).map((r) => (
              <li key={r.row}>
                Row {r.row}: {r.errors.join("; ")}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  if (state.ok && state.message) {
    return (
      <div role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        {state.message}
      </div>
    );
  }
  return null;
}

export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  className = "space-y-4",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className={className}>
      {children}
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
