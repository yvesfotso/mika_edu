"use client";

import { useState, useSyncExternalStore } from "react";
import { THEME_COOKIE, type ThemePreference } from "@/lib/theme";
import { MoonIcon, SunIcon } from "./icons";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeSystem(onChange: () => void) {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Applies the theme to <html> immediately and remembers it for server rendering. */
function applyTheme(next: "light" | "dark") {
  document.documentElement.dataset.theme = next;
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Light / dark switch. The choice is applied to <html data-theme> right away and saved in a cookie so the
 * server renders the same theme next time. Until a choice is made the admin follows the OS ("system").
 */
export function ThemeToggle({ initial }: { initial: ThemePreference }) {
  const [pref, setPref] = useState(initial);
  // The OS setting is only known in the browser; render no selection on the server to avoid a mismatch.
  const systemDark = useSyncExternalStore(subscribeSystem, () => window.matchMedia(DARK_QUERY).matches, () => null);
  const effective = pref === "system" ? (systemDark === null ? null : systemDark ? "dark" : "light") : pref;

  function choose(next: "light" | "dark") {
    setPref(next);
    applyTheme(next);
  }

  const option = (value: "light" | "dark", label: string, icon: React.ReactNode) => {
    const on = effective === value;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        aria-label={label}
        title={label}
        onClick={() => choose(value)}
        className={`inline-flex size-8 items-center justify-center rounded-full transition ${
          on ? "bg-brand text-brand-ink shadow-sm" : "text-muted hover:text-ink"
        }`}
      >
        {icon}
      </button>
    );
  };

  return (
    <div role="radiogroup" aria-label="Colour theme" className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-line bg-frame p-1">
      {option("light", "Light mode", <SunIcon size={16} />)}
      {option("dark", "Dark mode", <MoonIcon size={15} />)}
    </div>
  );
}
