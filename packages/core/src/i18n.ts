export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

/** Content stored once per language, e.g. `{ en: "Algebra", fr: "Algèbre" }`. */
export type LocalizedText = Partial<Record<Locale, string>>;

export function localize(text: LocalizedText | null | undefined, locale: Locale): string {
  if (!text) return "";
  const preferred = text[locale];
  if (preferred && preferred.trim() !== "") return preferred;
  for (const fallback of LOCALES) {
    const value = text[fallback];
    if (value && value.trim() !== "") return value;
  }
  return "";
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
