import { Card, PageHeader } from "@/components/ui";
import { must } from "@/server/db";
import { requireStaffPage } from "@/server/staff";

export default async function AuditPage() {
  const { db } = await requireStaffPage(["admin"]);
  const rows = must(
    await db
      .from("audit_logs")
      .select("id, action, entity, entity_id, created_at, profiles(display_name)")
      .order("created_at", { ascending: false })
      .limit(200),
    "loading audit log",
  ) as unknown as {
    id: number;
    action: string;
    entity: string;
    entity_id: string | null;
    created_at: string;
    profiles: { display_name: string | null } | null;
  }[];

  return (
    <>
      <PageHeader title="Audit log" description="The last 200 staff actions." />
      <Card>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="pb-2 font-medium">When</th>
              <th className="pb-2 font-medium">Who</th>
              <th className="pb-2 font-medium">Action</th>
              <th className="pb-2 font-medium">Entity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="py-2 whitespace-nowrap tabular-nums">{new Date(r.created_at).toLocaleString("en-GB")}</td>
                <td className="py-2">{r.profiles?.display_name ?? "—"}</td>
                <td className="py-2 font-mono text-xs">{r.action}</td>
                <td className="py-2 font-mono text-xs">
                  {r.entity} {r.entity_id?.slice(0, 8)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
