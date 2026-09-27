import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { radius, spacing, useColors, type TileTone } from "@/lib/theme";
import { useSession } from "@/providers/session";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function Screen({
  children,
  refreshing,
  onRefresh,
  scroll = true,
  edges = ["top", "left", "right"],
  maxWidth = 1100,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  edges?: ("top" | "bottom" | "left" | "right")[];
  maxWidth?: number;
}) {
  const c = useColors();
  const inner = <View style={[styles.column, { maxWidth }]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.screenContent}
          refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined}
          keyboardShouldPersistTaps="handled"
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, { flex: 1 }]}>{inner}</View>
      )}
    </SafeAreaView>
  );
}

type TextVariant = "title" | "heading" | "body" | "muted" | "small";

export function T({
  children,
  variant = "body",
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: TextVariant;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const c = useColors();
  const base: TextStyle = {
    title: { fontSize: 26, fontWeight: "700" as const, color: c.text, letterSpacing: -0.6 },
    heading: { fontSize: 17, fontWeight: "600" as const, color: c.text },
    body: { fontSize: 15.5, lineHeight: 23, color: c.text },
    muted: { fontSize: 14, lineHeight: 20, color: c.muted },
    small: { fontSize: 12.5, color: c.muted },
  }[variant];
  return (
    <Text
      style={[base, style]}
      numberOfLines={numberOfLines}
      accessibilityRole={variant === "title" || variant === "heading" ? "header" : undefined}
    >
      {children}
    </Text>
  );
}

export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
  tone = "card",
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** "strong" gives the dark card used for highlights (exam card, scores). */
  tone?: "card" | "strong";
}) {
  const c = useColors();
  const cardStyle = [styles.card, { backgroundColor: tone === "strong" ? c.strong : c.card }, style];
  if (!onPress) return <View style={cardStyle}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [...cardStyle, pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  compact,
}: {
  title: string;
  onPress: () => void;
  /** primary = lime, dark = near-black, secondary = soft neutral (inside cards), light = white (on the page), ghost = text only. */
  variant?: "primary" | "dark" | "secondary" | "light" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  compact?: boolean;
}) {
  const c = useColors();
  const colors = {
    primary: [c.primary, c.primaryText],
    dark: [c.strong, c.strongText],
    secondary: [c.background, c.text],
    light: [c.card, c.text],
    ghost: ["transparent", c.text],
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        compact && { minHeight: 38, paddingHorizontal: spacing.lg },
        { backgroundColor: colors[0], opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors[1]} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={compact ? 15 : 17} color={colors[1]} />}
          <Text style={{ color: colors[1], fontSize: compact ? 13.5 : 15, fontWeight: "700" }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const c = useColors();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      style={[styles.track, { backgroundColor: c.track }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
    >
      <View style={{ width: `${pct * 100}%`, height: "100%", borderRadius: radius.pill, backgroundColor: color ?? c.success }} />
    </View>
  );
}

const BADGE_TONES: Record<"primary" | "success" | "warning" | "danger", TileTone> = {
  primary: "lavender",
  success: "mint",
  warning: "lemon",
  danger: "peach",
};

export function Badge({ label, tone = "primary" }: { label: string; tone?: keyof typeof BADGE_TONES | TileTone }) {
  const c = useColors();
  const tile = c.tiles[(tone in BADGE_TONES ? BADGE_TONES[tone as keyof typeof BADGE_TONES] : tone) as TileTone];
  return (
    <View style={[styles.badge, { backgroundColor: tile.bg }]}>
      <Text style={{ color: tile.ink, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

/** Small round icon button (e.g. chevrons, "+"), matching the dashboard. */
export function IconCircle({ name, onPress, label, tone = "soft" }: { name: IconName; onPress?: () => void; label?: string; tone?: "soft" | "lime" }) {
  const c = useColors();
  const content = (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: tone === "lime" ? c.primary : c.background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={name} size={15} color={tone === "lime" ? c.primaryText : c.text} />
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}>
      {content}
    </Pressable>
  );
}

export function OfflineNotice({ visible }: { visible: boolean }) {
  const c = useColors();
  const { t } = useSession();
  if (!visible) return null;
  return (
    <View style={[styles.notice, { backgroundColor: c.tiles.lemon.bg }]} accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={16} color={c.tiles.lemon.ink} />
      <Text style={{ color: c.tiles.lemon.ink, flex: 1, fontSize: 13 }}>{t("offline")}</Text>
    </View>
  );
}

/** Loading / error placeholder for a screen whose data isn't available. */
export function StateView({ loading, error, onRetry }: { loading?: boolean; error?: string | null; onRetry?: () => void }) {
  const c = useColors();
  const { t } = useSession();
  if (loading && !error) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.text} />
        <T variant="muted">{t("loading")}</T>
      </View>
    );
  }
  return (
    <View style={[styles.center, { backgroundColor: c.background }]}>
      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: c.tiles.peach.bg, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="alert-circle-outline" size={26} color={c.tiles.peach.ink} />
      </View>
      <T variant="muted" style={{ textAlign: "center", maxWidth: 320 }}>
        {error}
      </T>
      {onRetry && <Button title={t("retry")} variant="dark" compact onPress={onRetry} />}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap: spacing.sm }, style]}>{children}</View>;
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;

const styles = StyleSheet.create({
  screenContent: { padding: spacing.lg, paddingBottom: spacing.xl * 2, flexGrow: 1 },
  column: { width: "100%", alignSelf: "center", gap: spacing.lg + 2 },
  card: { borderRadius: radius.lg, padding: 18, gap: spacing.sm + 2 },
  button: {
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  track: { height: 8, borderRadius: radius.pill, overflow: "hidden" },
  badge: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  notice: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl, minHeight: 240 },
});
