"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

function isActive(pathname: string, href: string, all: NavItem[]) {
  if (href === "/") return pathname === "/";
  if (!(pathname === href || pathname.startsWith(`${href}/`))) return false;
  // Prefer the most specific match (e.g. /questions/import over /questions).
  return !all.some((n) => n.href !== href && n.href.startsWith(href) && (pathname === n.href || pathname.startsWith(`${n.href}/`)));
}

export function NavPills({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 py-1">
      {items.map((n) => {
        const active = isActive(pathname, n.href, items);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm whitespace-nowrap transition ${
              active ? "bg-brand font-semibold text-brand-ink" : "border border-line bg-frame text-ink hover:bg-card"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
