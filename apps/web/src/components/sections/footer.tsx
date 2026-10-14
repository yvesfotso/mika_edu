import Link from "next/link";
import type { Dictionary } from "@/content/dictionary";
import { PHOTOS } from "@/lib/site";
import { Logo } from "../logo";
import { Container } from "../ui";

export function Footer({ d }: { d: Dictionary }) {
  const nav = d.nav;
  const links = [
    ["#features", nav.features],
    ["#exams", nav.exams],
    ["#how", nav.how],
    ["#community", nav.community],
    ["#faq", nav.faq],
  ] as const;
  const photos = Object.values(PHOTOS);
  return (
    <footer className="overflow-hidden pt-16">
      <Container>
        <div className="grid gap-10 border-t border-line pt-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div className="flex flex-col items-start gap-4">
            <Logo />
            <p className="max-w-[340px] text-[15px] leading-relaxed text-muted">{d.footer.tagline}</p>
          </div>
          <nav aria-label={d.footer.product}>
            <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink">{d.footer.product}</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {links.map(([href, label]) => (
                <li key={href}>
                  <a href={href} className="text-[15px] text-muted transition-colors hover:text-ink">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink">{d.footer.language}</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              <li>
                <Link href="/en" hrefLang="en" lang="en" className="text-[15px] text-muted transition-colors hover:text-ink">
                  English
                </Link>
              </li>
              <li>
                <Link href="/fr" hrefLang="fr" lang="fr" className="text-[15px] text-muted transition-colors hover:text-ink">
                  Français
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 text-[13px] text-muted lg:flex-row lg:justify-between">
          <p>
            © {new Date().getFullYear()} {d.footer.rights}
          </p>
          <p className="max-w-[760px] lg:text-right">
            {d.footer.photos}{" "}
            {photos.map((p, i) => (
              <span key={p.page}>
                <a href={p.page} className="underline decoration-line underline-offset-2 hover:text-ink" rel="noopener" target="_blank">
                  {p.author}
                </a>
                {i < photos.length - 1 ? ", " : "."}
              </span>
            ))}
          </p>
        </div>
      </Container>
      <p aria-hidden="true" className="display mt-8 select-none text-center text-[clamp(5rem,24vw,22rem)] leading-[0.78] text-strong/[0.06]">
        EduPrep
      </p>
    </footer>
  );
}
