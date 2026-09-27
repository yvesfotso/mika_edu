import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";

const pad = (n: number) => String(n).padStart(2, "0");

function NavButton({ dir, label, onPress }: { dir: -1 | 1; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name={dir < 0 ? "chevron-back" : "chevron-forward"} size={14} color={c.text} />
    </Pressable>
  );
}

/** Month grid (weeks start Monday). Today is filled lime; days with study activity get a dot. */
export function MonthCalendar({ today, activeDates }: { today: string; activeDates: Set<string> }) {
  const c = useColors();
  const { t, locale } = useSession();
  const [offset, setOffset] = useState(0);
  const tag = locale === "fr" ? "fr-FR" : "en-GB";

  const [ty, tm] = today.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(ty, tm - 1 + offset, 1));
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: { date: string; day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < Math.ceil((lead + daysInMonth) / 7) * 7; i++) {
    const d = new Date(Date.UTC(year, month, 1 - lead + i));
    cells.push({
      date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month,
    });
  }

  const monthLabel = new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const weekdayFmt = new Intl.DateTimeFormat(tag, { weekday: "narrow", timeZone: "UTC" });
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFmt.format(new Date(Date.UTC(2024, 0, 1 + i))));


  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <NavButton dir={-1} label={t("previous")} onPress={() => setOffset((o) => o - 1)} />
        <Text style={{ fontSize: 14, fontWeight: "600", color: c.text, textTransform: "capitalize" }}>{monthLabel}</Text>
        <NavButton dir={1} label={t("next")} onPress={() => setOffset((o) => o + 1)} />
      </View>
      <View style={{ flexDirection: "row", backgroundColor: c.background, borderRadius: 8, paddingVertical: 6 }}>
        {weekdays.map((w, i) => (
          <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, color: c.muted, textTransform: "uppercase" }}>
            {w}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((cell) => {
          const isToday = cell.date === today;
          const studied = activeDates.has(cell.date);
          return (
            <View key={cell.date} style={{ width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isToday ? c.primary : "transparent",
                }}
              >
                <Text style={{ fontSize: 12, color: cell.inMonth ? c.text : c.faint, fontWeight: isToday ? "700" : "400" }}>{cell.day}</Text>
              </View>
              <View style={{ width: 4, height: 4, borderRadius: 2, marginTop: 1, backgroundColor: studied && !isToday ? c.success : "transparent" }} />
            </View>
          );
        })}
      </View>
    </View>
  );
}
