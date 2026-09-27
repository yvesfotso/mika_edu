import Link from "next/link";
import { MailIcon, PlusIcon } from "@/components/icons";
import { buttonClass, Card, Empty, secondaryButtonClass } from "@/components/ui";
import { resolveReport } from "@/server/cms/actions";
import { listOpenReports } from "@/server/learner/messages";
import { requireStaffPage } from "@/server/staff";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function InboxPage() {
  const staff = await requireStaffPage();
  const reports = staff.role === "teacher" ? [] : await listOpenReports(staff.db);

  return (
    <div className="space-y-5">
      <section className="flex min-h-[320px] flex-col items-center justify-center rounded-4xl bg-card p-8 text-center">
        <span className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-ocean text-white">
          <MailIcon size={28} />
        </span>
        <h2 className="text-xl font-medium text-ink">Chat with your learners</h2>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Pick a conversation on the left, or start a new one. Learners see your replies in the app with a verified badge.
        </p>
        <Link href="/inbox/new" className={`${buttonClass} mt-5`}>
          <PlusIcon size={16} /> New chat
        </Link>
      </section>

      {staff.role !== "teacher" && (
        <Card title="Reported messages">
          {reports.length === 0 ? (
            <Empty>No open reports.</Empty>
          ) : (
            <ul className="space-y-3">
              {reports.map((r) => (
                <li key={r.id} className="rounded-3xl bg-frame p-4 text-sm">
                  <div className="mb-2 text-xs text-muted">
                    {r.reporter} reported a message from <strong className="text-ink">{r.sender}</strong> · {when(r.createdAt)}
                  </div>
                  <blockquote className="border-l-4 border-rose-300 pl-3 text-ink">{r.body}</blockquote>
                  {r.reason && <div className="mt-1 text-xs text-muted">Reason: {r.reason}</div>}
                  <form action={resolveReport} className="mt-3">
                    <input type="hidden" name="id" value={r.id} />
                    <button className={secondaryButtonClass}>Mark resolved</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
