import type { Metadata } from "next";
import { LogoMark } from "@/components/icons";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-[2.25rem] bg-frame p-8 shadow-[0_24px_60px_-30px_rgba(22,32,31,0.25)]">
        <span className="mb-6 inline-flex size-12 items-center justify-center rounded-full bg-brand text-brand-ink">
          <LogoMark size={24} />
        </span>
        <h1 className="text-2xl font-medium tracking-tight">EduPrep Admin</h1>
        <p className="mt-1 mb-6 text-sm text-muted">Sign in with a teacher, reviewer or admin account.</p>
        {error === "forbidden" && (
          <p role="alert" className="mb-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            This account doesn&apos;t have staff access. Ask an admin to grant you a role.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
