import type { Locale } from "@/content/locales";

/** Origin of the learner app on the web (apps/mobile, Expo Router), e.g. https://app.eduprep.africa. */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || null;

export type AppLinks = { signUp: string; signIn: string | null };

/**
 * Where the calls to action point: the app's sign-up and sign-in screens, in the language the visitor is
 * reading (the app picks up `?lang=`). Without NEXT_PUBLIC_APP_URL, sign-up falls back to the band at the
 * bottom of the page and the sign-in link is hidden.
 */
export function appLinks(lang: Locale): AppLinks {
  if (!APP_URL) return { signUp: "#start", signIn: null };
  return { signUp: `${APP_URL}/sign-up?lang=${lang}`, signIn: `${APP_URL}/sign-in?lang=${lang}` };
}

export type Photo = { src: string; alt: { en: string; fr: string }; author: string; page: string };

/** Free Unsplash photos used on the page, with credit links for the footer. */
export const PHOTOS = {
  hero: {
    src: "https://images.unsplash.com/photo-1759852692971-a2abc6799cbd",
    alt: { en: "A smiling student carrying a backpack and notebooks", fr: "Une élève souriante avec son sac et ses cahiers" },
    author: "Oluwaseyi Akinlolu",
    page: "https://unsplash.com/photos/dPQBwZ6d-NU",
  },
  reading: {
    src: "https://images.unsplash.com/photo-1516182823370-7a5fa91445c3",
    alt: { en: "A student writing notes in a book on a bench outdoors", fr: "Une élève prend des notes sur un banc, en plein air" },
    author: "Gift Habeshaw",
    page: "https://unsplash.com/photos/kSTcz5gE018",
  },
  friends: {
    src: "https://images.unsplash.com/photo-1648301033733-44554c74ec50",
    alt: { en: "Students chatting on a school balcony, one holding a phone", fr: "Des élèves discutent sur un balcon de l'école, l'un tient un téléphone" },
    author: "Creab ThePolymath",
    page: "https://unsplash.com/photos/jDXMQf3LPX8",
  },
  classroom: {
    src: "https://images.unsplash.com/photo-1632215861513-130b66fe97f4",
    alt: { en: "A teacher standing in front of a full classroom", fr: "Une enseignante devant une classe pleine" },
    author: "Emmanuel Ikwuegbu",
    page: "https://unsplash.com/photos/VC6MGt9ZoBA",
  },
  graduates: {
    src: "https://images.unsplash.com/photo-1594750852563-5ed8e0421d40",
    alt: { en: "Two graduates in gowns smiling", fr: "Deux diplômés en toge, souriants" },
    author: "Nqobile Vundla",
    page: "https://unsplash.com/photos/zOt6a59k2BE",
  },
} satisfies Record<string, Photo>;

/** Public origin, used for canonical and Open Graph URLs. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002";
