"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookIcon, ExamIcon, FileTextIcon, HomeIcon, LayersIcon, MailIcon, QuestionIcon, ShieldIcon, UploadIcon, UsersIcon } from "./icons";

const ICONS = {
  home: HomeIcon,
  book: BookIcon,
  question: QuestionIcon,
  upload: UploadIcon,
  pdf: FileTextIcon,
  mail: MailIcon,
  users: UsersIcon,
  exam: ExamIcon,
  layers: LayersIcon,
  shield: ShieldIcon,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

function isActive(pathname: string, href: string, all: NavItem[]) {
  if (href === "/") return pathname === "/";
  if (!(pathname === href || pathname.startsWith(`${href}/`))) return false;
  // Prefer the most specific match (e.g. /questions/import over /questions).
  return !all.some((n) => n.href !== href && n.href.startsWith(href) && (pathname === n.href || pathname.startsWith(`${n.href}/`)));
}

/** Icon rail for the dark sidebar: vertical from md up, a scrolling row on phones. Labels show on hover/focus. */
export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex min-w-0 gap-2 overflow-x-auto md:flex-col md:overflow-visible">
      {items.map((n) => {
        const active = isActive(pathname, n.href, items);
        const Icon = ICONS[n.icon];
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            aria-label={n.label}
            className={`group relative inline-flex size-11 shrink-0 items-center justify-center rounded-2xl transition ${
              active ? "bg-brand text-brand-ink" : "text-white/55 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon size={20} />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-[calc(100%+12px)] z-20 hidden rounded-full bg-sidebar px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-lg ring-1 ring-white/10 transition group-hover:opacity-100 group-focus-visible:opacity-100 md:block"
            >
              {n.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
