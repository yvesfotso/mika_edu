import { localize, type SubjectSummaryDto } from "@eduprep/core";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useColors, toneFor } from "@/lib/theme";
import { useSession } from "@/providers/session";
import { ProgressRing } from "./dashboard/progress-ring";
import { subjectIcon, TileIcon } from "./dashboard/tile-icon";

export function SubjectCard({ subject }: { subject: SubjectSummaryDto }) {
  const c = useColors();
  const { t, locale } = useSession();
  const name = localize(subject.name, locale);
  const hasContent = subject.chapterCount > 0;
  return (
    <Pressable
      onPress={() => router.push(`/subject/${subject.id}`)}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: c.card,
        borderRadius: 22,
        padding: 16,
        gap: 16,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TileIcon name={subjectIcon(subject.icon)} tone={toneFor(subject.id)} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }} numberOfLines={2}>
            {name}
          </Text>
          <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{t("coefficient", { n: subject.coefficient })}</Text>
        </View>
        {subject.targetGrade && (
          <View style={{ backgroundColor: c.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: c.primaryText }}>{t("targetChip", { grade: subject.targetGrade })}</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {hasContent ? (
          <>
            <View>
              <Text style={{ fontSize: 11, color: c.muted }}>{t("lessons")}</Text>
              <Text style={{ fontSize: 13, fontWeight: "600", color: c.text, marginTop: 2 }}>{t("chapters", { n: subject.chapterCount })}</Text>
            </View>
            <ProgressRing value={subject.mastery} />
          </>
        ) : (
          <View style={{ backgroundColor: c.background, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ fontSize: 12, color: c.muted }}>{t("noContentYet")}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

/** Lays items out in `columns` equal-width columns, filling the last row with spacers. */
export function Grid<T>({ items, columns, render, keyOf }: { items: T[]; columns: number; render: (item: T) => React.ReactNode; keyOf: (item: T) => string }) {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={{ gap: 14 }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", gap: 14 }}>
          {row.map((item) => (
            <View key={keyOf(item)} style={{ flex: 1 }}>
              {render(item)}
            </View>
          ))}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`spacer-${i}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

export function columnsFor(width: number, sidebar: boolean): number {
  const content = sidebar ? width - 232 : width;
  return content >= 900 ? 3 : content >= 560 ? 2 : 1;
}
