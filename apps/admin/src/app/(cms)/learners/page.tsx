import type { ProgramSettings } from "@eduprep/core";
import { ActionForm } from "@/components/action-form";
import { Card, Empty, Field, inputClass, PageHeader, secondaryButtonClass, t } from "@/components/ui";
import { reassignProgram, startSupportChat } from "@/server/cms/actions";
import { must } from "@/server/db";
import { requireStaffPage } from "@/server/staff";

type L = Record<string, string>;

export default async function LearnersPage({ searchParams }: PageProps<"/learners">) {
  const { q } = await searchParams;
  const staff = await requireStaffPage();
  const term = typeof q === "string" ? q.trim() : "";

  let query = staff.db
    .from("profiles")
    .select("id, display_name, friend_code, onboarding_completed, program_settings, created_at, target_exam_id, target_track_id")
    .eq("role", "student")
    .order("created_at", { ascending: false })
    .limit(50);
  if (term) {
    // Friend codes are exact; names match partially. Commas and parentheses would break the filter syntax.
    const safe = term.replace(/[,()*%]/g, " ");
    query = query.or(`display_name.ilike.%${safe}%,friend_code.eq.${safe.toUpperCase()}`);
  }

  const [learnersRes, examsRes, subjectsRes] = await Promise.all([
    query,
    staff.db.from("exams").select("id, name, exam_tracks(id, name, order_index)").order("slug"),
    staff.db.from("subjects").select("id, name"),
  ]);
  const learners = must(learnersRes, "loading learners") as {
    id: string;
    display_name: string | null;
    friend_code: string;
    onboarding_completed: boolean;
    program_settings: ProgramSettings | null;
    created_at: string;
    target_exam_id: string | null;
    target_track_id: string | null;
  }[];
  const exams = must(examsRes, "loading exams") as { id: string; name: L; exam_tracks: { id: string; name: L; order_index: number }[] }[];
  const subjectName = new Map((must(subjectsRes, "loading subjects") as { id: string; name: L }[]).map((s) => [s.id, t(s.name)]));
  const trackName = new Map(exams.flatMap((e) => e.exam_tracks.map((tr) => [tr.id, `${t(e.name)} · ${t(tr.name)}`] as const)));
  const programOptions = exams.flatMap((e) =>
    [...e.exam_tracks].sort((a, b) => a.order_index - b.order_index).map((tr) => ({ value: `${e.id}:${tr.id}`, label: `${t(e.name)} · ${t(tr.name)}` })),
  );

  const describeSettings = (s: ProgramSettings | null) => {
    if (!s) return "—";
    if (s.subjects?.length) {
      return s.subjects.map((id) => `${subjectName.get(id) ?? "?"}${s.targetGrades?.[id] ? ` (${s.targetGrades[id]})` : ""}`).join(", ");
    }
    if (s.targetAverage !== undefined) return `Target average ${s.targetAverage}/20`;
    return "—";
  };

  return (
    <>
      <PageHeader
        title="Learners"
        description="Learners can't change their exam after onboarding. When one asks (usually through the support inbox), an admin can move them here."
      />
      <form action="/learners" className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Search by name or friend code">
          <input name="q" defaultValue={term} className={inputClass} placeholder="Amina or AMNA27" />
        </Field>
        <button className={secondaryButtonClass}>Search</button>
      </form>
      <Card>
        {learners.length === 0 ? (
          <Empty>No learners found.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {learners.map((l) => (
              <li key={l.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {l.display_name ?? "—"} <span className="ml-1 font-mono text-xs text-slate-500">{l.friend_code}</span>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {l.target_track_id ? trackName.get(l.target_track_id) : "No exam yet"}
                      {l.onboarding_completed && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-700">🔒 locked</span>}
                    </div>
                    <div className="text-xs text-slate-500">Program settings: {describeSettings(l.program_settings)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-slate-500">Joined {new Date(l.created_at).toLocaleDateString("en-GB")}</div>
                    <form action={startSupportChat}>
                      <input type="hidden" name="studentId" value={l.id} />
                      <button className={secondaryButtonClass}>Message</button>
                    </form>
                  </div>
                </div>
                {staff.role === "admin" && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-indigo-600 dark:text-indigo-400">Change exam</summary>
                    <div className="mt-2 max-w-md">
                      <ActionForm action={reassignProgram} submitLabel="Move learner">
                        <input type="hidden" name="userId" value={l.id} />
                        <Field label="New exam and track" hint="The learner's subject choices and targets are reset.">
                          <select name="program" defaultValue={l.target_exam_id && l.target_track_id ? `${l.target_exam_id}:${l.target_track_id}` : ""} className={inputClass}>
                            {programOptions.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </ActionForm>
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
