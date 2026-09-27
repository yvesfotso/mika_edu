import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import { Avatar, buttonClass, Empty, secondaryButtonClass, t } from "@/components/ui";
import { startSupportChat } from "@/server/cms/actions";
import { must } from "@/server/db";
import { requireStaffPage } from "@/server/staff";

export const metadata: Metadata = { title: "New chat" };

export default async function NewChatPage({ searchParams }: PageProps<"/inbox/new">) {
  const { q } = await searchParams;
  const staff = await requireStaffPage();
  const term = typeof q === "string" ? q.trim() : "";

  let query = staff.db
    .from("profiles")
    .select("id, display_name, friend_code, exam_tracks(name)")
    .eq("role", "student")
    .order("display_name")
    .limit(30);
  if (term) {
    // Commas and parentheses would break the filter syntax.
    const safe = term.replace(/[,()*%]/g, " ");
    query = query.or(`display_name.ilike.%${safe}%,friend_code.eq.${safe.toUpperCase()}`);
  }
  const learners = must(await query, "loading learners") as unknown as {
    id: string;
    display_name: string | null;
    friend_code: string;
    exam_tracks: { name: Record<string, string> } | null;
  }[];

  return (
    <section className="flex h-[calc(100vh-13rem)] min-h-[520px] flex-col rounded-4xl bg-card p-5 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-muted">New chat</div>
          <h2 className="text-xl font-medium text-ink">Who do you want to message?</h2>
        </div>
        <Link href="/inbox" className={secondaryButtonClass}>
          Cancel
        </Link>
      </div>
      <form action="/inbox/new" className="mb-4 flex items-center gap-2 rounded-full bg-frame px-4 text-sm text-muted">
        <SearchIcon size={16} />
        <input
          name="q"
          defaultValue={term}
          autoFocus
          placeholder="Search by name or friend code"
          aria-label="Search learners"
          className="w-full bg-transparent py-3 text-ink placeholder:text-muted focus:outline-none"
        />
      </form>
      <div className="-mx-1 flex-1 overflow-y-auto px-1">
        {learners.length === 0 ? (
          <Empty>No learners found.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {learners.map((l, i) => (
              <li key={l.id} className="flex items-center gap-3 rounded-2xl bg-frame p-2.5 pr-3">
                <Avatar name={l.display_name} size={42} tone={i % 2 ? "brand" : "ocean"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{l.display_name ?? "Unnamed learner"}</div>
                  <div className="truncate text-xs text-muted">
                    {l.exam_tracks ? t(l.exam_tracks.name) : "No track yet"} · <span className="font-mono">{l.friend_code}</span>
                  </div>
                </div>
                <form action={startSupportChat}>
                  <input type="hidden" name="studentId" value={l.id} />
                  <button className={`${buttonClass} px-4 py-2`}>Message</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
