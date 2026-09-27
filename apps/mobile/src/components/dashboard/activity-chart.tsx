import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useColors } from "@/lib/theme";
import { useSession } from "@/providers/session";

const CHART_HEIGHT = 120;

function niceMax(value: number): number {
  const step = value <= 60 ? 15 : 30;
  return Math.max(step * 2, Math.ceil(value / step) * step);
}

/** Weekly study-minutes bar chart; the selected day (today by default) is highlighted with a tooltip. */
export function ActivityChart({ activity }: { activity: { date: string; minutes: number }[] }) {
  const c = useColors();
  const { t, locale } = useSession();
  const week = activity.slice(-7);
  const previous = activity.slice(-14, -7);
  const [selected, setSelected] = useState(week.length - 1);

  const total = week.reduce((s, d) => s + d.minutes, 0);
  const prevTotal = previous.reduce((s, d) => s + d.minutes, 0);
  const change = prevTotal === 0 ? null : Math.round(((total - prevTotal) / prevTotal) * 100);
  const max = niceMax(Math.max(...week.map((d) => d.minutes), 1));
  const ticks = [max, (max * 2) / 3, max / 3, 0].map(Math.round);

  const weekday = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { weekday: "short", timeZone: "UTC" });
  const dayMonth = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const toDate = (d: string) => new Date(`${d}T00:00:00Z`);
  const sel = week[selected];

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={change !== null && change < 0 ? "trending-down" : "trending-up"} size={15} color={c.text} />
        </View>
        <Text style={{ fontSize: 13, color: c.muted }}>
          {change === null ? (
            t("minutesThisWeek", { n: total })
          ) : (
            <>
              <Text style={{ color: change >= 0 ? c.success : c.tiles.peach.ink, fontWeight: "700" }}>
                {change >= 0 ? "+" : ""}
                {change}%
              </Text>{" "}
              {t("vsLastWeek")}
            </>
          )}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ height: CHART_HEIGHT, justifyContent: "space-between", paddingBottom: 0 }}>
          {ticks.map((tick) => (
            <Text key={tick} style={{ fontSize: 10, color: c.faint, textAlign: "right", minWidth: 24 }}>
              {tick}m
            </Text>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ height: CHART_HEIGHT, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around" }}>
            {week.map((d, i) => {
              const active = i === selected;
              const h = Math.max(active ? 10 : 3, (d.minutes / max) * (CHART_HEIGHT - 6));
              return (
                <Pressable
                  key={d.date}
                  onPress={() => setSelected(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`${weekday.format(toDate(d.date))} ${t("minutes", { n: d.minutes })}`}
                  style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}
                  hitSlop={4}
                >
                  {active && sel && (
                    <View
                      style={{
                        position: "absolute",
                        bottom: h + 6,
                        backgroundColor: c.strong,
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: 8,
                        zIndex: 2,
                        minWidth: 64,
                      }}
                    >
                      <Text style={{ color: c.strongText, fontSize: 10.5, fontWeight: "700" }}>⏱ {t("minutes", { n: sel.minutes })}</Text>
                      <Text style={{ color: c.strongMuted, fontSize: 10 }}>{dayMonth.format(toDate(sel.date))}</Text>
                    </View>
                  )}
                  <View
                    style={{
                      width: active ? 12 : 6,
                      height: h,
                      borderRadius: 6,
                      backgroundColor: active ? c.primary : c.chartBar,
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 8 }}>
            {week.map((d, i) => (
              <Text
                key={d.date}
                style={{ flex: 1, textAlign: "center", fontSize: 11, color: i === selected ? c.text : c.muted, fontWeight: i === selected ? "700" : "400" }}
              >
                {weekday.format(toDate(d.date)).replace(".", "").slice(0, 2)}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
