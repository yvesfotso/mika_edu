"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { Avatar } from "@/components/ui";

export interface ThreadItem {
  id: string;
  name: string;
  lastMessage: { body: string; createdAt: string; fromStudent: boolean } | null;
  unread: number;
}

export function shortTime(iso: string, now = new Date()) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function ConversationList({ threads }: { threads: ThreadItem[] }) {
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = term ? threads.filter((th) => th.name.toLowerCase().includes(term) || th.lastMessage?.body.toLowerCase().includes(term)) : threads;
  const awaiting = threads.filter((th) => th.lastMessage?.fromStudent).length;

  return (
    <section className="flex h-[calc(100vh-13rem)] min-h-[520px] flex-col rounded-4xl bg-panel p-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-medium text-ink">Messages</h2>
          <p className="text-xs text-muted">{awaiting ? `${awaiting} awaiting a reply` : "All caught up"}</p>
        </div>
        <Link
          href="/inbox/new"
          aria-label="New chat"
          title="New chat"
          className="inline-flex size-10 items-center justify-center rounded-full bg-brand text-brand-ink transition hover:brightness-95"
        >
          <PlusIcon size={18} />
        </Link>
      </div>
      <label className="mb-3 flex items-center gap-2 rounded-full bg-frame px-4 text-sm text-muted">
        <SearchIcon size={16} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search conversations…"
          aria-label="Search conversations"
          className="w-full bg-transparent py-2.5 text-ink placeholder:text-muted focus:outline-none"
        />
      </label>

      <ul className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
        {shown.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-muted">
            {threads.length === 0 ? "No conversations yet. Start one with the + button." : "No matches."}
          </li>
        )}
        {shown.map((th) => {
          const active = pathname === `/inbox/${th.id}`;
          return (
            <li key={th.id}>
              <Link
                href={`/inbox/${th.id}`}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-2xl p-2.5 transition ${active ? "bg-ocean-soft" : "hover:bg-frame"}`}
              >
                <Avatar name={th.name} size={42} tone={th.unread ? "brand" : "ocean"} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-sm text-ink ${th.unread ? "font-semibold" : "font-medium"}`}>{th.name}</span>
                    {th.lastMessage && <span className="shrink-0 text-[11px] text-muted">{shortTime(th.lastMessage.createdAt)}</span>}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className={`min-w-0 flex-1 truncate text-xs ${th.unread ? "text-ink" : "text-muted"}`}>
                      {th.lastMessage ? `${th.lastMessage.fromStudent ? "" : "You: "}${th.lastMessage.body}` : "No messages yet"}
                    </span>
                    {th.unread > 0 ? (
                      <span className="inline-flex min-w-5 shrink-0 justify-center rounded-full bg-brand px-1.5 text-[11px] leading-5 font-semibold text-brand-ink">
                        {th.unread}
                      </span>
                    ) : (
                      th.lastMessage?.fromStudent && <span className="size-2 shrink-0 rounded-full bg-amber-500" title="Awaiting reply" />
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
