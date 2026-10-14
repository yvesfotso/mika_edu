import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";
import { MASCOT } from "./mascot";

export type PropKind = "book" | "pencil" | "checklist" | "grade" | "sparkle" | "bulb";

/** Small flat props from the mascot sticker set, drawn on a 48×48 canvas. */
export function MascotProp({ kind, size }: { kind: PropKind; size: number }) {
  const { ink, yellow, orange, body, cream } = MASCOT;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {kind === "book" && (
        <>
          <Path d="M3 12 L24 16 L45 12 V38 L24 42 L3 38 Z" fill={yellow} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
          <Path d="M24 16 V42 M8 20 L19 22 M8 26 L19 28 M8 32 L19 34 M29 22 L40 20 M29 28 L40 26" stroke={ink} strokeWidth={1.5} strokeLinecap="round" />
        </>
      )}
      {kind === "pencil" && (
        <>
          <Path d="M12 32 L32 8 L40 15 L20 39 Z" fill={orange} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
          <Path d="M12 32 L20 39 L9 43 Z" fill={cream} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
          <Path d="M9 43 L10.5 38.5 L13.5 41 Z" fill={ink} />
          <Path d="M32 8 L35 4.5 L43 11.5 L40 15 Z" fill={yellow} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
        </>
      )}
      {kind === "checklist" && (
        <>
          <Rect x={8} y={5} width={32} height={39} rx={4} fill="#FFFFFF" stroke={ink} strokeWidth={2} />
          {[14, 24, 34].map((y) => (
            <Path key={y} d={`M13 ${y} L16 ${y + 3} L21 ${y - 3}`} stroke={body} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
          <Path d="M25 14 H35 M25 24 H35 M25 34 H32" stroke={ink} strokeWidth={1.8} strokeLinecap="round" />
        </>
      )}
      {kind === "grade" && (
        <>
          <Circle cx={24} cy={24} r={19} fill={yellow} stroke={ink} strokeWidth={2} />
          <SvgText x={24} y={31} fontSize={19} fontWeight="800" fill={ink} textAnchor="middle">
            A+
          </SvgText>
        </>
      )}
      {kind === "sparkle" && <Path d="M24 4 Q26.5 21.5 44 24 Q26.5 26.5 24 44 Q21.5 26.5 4 24 Q21.5 21.5 24 4 Z" fill={yellow} />}
      {kind === "bulb" && (
        <>
          <Path d="M24 6 C14 6 9 13 9 20 C9 26 13 29 16 33 H32 C35 29 39 26 39 20 C39 13 34 6 24 6 Z" fill={yellow} stroke={ink} strokeWidth={2} />
          <Rect x={17} y={33} width={14} height={8} rx={2} fill={cream} stroke={ink} strokeWidth={2} />
          <Path d="M19 20 Q24 14 29 20" stroke={orange} strokeWidth={2} fill="none" strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}
