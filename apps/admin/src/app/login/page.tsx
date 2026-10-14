import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LogoMark } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { ThemeToggle } from "@/components/theme-toggle";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle initial={theme} />
      </div>
      <div className="w-full max-w-sm overflow-hidden rounded-[2rem] bg-card shadow-[0_30px_70px_-35px_rgba(23,23,31,0.45)]">
        <div className="relative flex h-40 items-end justify-center bg-sidebar">
          <span className="absolute top-5 left-6 inline-flex size-10 items-center justify-center rounded-2xl text-brand ring-2 ring-brand/70">
            <LogoMark size={20} />
          </span>
          <Mascot width={170} accessories={["cap"]} />
        </div>
        <div className="p-8 pt-6">
          <h1 className="text-2xl font-semibold tracking-tight">EduPrep Admin</h1>
          <p className="mt-1 mb-6 text-sm text-muted">Sign in with a teacher, reviewer or admin account.</p>
          {error === "forbidden" && (
            <p role="alert" className="mb-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              This account doesn&apos;t have staff access. Ask an admin to grant you a role.
            </p>
          )}
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
