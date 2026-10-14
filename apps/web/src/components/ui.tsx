import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import type { Locale } from "@/content/locales";
import type { Photo as PhotoData } from "@/lib/site";
import { Icon } from "./icons";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1240px] px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function Kicker({ children, dark = false, onCard = false }: { children: ReactNode; dark?: boolean; onCard?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold uppercase tracking-[0.08em] ${
        dark ? "bg-white/10 text-lime" : onCard ? "bg-paper text-ink" : "bg-card text-ink"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dark ? "bg-lime" : "bg-drop"}`} />
      {children}
    </span>
  );
}

/** Kicker + title on the left, lead on the right (stacked on small screens). */
export function SectionHeader({
  id,
  kicker,
  title,
  lead,
  dark = false,
  center = false,
  onCard = false,
}: {
  id?: string;
  kicker: string;
  title: string;
  lead?: string;
  dark?: boolean;
  center?: boolean;
  /** Set when the header sits on a white card, so the kicker pill stays visible. */
  onCard?: boolean;
}) {
  if (center) {
    return (
      <div data-reveal className="mx-auto flex max-w-[760px] flex-col items-center gap-5 text-center">
        <Kicker dark={dark} onCard={onCard}>
          {kicker}
        </Kicker>
        <h2 id={id} className={`display text-[clamp(2.2rem,5vw,3.75rem)] ${dark ? "text-white" : "text-ink"}`}>{title}</h2>
        {lead && <p className={`max-w-[600px] text-[17px] leading-relaxed ${dark ? "text-strong-muted" : "text-muted"}`}>{lead}</p>}
      </div>
    );
  }
  return (
    <div data-reveal className="grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:items-end lg:gap-16">
      <div className="flex flex-col items-start gap-5">
        <Kicker dark={dark}>{kicker}</Kicker>
        <h2 id={id} className={`display max-w-[680px] text-[clamp(2.2rem,5vw,3.75rem)] ${dark ? "text-white" : "text-ink"}`}>{title}</h2>
      </div>
      {lead && <p className={`text-[17px] leading-relaxed lg:pb-2 ${dark ? "text-strong-muted" : "text-muted"}`}>{lead}</p>}
    </div>
  );
}

/** An Unsplash photo that fills its (relatively positioned) parent. */
export function Photo({ photo, lang, sizes, preload = false, className = "" }: { photo: PhotoData; lang: Locale; sizes: string; preload?: boolean; className?: string }) {
  return <Image src={photo.src} alt={photo.alt[lang]} fill sizes={sizes} preload={preload} quality={75} className={`object-cover ${className}`} />;
}

export function PrimaryButton({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      className={`group inline-flex h-14 items-center justify-center gap-3 rounded-full bg-lime pl-7 pr-2 text-[16px] font-bold text-strong shadow-[0_10px_30px_-12px_rgb(85_122_12/0.6)] transition-transform hover:-translate-y-0.5 ${className}`}
    >
      {children}
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-strong text-lime transition-transform group-hover:rotate-45">
        <Icon name="arrowUpRight" size={18} strokeWidth={2.4} />
      </span>
    </a>
  );
}

export function SecondaryButton({ href, children, dark = false }: { href: string; children: ReactNode; dark?: boolean }) {
  return (
    <a
      href={href}
      className={`inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-[16px] font-semibold transition-colors ${
        dark ? "bg-white/10 text-white hover:bg-white/15" : "border border-line bg-card text-ink hover:border-ink/20"
      }`}
    >
      {children}
    </a>
  );
}

/** Staggered reveal: `style={delay(1)}` waits one step longer than its sibling. */
export function delay(step: number): CSSProperties {
  return { "--delay": `${step * 90}ms` } as CSSProperties;
}
