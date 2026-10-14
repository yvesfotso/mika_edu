import type { ChapterDto } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { T } from "@/components/ui";
import { deletePack, downloadPack, estimatePackBytes, formatBytes, type PackStatus } from "@/lib/packs";
import { useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";

/** Download state of one chapter: size, progress, failure with retry, removal and offline practice. */
export function PackControl({ chapterId, chapter, status }: { chapterId: string; chapter?: ChapterDto; status: PackStatus | undefined }) {
  const c = useColors();
  const { t, userId } = useSession();
  if (!userId) return null;

  const link = (label: string, icon: React.ComponentProps<typeof Ionicons>["name"], onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={15} color={c.text} />
      <Text style={{ fontSize: 13, fontWeight: "700", color: c.text, textDecorationLine: "underline" }}>{label}</Text>
    </Pressable>
  );

  if (status?.state === "downloading") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ActivityIndicator color={c.text} />
        <T variant="small">{t("downloading")}</T>
      </View>
    );
  }
  if (status?.state === "ready") {
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="cloud-done-outline" size={16} color={c.success} />
          <T variant="small">{t("downloadReady", { size: formatBytes(status.bytes) })}</T>
        </View>
        <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
          {link(t("practiseOffline"), "play-outline", () => router.push(`/offline-practice/${chapterId}`))}
          {link(t("removeDownload"), "trash-outline", () => deletePack(userId, chapterId))}
        </View>
      </View>
    );
  }
  const failure =
    status?.state === "failed"
      ? t(status.reason === "network" ? "downloadFailedNetwork" : status.reason === "storage" ? "downloadFailedStorage" : "downloadFailedServer")
      : null;
  return (
    <View style={{ gap: 6 }}>
      {failure && <T variant="small" style={{ color: c.danger }}>{failure}</T>}
      {link(
        failure ? t("retry") : t("downloadChapter", { size: chapter ? formatBytes(estimatePackBytes(chapter)) : "—" }),
        failure ? "refresh-outline" : "cloud-download-outline",
        () => void downloadPack(userId, chapterId),
      )}
    </View>
  );
}
