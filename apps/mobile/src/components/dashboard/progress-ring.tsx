import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useColors } from "@/lib/theme";

export function ProgressRing({ value, size = 34, stroke = 3.5 }: { value: number; size?: number; stroke?: number }) {
  const c = useColors();
  const pct = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.success}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ fontSize: 13, fontWeight: "700", color: c.text, minWidth: 34 }}>{Math.round(pct * 100)}%</Text>
    </View>
  );
}
