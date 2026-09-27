export interface ActionState {
  ok: boolean;
  message?: string;
  error?: string;
  report?: { row: number; errors: string[] }[];
}

export const initialActionState: ActionState = { ok: false };
