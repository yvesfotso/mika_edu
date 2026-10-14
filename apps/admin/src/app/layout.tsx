import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: { default: "EduPrep Admin", template: "%s · EduPrep Admin" },
  description: "Curriculum, question bank and learner analytics for EduPrep Africa.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Saved light/dark choice; "system" follows the OS until the user picks one.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en" data-theme={theme} className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
