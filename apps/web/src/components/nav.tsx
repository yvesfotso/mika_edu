"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Dictionary } from "@/content/dictionary";
import type { Locale } from "@/content/locales";
import type { AppLinks } from "@/lib/site";
import { Icon } from "./icons";
import { Logo } from "./logo";

export function Nav({ t, lang, app }: { t: Dictionary["nav"]; lang: Locale; app: AppLinks }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const links = [
    ["#features", t.features],
    ["#exams", t.exams],
    ["#how", t.how],
    ["#community", t.community],
    ["#faq", t.faq],
  ] as const;
  const other = lang === "en" ? "fr" : "en";

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-3 sm:px-6 sm:pt-4">
      <nav
        aria-label="Main"
        className={`mx-auto flex max-w-[1240px] items-center gap-3 rounded-full border py-2 pl-3 pr-2 transition-[background-color,box-shadow,border-color] duration-300 sm:pl-4 ${
          scrolled || open ? "border-line bg-card/85 shadow-[0_12px_40px_-20px_rgb(23_23_31/0.35)] backdrop-blur-xl" : "border-transparent bg-transparent"
        }`}
      >
        <Link href={`/${lang}`} aria-label={t.home} className="mr-auto rounded-full">
          <Logo />
        </Link>
        <ul className="hidden items-center gap-1 lg:flex">
          {links.map(([href, label]) => (
            <li key={href}>
              <a href={href} className="rounded-full px-3.5 py-2 text-[14px] font-medium text-muted transition-colors hover:bg-paper hover:text-ink">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <Link
          href={`/${other}`}
          hrefLang={other}
          lang={other}
          aria-label={t.switchLabel}
          title={t.switchLabel}
          className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-ink transition-colors hover:bg-paper lg:ml-2"
        >
          <Icon name="globe" size={16} />
          {t.switchShort}
        </Link>
        {app.signIn && (
          <a href={app.signIn} className="hidden h-10 items-center rounded-full px-3.5 text-[14px] font-semibold text-ink transition-colors hover:bg-paper sm:flex">
            {t.signIn}
          </a>
        )}
        <a
          href={app.signUp}
          className="hidden h-11 items-center gap-2 rounded-full bg-strong pl-5 pr-1.5 text-[14px] font-semibold text-white transition-transform hover:-translate-y-px sm:flex"
        >
          {t.cta}
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-strong">
            <Icon name="arrowUpRight" size={16} strokeWidth={2.4} />
          </span>
        </a>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? t.close : t.menu}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-strong text-white lg:hidden"
        >
          <Icon name={open ? "x" : "menu"} size={20} />
        </button>
      </nav>
      <div
        id="mobile-menu"
        hidden={!open}
        className="mx-auto mt-2 max-w-[1240px] rounded-[28px] border border-line bg-card p-3 shadow-[0_24px_60px_-30px_rgb(23_23_31/0.45)] lg:hidden"
      >
        <ul className="flex flex-col">
          {links.map(([href, label]) => (
            <li key={href}>
              <a href={href} onClick={() => setOpen(false)} className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-[16px] font-semibold text-ink hover:bg-paper">
                {label}
                <Icon name="chevronRight" size={18} className="text-app-muted" />
              </a>
            </li>
          ))}
        </ul>
        {app.signIn && (
          <a
            href={app.signIn}
            className="mt-2 flex h-13 items-center justify-center rounded-full border border-line text-[15px] font-semibold text-ink sm:hidden"
          >
            {t.signIn}
          </a>
        )}
        <a
          href={app.signUp}
          onClick={() => setOpen(false)}
          className="mt-2 flex h-13 items-center justify-center gap-2 rounded-full bg-lime text-[15px] font-bold text-strong"
        >
          {t.cta} <Icon name="arrowRight" size={18} />
        </a>
      </div>
    </header>
  );
}
