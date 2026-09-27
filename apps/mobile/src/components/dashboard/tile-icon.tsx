import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { View } from "react-native";
import { useColors, type TileTone } from "@/lib/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

const SUBJECT_ICONS: Record<string, IconName> = {
  calculator: "calculator-outline",
  atom: "nuclear-outline",
  flask: "flask-outline",
  leaf: "leaf-outline",
  book: "book-outline",
  language: "language-outline",
  landmark: "business-outline",
  globe: "globe-outline",
  brain: "bulb-outline",
  feather: "create-outline",
  chart: "stats-chart-outline",
  cpu: "hardware-chip-outline",
};

export const subjectIcon = (icon: string | null | undefined): IconName => (icon && SUBJECT_ICONS[icon]) || "school-outline";

/** Rounded pastel square with an icon, as used on the dashboard tiles. */
export function TileIcon({ name, tone, size = 40 }: { name: IconName; tone: TileTone; size?: number }) {
  const c = useColors();
  const colors = c.tiles[tone];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: colors.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={name} size={size * 0.5} color={colors.ink} />
    </View>
  );
}
