import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { toneFor, useColors } from "@/lib/theme";

/** Round avatar for chats: the EduPrep team gets the dark school badge, people get a pastel initial. */
export function ChatAvatar({ support, id, name, size = 44 }: { support?: boolean; id?: string; name: string; size?: number }) {
  const c = useColors();
  if (support) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.strong, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="school" size={size * 0.48} color={c.primary} />
      </View>
    );
  }
  const tile = c.tiles[toneFor(id ?? name)];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tile.bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: "800", color: tile.ink }}>{name.trim()[0]?.toUpperCase() ?? "?"}</Text>
    </View>
  );
}
