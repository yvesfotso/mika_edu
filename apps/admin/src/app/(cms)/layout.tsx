import { cookies } from "next/headers";
import Link from "next/link";
import { LogoMark, LogoutIcon, MailIcon, SearchIcon } from "@/components/icons";
import { SideNav, type NavItem } from "@/components/side-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, greeting, iconButtonClass } from "@/components/ui";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { requireStaffPage } from "@/server/staff";
import { signOut } from "@/server/cms/actions";

const NAV: (NavItem & { adminOnly?: boolean })[] = [
  { href: "/", label: "Overview", icon: "home" },
  { href: "/curriculum", label: "Curriculum", icon: "book" },
  { href: "/questions", label: "Question bank", icon: "question" },
  { href: "/questions/import", label: "Import", icon: "upload" },
  { href: "/past-papers", label: "Past papers", icon: "pdf" },
  { href: "/content-reports", label: "Content reports", icon: "question" },
  { href: "/inbox", label: "Inbox", icon: "mail" },
  { href: "/learners", label: "Learners", icon: "users" },
  { href: "/exams", label: "Exams", icon: "exam", adminOnly: true },
  { href: "/subjects", label: "Subjects", icon: "layers", adminOnly: true },
  { href: "/audit", label: "Audit log", icon: "shield", adminOnly: true },
];

export default async function CmsLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage();
  const name = staff.displayName ?? staff.email;
  const firstName = (name ?? "there").split(/[\s@]/)[0];
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <div className="min-h-screen md:p-5 lg:p-8">
      <div className="mx-auto flex min-h-screen max-w-[1520px] flex-col overflow-hidden bg-frame md:min-h-[calc(100vh-2.5rem)] md:flex-row md:rounded-[2rem] md:shadow-[0_30px_70px_-35px_rgba(23,23,31,0.45)] lg:min-h-[calc(100vh-4rem)]">
        {/* Sidebar: a vertical rail from md up, a top bar on phones. */}
        <aside className="flex shrink-0 items-center gap-3 bg-sidebar px-3 py-3 md:w-[84px] md:flex-col md:gap-8 md:px-0 md:py-6">
          <Link
            href="/"
            aria-label="EduPrep Admin home"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl text-brand ring-2 ring-brand/70"
          >
            <LogoMark size={22} />
          </Link>
          <div className="min-w-0 flex-1 md:flex-none">
            <SideNav items={NAV.filter((n) => !n.adminOnly || staff.role === "admin")} />
          </div>
          <form action={signOut} className="md:mt-auto">
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex size-11 items-center justify-center rounded-2xl bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
            >
              <LogoutIcon size={19} />
            </button>
          </form>
        </aside>

        <div className="min-w-0 flex-1 p-3 md:p-6">
          <header className="flex flex-wrap items-center gap-3 rounded-3xl bg-card px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold text-ink">
                {greeting(new Date())}, {firstName}
              </div>
              <div className="truncate text-xs text-muted">Let&apos;s help every learner get ready for exam day.</div>
            </div>
            <form action="/learners" role="search" className="hidden items-center gap-2 rounded-full bg-sidebar py-1 pr-1 pl-4 text-sm text-white sm:flex">
              <input
                name="q"
                aria-label="Search learners by name or friend code"
                placeholder="Search learners…"
                className="w-40 bg-transparent py-1.5 text-white placeholder:text-white/60 focus:outline-none"
              />
              <button type="submit" aria-label="Search" className="inline-flex size-8 items-center justify-center rounded-full bg-white text-ink">
                <SearchIcon size={15} />
              </button>
            </form>
            <ThemeToggle initial={theme} />
            <Link href="/inbox" aria-label="Inbox" className={iconButtonClass}>
              <MailIcon size={17} />
            </Link>
            <div className="flex items-center gap-2.5 pl-1" title={`${name} · ${staff.role}`}>
              <Avatar name={name} size={40} tone="brand" />
              <div className="hidden leading-tight lg:block">
                <div className="max-w-40 truncate text-sm font-semibold text-ink">{name}</div>
                <div className="text-xs text-muted capitalize">{staff.role}</div>
              </div>
            </div>
          </header>
          <main className="min-w-0 pt-5 md:pt-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
