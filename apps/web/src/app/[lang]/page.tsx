import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { RevealObserver } from "@/components/reveal";
import { Buddy } from "@/components/sections/buddy";
import { Community } from "@/components/sections/community";
import { Cta } from "@/components/sections/cta";
import { Exams } from "@/components/sections/exams";
import { Faq } from "@/components/sections/faq";
import { Features } from "@/components/sections/features";
import { Footer } from "@/components/sections/footer";
import { Gallery } from "@/components/sections/gallery";
import { Hero } from "@/components/sections/hero";
import { How } from "@/components/sections/how";
import { Trust } from "@/components/sections/trust";
import { getDictionary } from "@/content/dictionary";
import { hasLocale } from "@/content/locales";
import { appLinks } from "@/lib/site";

export default async function Landing({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const d = getDictionary(lang);
  const app = appLinks(lang);
  return (
    <>
      <Nav t={d.nav} lang={lang} app={app} />
      <main>
        <Hero d={d} lang={lang} signUp={app.signUp} />
        <Exams d={d} />
        <Features d={d} lang={lang} />
        <How d={d} />
        <Buddy d={d} />
        <Gallery d={d} />
        <Trust d={d} lang={lang} />
        <Community d={d} lang={lang} />
        <Faq d={d} />
        <Cta d={d} lang={lang} signUp={app.signUp} />
      </main>
      <Footer d={d} />
      <RevealObserver />
    </>
  );
}
