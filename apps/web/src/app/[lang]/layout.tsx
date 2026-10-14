import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { getDictionary } from "@/content/dictionary";
import { hasLocale, LOCALES } from "@/content/locales";
import { PHOTOS, SITE_URL } from "@/lib/site";
import "../globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-jakarta" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], variable: "--font-bricolage", axes: ["opsz"] });

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const { meta } = getDictionary(lang);
  return {
    metadataBase: new URL(SITE_URL),
    title: meta.title,
    description: meta.description,
    icons: { icon: "/favicon.svg" },
    alternates: { canonical: `/${lang}`, languages: { en: "/en", fr: "/fr" } },
    openGraph: {
      title: meta.title,
      description: meta.description,
      locale: lang === "fr" ? "fr_CM" : "en_CM",
      type: "website",
      images: [{ url: `${PHOTOS.hero.src}?w=1200&h=630&fit=crop&q=75&auto=format`, width: 1200, height: 630 }],
    },
  };
}

// Marks the page as scripted before first paint so scroll reveals can start hidden without
// hiding anything when JavaScript is off.
const JS_FLAG = "document.documentElement.dataset.js=''";

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <html lang={lang} className={`${jakarta.variable} ${bricolage.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        <script dangerouslySetInnerHTML={{ __html: JS_FLAG }} />
        {children}
      </body>
    </html>
  );
}
