import { useSyncExternalStore } from "react";
import { useColorScheme } from "react-native";
import { store } from "./storage";

/**
 * App-wide palette: warm off-white page, borderless white cards, dark "strong" surfaces,
 * a lime accent for primary actions and pastel tiles for icons and badges.
 * `primary` is lime — never use it for text on light surfaces; use `text`/`strong` instead.
 */
const light = {
  background: "#F3F3EE",
  card: "#FFFFFF",
  text: "#17171F",
  muted: "#8B8B97",
  faint: "#B9B9C3",
  border: "#ECECE8",
  track: "#ECECE8",
  primary: "#D5F26A",
  primaryText: "#1D1D29",
  primarySoft: "#F2FAD2",
  strong: "#1D1D29",
  strongText: "#FFFFFF",
  strongMuted: "#C7C7D3",
  strongRaised: "#2B2B3A",
  chartBar: "#1D1D29",
  success: "#3E9B34",
  successSoft: "#E4F8D6",
  danger: "#C2412D",
  dangerSoft: "#FDE6DA",
  warning: "#A67C00",
  warningSoft: "#FFF3C9",
  tiles: {
    lavender: { bg: "#ECE4FE", ink: "#6A4FD6" },
    mint: { bg: "#E4F8D6", ink: "#3E8E2F" },
    peach: { bg: "#FDE6DA", ink: "#C2552F" },
    sky: { bg: "#DDEBFF", ink: "#2F6FD1" },
    lemon: { bg: "#FFF3C9", ink: "#A67C00" },
  },
};

export type Colors = typeof light;

const dark: Colors = {
  background: "#111118",
  card: "#1C1C27",
  text: "#F2F2F5",
  muted: "#9A9AA8",
  faint: "#5C5C6A",
  border: "#2A2A36",
  track: "#2A2A36",
  primary: "#D5F26A",
  primaryText: "#1D1D29",
  primarySoft: "#2C3318",
  strong: "#0A0A10",
  strongText: "#FFFFFF",
  strongMuted: "#A9A9B8",
  strongRaised: "#20202C",
  chartBar: "#E6E6EE",
  success: "#6BCB5E",
  successSoft: "#18301A",
  danger: "#F08A73",
  dangerSoft: "#3A2019",
  warning: "#E8C04A",
  warningSoft: "#3A3113",
  tiles: {
    lavender: { bg: "#2C2547", ink: "#C3B2FF" },
    mint: { bg: "#1C3320", ink: "#8FE07F" },
    peach: { bg: "#3B2419", ink: "#F7A887" },
    sky: { bg: "#1A2A44", ink: "#8DB8FF" },
    lemon: { bg: "#393016", ink: "#F1CF62" },
  },
};

export type ThemePreference = "light" | "dark" | "system";

const THEME_KEY = "pref:theme";
const themeListeners = new Set<() => void>();

/** Light by default to match the design; learners can switch to dark or follow the system. */
function getThemePreference(): ThemePreference {
  const saved = store.get<ThemePreference>(THEME_KEY);
  return saved === "dark" || saved === "system" ? saved : "light";
}

export function setThemePreference(pref: ThemePreference): void {
  store.set(THEME_KEY, pref);
  for (const l of themeListeners) l();
}

function subscribeTheme(onChange: () => void) {
  themeListeners.add(onChange);
  return () => {
    themeListeners.delete(onChange);
  };
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribeTheme, getThemePreference);
}

export function useColorSchemeName(): "light" | "dark" {
  const pref = useThemePreference();
  const system = useColorScheme();
  if (pref === "system") return system === "dark" ? "dark" : "light";
  return pref;
}

export function useColors(): Colors {
  return useColorSchemeName() === "dark" ? dark : light;
}

export type TileTone = keyof Colors["tiles"];
export const TILE_ORDER: TileTone[] = ["peach", "mint", "lavender", "sky", "lemon"];

/** Stable pastel tone for an id, so a subject keeps the same colour everywhere. */
export function toneFor(id: string): TileTone {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TILE_ORDER[h % TILE_ORDER.length]!;
}

/** Window width from which tab screens use the sidebar and multi-column layouts. */
export const SIDEBAR_BREAKPOINT = 1024;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };
