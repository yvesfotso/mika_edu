import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/content/locales";

/** Picks French when the browser ranks it above English, otherwise the default. */
function preferredLocale(header: string | null): Locale {
  const ranked = (header ?? "")
    .split(",")
    .map((part) => {
      const [tag = "", q] = part.trim().split(";q=");
      return { lang: tag.slice(0, 2).toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  const hit = ranked.find((r) => (LOCALES as readonly string[]).includes(r.lang));
  return (hit?.lang as Locale | undefined) ?? DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request.headers.get("accept-language"))}`;
  return NextResponse.redirect(url);
}

// Only the bare root needs a locale; /en and /fr are served as static pages.
export const config = { matcher: "/" };
