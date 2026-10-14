import { useEffect, useMemo, useState } from "react";
import { Animated, Easing, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { MASCOT, Mascot, nativeDriver, useAnimatedValue, useReducedMotion, type MascotMood } from "@/components/mascot/mascot";
import { MascotProp, type PropKind } from "@/components/mascot/props";
import { useColorSchemeName } from "@/lib/theme";

const PALETTE = {
  light: { bg: MASCOT.cream, text: MASCOT.ink, accent: "#23963F", orbit: "rgba(23,23,31,0.22)", shadow: "rgba(23,23,31,0.10)" },
  dark: { bg: "#20202C", text: "#F2F2F5", accent: MASCOT.body, orbit: "rgba(255,255,255,0.22)", shadow: "rgba(0,0,0,0.35)" },
};

// Timeline (ms): ring grows → caption words rise → cat pops up and the cap drops → props pop in one by one.
const RING_AT = 0;
const WORDS_AT = 250;
const MASCOT_AT = 350;
const PROPS_AT = 950;
const PROP_STAGGER = 130;

type Item = { kind: PropKind; x: number; y: number; s: number };

// Positions are fractions of the panel; sizes are fractions of `base` (see below).
const ITEMS_TALL: Item[] = [
  { kind: "grade", x: 0.76, y: 0.15, s: 0.15 },
  { kind: "book", x: 0.07, y: 0.34, s: 0.17 },
  { kind: "checklist", x: 0.8, y: 0.42, s: 0.13 },
  { kind: "bulb", x: 0.58, y: 0.27, s: 0.1 },
  { kind: "pencil", x: 0.05, y: 0.6, s: 0.12 },
  { kind: "sparkle", x: 0.34, y: 0.33, s: 0.06 },
  { kind: "sparkle", x: 0.9, y: 0.66, s: 0.05 },
];
const ITEMS_BANNER: Item[] = [
  { kind: "book", x: 0.05, y: 0.14, s: 0.26 },
  { kind: "grade", x: 0.8, y: 0.08, s: 0.24 },
  { kind: "sparkle", x: 0.3, y: 0.1, s: 0.1 },
  { kind: "checklist", x: 0.85, y: 0.5, s: 0.2 },
  { kind: "pencil", x: 0.07, y: 0.58, s: 0.2 },
  { kind: "sparkle", x: 0.7, y: 0.3, s: 0.08 },
];

function Floater({ item, base, w, h, index, live }: { item: Item; base: number; w: number; h: number; index: number; live: boolean }) {
  const appear = useAnimatedValue(live ? 0 : 1);
  const drift = useAnimatedValue(0);
  const size = item.s * base;
  const twinkle = item.kind === "sparkle";

  useEffect(() => {
    if (!live) return;
    const ease = Easing.inOut(Easing.sin);
    const half = (twinkle ? 900 : 1500) + (index % 3) * 350;
    const pop = Animated.sequence([
      Animated.delay(PROPS_AT + index * PROP_STAGGER),
      Animated.spring(appear, { toValue: 1, friction: 5, tension: 90, useNativeDriver: nativeDriver }),
    ]);
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: half, easing: ease, useNativeDriver: nativeDriver }),
        Animated.timing(drift, { toValue: 0, duration: half, easing: ease, useNativeDriver: nativeDriver }),
      ]),
    );
    pop.start();
    float.start();
    return () => {
      pop.stop();
      float.stop();
    };
  }, [live, index, twinkle, appear, drift]);

  const dir = index % 2 ? 1 : -1;
  const transform = twinkle
    ? [
        { scale: Animated.multiply(appear, drift.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.1] })) },
        { rotate: drift.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] }) },
      ]
    : [
        { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.18] }) },
        { rotate: drift.interpolate({ inputRange: [0, 1], outputRange: [`${-5 * dir}deg`, `${6 * dir}deg`] }) },
        { scale: appear },
        { rotate: appear.interpolate({ inputRange: [0, 1], outputRange: [`${-40 * dir}deg`, "0deg"] }) },
      ];

  return (
    <Animated.View style={{ position: "absolute", left: item.x * w, top: item.y * h, width: size, height: size, transform }}>
      <MascotProp kind={item.kind} size={size} />
    </Animated.View>
  );
}

function Caption({ text, color, accent, fontSize, live }: { text: string; color: string; accent: string; fontSize: number; live: boolean }) {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const values = useMemo(() => words.map(() => new Animated.Value(live ? 0 : 1)), [words, live]);

  useEffect(() => {
    if (!live) return;
    const anim = Animated.sequence([
      Animated.delay(WORDS_AT),
      Animated.stagger(
        110,
        values.map((v) => Animated.spring(v, { toValue: 1, friction: 7, tension: 70, useNativeDriver: nativeDriver })),
      ),
    ]);
    anim.start();
    return () => anim.stop();
  }, [live, values]);

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: fontSize * 0.28 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {words.map((word, i) => (
        <View key={`${word}-${i}`} style={{ overflow: "hidden", paddingBottom: 4 }}>
          <Animated.Text
            style={{
              fontSize,
              fontWeight: "800",
              letterSpacing: -0.8,
              color: i === words.length - 1 ? accent : color,
              opacity: values[i],
              transform: [{ translateY: values[i]!.interpolate({ inputRange: [0, 1], outputRange: [fontSize * 1.2, 0] }) }],
            }}
          >
            {word}
          </Animated.Text>
        </View>
      ))}
    </View>
  );
}

function Scene({ w, h, label, mood, gaze }: { w: number; h: number; label?: string; mood: MascotMood; gaze?: number }) {
  const p = PALETTE[useColorSchemeName()];
  const live = !useReducedMotion();
  const ring = useAnimatedValue(live ? 0 : 1);
  const orbit = useAnimatedValue(0);

  useEffect(() => {
    if (!live) return;
    const grow = Animated.sequence([
      Animated.delay(RING_AT),
      Animated.spring(ring, { toValue: 1, friction: 6, tension: 40, useNativeDriver: nativeDriver }),
    ]);
    const spin = Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 40000, easing: Easing.linear, useNativeDriver: nativeDriver }));
    grow.start();
    spin.start();
    return () => {
      grow.stop();
      spin.stop();
    };
  }, [live, ring, orbit]);

  const banner = h < 340;
  const size = banner ? Math.min(h, w * 0.52) : Math.min(w * 0.7, h * 0.5);
  const mascotH = size * 0.7;
  const groundY = banner ? h - 10 : h * 0.88;
  const mascotX = w / 2 - size * 0.42;
  const mascotY = groundY - mascotH;
  // The ring sits behind the head (body centre is ~41% across the canvas).
  const cx = mascotX + size * 0.41;
  const cy = mascotY + mascotH * 0.38;
  const ringR = size * 0.42;
  const orbitR = size * 0.64;
  const items = banner ? ITEMS_BANNER : ITEMS_TALL;
  const base = banner ? h : Math.min(w, h * 0.75);

  return (
    <>
      <Animated.View
        style={{
          position: "absolute",
          left: cx - orbitR,
          top: cy - orbitR,
          width: orbitR * 2,
          height: orbitR * 2,
          opacity: ring,
          transform: [{ rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }],
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={49} stroke={p.orbit} strokeWidth={0.8} strokeDasharray="0.5 4" strokeLinecap="round" fill="none" />
          <Circle cx={50} cy={1} r={1.8} fill={MASCOT.orange} />
        </Svg>
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          left: cx - ringR,
          top: cy - ringR,
          width: ringR * 2,
          height: ringR * 2,
          borderRadius: ringR,
          borderWidth: size * 0.09,
          borderColor: MASCOT.yellow,
          opacity: ring.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: "clamp" }),
          transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
        }}
      />

      <View
        style={{
          position: "absolute",
          left: mascotX + size * 0.04,
          top: groundY - size * 0.025,
          width: size * 0.95,
          height: size * 0.05,
          borderRadius: size,
          backgroundColor: p.shadow,
        }}
      />

      {items.map((item, i) => (
        <Floater key={`${item.kind}-${i}`} item={item} base={base} w={w} h={h} index={i} live={live} />
      ))}

      <Mascot size={size} mood={mood} gaze={gaze} accessories={["cap"]} intro={MASCOT_AT} style={{ position: "absolute", left: mascotX, top: mascotY }} />

      {!banner && label && (
        <View style={{ position: "absolute", left: 32, top: 32, maxWidth: w * 0.62 }}>
          <Caption text={label} color={p.text} accent={p.accent} fontSize={Math.min(36, w * 0.075)} live={live} />
        </View>
      )}
    </>
  );
}

/**
 * Motion-design panel for the sign-in and sign-up screens: the mascot pops up under a growing ring,
 * catches its graduation cap and is joined by floating study props, then reacts to the form via `mood`.
 */
export function AuthArt({
  style,
  label,
  mood = "idle",
  gaze,
}: {
  style?: StyleProp<ViewStyle>;
  label?: string;
  mood?: MascotMood;
  gaze?: number;
}) {
  const p = PALETTE[useColorSchemeName()];
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  return (
    <View
      style={[{ overflow: "hidden", backgroundColor: p.bg }, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((prev) => (prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }));
      }}
      accessible={Boolean(label)}
      accessibilityLabel={label}
      accessibilityRole="image"
    >
      {box && box.w > 0 && <Scene w={box.w} h={box.h} label={label} mood={mood} gaze={gaze} />}
    </View>
  );
}
