import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";

/** Blue check for verified EduPrep staff. `compact` shows only the icon. */
export function VerifiedBadge({ compact }: { compact?: boolean }) {
  const c = useColors();
  const { t } = useSession();
  if (compact) {
    return <Ionicons name="checkmark-circle" size={16} color={c.tiles.sky.ink} accessibilityLabel={t("verified")} />;
  }
  return (
    <View
      accessibilityLabel={t("verified")}
      style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: c.tiles.sky.bg, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}
    >
      <Ionicons name="checkmark-circle" size={13} color={c.tiles.sky.ink} />
      <Text style={{ fontSize: 11, fontWeight: "700", color: c.tiles.sky.ink }}>{t("verified")}</Text>
    </View>
  );
}
