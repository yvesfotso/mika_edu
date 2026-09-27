import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon } from "@/components/icons";
import { Avatar, iconButtonClass, t } from "@/components/ui";
import { ApiError, must } from "@/server/db";
import { loadSupportThread } from "@/server/learner/messages";
import { requireStaffPage } from "@/server/staff";
import { ChatThread } from "./chat-thread";

export default async function SupportThreadPage({ params }: PageProps<"/inbox/[conversationId]">) {
  const { conversationId } = await params;
  const staff = await requireStaffPage();
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) notFound();

  let thread;
  try {
    thread = await loadSupportThread(staff.db, staff.userId, conversationId, new Date());
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const profile = thread.student
    ? (must(
        await staff.db
          .from("profiles")
          .select("friend_code, exam_tracks(name), streaks(last_activity_date)")
          .eq("id", thread.student.id)
          .maybeSingle(),
        "loading learner",
      ) as unknown as {
        friend_code: string;
        exam_tracks: { name: Record<string, string> } | null;
        streaks: { last_activity_date: string | null } | null;
      } | null)
    : null;
  const name = thread.student?.displayName ?? "Unknown learner";
  const lastActive = profile?.streaks?.last_activity_date;

  return (
    <section className="flex h-[calc(100vh-13rem)] min-h-[520px] flex-col overflow-hidden rounded-4xl bg-card">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 md:px-6">
        <Link href="/inbox" aria-label="Back to conversations" className={`${iconButtonClass} rotate-180 lg:hidden`}>
          <ArrowRightIcon size={16} />
        </Link>
        <Avatar name={name} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-ink">{name}</div>
          <div className="truncate text-xs text-muted">
            {profile?.exam_tracks ? t(profile.exam_tracks.name) : "No track yet"}
            {profile && <> · <span className="font-mono">{profile.friend_code}</span></>}
            {lastActive && <> · last studied {new Date(`${lastActive}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</>}
          </div>
        </div>
        {profile && (
          <Link href={`/learners?q=${encodeURIComponent(profile.friend_code)}`} className="hidden rounded-full border border-line bg-frame px-4 py-2 text-sm text-ink hover:bg-panel sm:inline-flex">
            View learner
          </Link>
        )}
      </header>
      <ChatThread conversationId={thread.id} learnerName={name} messages={thread.messages} />
    </section>
  );
}
