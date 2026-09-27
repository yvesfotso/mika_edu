import { AutoRefresh } from "@/components/auto-refresh";
import { listSupportInbox } from "@/server/learner/messages";
import { requireStaffPage } from "@/server/staff";
import { ConversationList } from "./conversation-list";
import { InboxPanes } from "./inbox-panes";

export default async function InboxLayout({ children }: LayoutProps<"/inbox">) {
  const staff = await requireStaffPage();
  const threads = await listSupportInbox(staff.db);

  return (
    <>
      <div className="mb-6">
        <div className="mb-2 text-xs text-muted">
          <span className="font-medium text-ink">Portal</span> <span className="mx-1">›</span> Inbox
        </div>
        <h1 className="text-3xl font-medium tracking-tight text-ink">Inbox</h1>
      </div>
      <InboxPanes
        list={
          <ConversationList
            threads={threads.map((th) => ({
              id: th.id,
              name: th.student?.displayName ?? "Unknown learner",
              lastMessage: th.lastMessage,
              unread: th.unreadForStaff,
            }))}
          />
        }
      >
        {children}
      </InboxPanes>
      <AutoRefresh />
    </>
  );
}
