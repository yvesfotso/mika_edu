import { ActionForm } from "@/components/action-form";
import { Card, Field, inputClass, LocalizedInputs, PageHeader } from "@/components/ui";
import { createSubject } from "@/server/cms/actions";
import { must } from "@/server/db";
import { requireStaffPage } from "@/server/staff";

export default async function SubjectsPage() {
  const { db } = await requireStaffPage(["admin"]);
  const subjects = must(await db.from("subjects").select("id, slug, name, icon").order("slug"), "loading subjects") as {
    id: string;
    slug: string;
    name: Record<string, string>;
    icon: string | null;
  }[];

  return (
    <>
      <PageHeader title="Subjects" description="Shared across exams; each track sets its own coefficients." />
      <Card>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="pb-2 font-medium">Slug</th>
              <th className="pb-2 font-medium">English</th>
              <th className="pb-2 font-medium">Français</th>
              <th className="pb-2 font-medium">Icon</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="py-2 font-mono text-xs">{s.slug}</td>
                <td className="py-2">{s.name.en ?? "—"}</td>
                <td className="py-2">{s.name.fr ?? "—"}</td>
                <td className="py-2">{s.icon ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Add a subject">
        <ActionForm action={createSubject} submitLabel="Create subject">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Slug">
              <input name="slug" required pattern="[a-z0-9-]+" className={inputClass} />
            </Field>
            <Field label="Icon" hint="Icon name used by the mobile app, e.g. calculator, atom, flask, leaf, book.">
              <input name="icon" className={inputClass} />
            </Field>
          </div>
          <LocalizedInputs name="name" label="Name" required />
        </ActionForm>
      </Card>
    </>
  );
}
