import Link from "next/link";
import { LogoMark, LogoutIcon, MailIcon, SearchIcon } from "@/components/icons";
import { NavPills } from "@/components/nav-pills";
import { Avatar, iconButtonClass } from "@/components/ui";
import { requireStaffPage } from "@/server/staff";
import { signOut } from "@/server/cms/actions";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/curriculum", label: "Curriculum" },
  { href: "/questions", label: "Question bank" },
  { href: "/questions/import", label: "Import" },
  { href: "/inbox", label: "Inbox" },
  { href: "/learners", label: "Learners" },
  { href: "/exams", label: "Exams", adminOnly: true },
  { href: "/subjects", label: "Subjects", adminOnly: true },
  { href: "/audit", label: "Audit log", adminOnly: true },
];

export default async function CmsLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage();
  const name = staff.displayName ?? staff.email;
  return (
    <div className="min-h-screen md:p-4">
      <div className="mx-auto min-h-screen max-w-[1480px] bg-frame md:min-h-[calc(100vh-2rem)] md:rounded-[2.25rem] md:shadow-[0_24px_60px_-30px_rgba(22,32,31,0.25)]">
        <header className="flex flex-wrap items-center gap-3 px-4 pt-4 md:px-7 md:pt-6">
          <Link
            href="/"
            aria-label="EduPrep Admin home"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink"
          >
            <LogoMark size={22} />
          </Link>
          <div className="order-last w-full min-w-0 lg:order-none lg:w-auto lg:flex-1">
            <NavPills items={NAV.filter((n) => !n.adminOnly || staff.role === "admin")} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <form action="/learners" role="search" className="hidden items-center gap-2 rounded-full bg-card px-4 text-sm text-muted sm:flex">
              <SearchIcon size={16} />
              <input
                name="q"
                aria-label="Search learners by name or friend code"
                placeholder="Search learners…"
                className="w-36 bg-transparent py-2.5 text-ink placeholder:text-muted focus:outline-none"
              />
            </form>
            <Link href="/inbox" aria-label="Inbox" className={iconButtonClass}>
              <MailIcon size={17} />
            </Link>
            <form action={signOut}>
              <button type="submit" aria-label="Sign out" title="Sign out" className={iconButtonClass}>
                <LogoutIcon size={17} />
              </button>
            </form>
            <div className="flex items-center gap-2 pl-1" title={`${name} · ${staff.role}`}>
              <Avatar name={name} size={40} tone="brand" />
            </div>
          </div>
        </header>
        <main className="min-w-0 px-4 py-6 md:px-7 md:py-8">{children}</main>
      </div>
    </div>
  );
}
