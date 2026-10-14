import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

/** Flat palette of the mascot sticker set: green cat, near-black ink, warm yellow/orange props. */
export const MASCOT = {
  body: "#3CC85F",
  ink: "#17171F",
  eye: "#FFFFFF",
  yellow: "#FFC93C",
  orange: "#FF6B1A",
  cream: "#F5F1E8",
  blush: "#FF8FA3",
  sweat: "#6CC7FF",
};

export type MascotMood = "idle" | "look" | "shy" | "error" | "happy";
export type MascotAccessory = "cap" | "glasses" | "sunglasses" | "book";

/** Native driver for transforms/opacity everywhere except web, which has no native animated module. */
export const nativeDriver = Platform.OS !== "web";

/** Follows the OS "reduce motion" setting so decorative loops can be switched off. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

export function useAnimatedValue(initial: number): Animated.Value {
  const [value] = useState(() => new Animated.Value(initial));
  return value;
}

// All parts share one 200×140 canvas; the ground is y=134. Each animated part is its own Svg layer
// stacked in a View so transforms run on the native driver instead of re-rendering SVG.
const W = 200;
const H = 140;
const BODY =
  "M16 134 C18 108 30 74 46 50 C49 45 51 40 52 34 L55 15 Q56 9 61 12 L73 25 Q83 22 93 25 L105 12 Q110 9 111 15 L114 34 C115 40 117 45 120 50 C134 74 137 108 139 134 Z";
const TAIL = "M124 116 H185 A9 9 0 0 1 185 134 H124 Z";
const LEGS = "M73 113 Q75 124 70 134 M92 115 Q90 125 95 134";
const EYE_L = { x: 70, y: 56 };
const EYE_R = { x: 94, y: 56 };
const EYE_R_SIZE = 13;

/** Pupil offset (canvas units) for each mood; idle wanders on its own. */
function gazeFor(mood: MascotMood, gaze: number | undefined): { x: number; y: number } {
  switch (mood) {
    case "look":
      return { x: gaze === undefined ? -2 : -5 + 10 * Math.max(0, Math.min(1, gaze)), y: 4 };
    case "error":
      return { x: 0, y: 5 };
    case "happy":
      return { x: 0, y: -3 };
    default:
      return { x: 2, y: 0 };
  }
}

const IDLE_GLANCES = [
  { x: 3, y: 0 },
  { x: -4, y: 1 },
  { x: 0, y: -3 },
  { x: 4, y: 3 },
  { x: -2, y: -2 },
  { x: 2, y: 0 },
];

function Layer({ children }: { children: React.ReactNode }) {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFill}>
      {children}
    </Svg>
  );
}

function Cap() {
  return (
    <>
      <Path d="M68 19 V30 Q82 37 96 30 V19 Z" fill={MASCOT.ink} />
      <Path d="M56 17 L82 6 L108 17 L82 28 Z" fill={MASCOT.ink} />
      <Path d="M82 17 L104 21 V32" stroke={MASCOT.yellow} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Rect x={101} y={31} width={6} height={8} rx={2} fill={MASCOT.yellow} />
    </>
  );
}

function Glasses() {
  return (
    <>
      <Circle cx={EYE_L.x} cy={EYE_L.y} r={16} stroke={MASCOT.ink} strokeWidth={3} fill="#FFFFFF" fillOpacity={0.12} />
      <Circle cx={EYE_R.x} cy={EYE_R.y} r={16} stroke={MASCOT.ink} strokeWidth={3} fill="#FFFFFF" fillOpacity={0.12} />
      <Path d="M54 54 L46 50 M110 54 L118 50" stroke={MASCOT.ink} strokeWidth={3} strokeLinecap="round" />
    </>
  );
}

function Sunglasses() {
  return (
    <>
      <Rect x={53} y={46} width={34} height={20} rx={7} fill={MASCOT.ink} />
      <Rect x={79} y={46} width={34} height={20} rx={7} fill={MASCOT.ink} />
      <Path d="M58 51 L66 51" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M84 51 L92 51" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2.5} strokeLinecap="round" />
    </>
  );
}

function Book() {
  return (
    <>
      <Path d="M54 92 L82 98 L110 92 V120 L82 126 L54 120 Z" fill={MASCOT.yellow} stroke={MASCOT.ink} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M82 98 V126 M60 101 L76 104 M60 107 L76 110 M88 104 L104 101 M88 110 L104 107" stroke={MASCOT.ink} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={54} cy={106} r={6} fill={MASCOT.body} />
      <Circle cx={110} cy={106} r={6} fill={MASCOT.body} />
    </>
  );
}

/**
 * The app's green cat mascot, after the flat sticker set used across the product. It breathes,
 * taps its tail, blinks and looks around on its own; `mood` drives reactions (following typing,
 * covering its eyes, sweating, jumping). Respects the OS reduce-motion setting.
 */
export function Mascot({
  size = 160,
  mood = "idle",
  gaze,
  accessories = [],
  intro,
  animated = true,
  style,
  label,
}: {
  /** Width in px; height follows the 200×140 canvas. */
  size?: number;
  mood?: MascotMood;
  /** 0–1 horizontal eye position used by the "look" mood (e.g. how far along a text field the caret is). */
  gaze?: number;
  accessories?: MascotAccessory[];
  /** Pop up from the ground (and drop the cap on) when mounted; a number delays it by that many ms. */
  intro?: boolean | number;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Accessible description; the mascot is hidden from screen readers without one. */
  label?: string;
}) {
  const reduced = useReducedMotion();
  const live = animated && !reduced;
  const hasIntro = intro !== undefined && intro !== false && live;
  const introDelay = typeof intro === "number" ? intro : 0;
  const u = size / W;

  const enter = useAnimatedValue(hasIntro ? 0 : 1);
  const capDrop = useAnimatedValue(hasIntro ? 0 : 1);
  const breath = useAnimatedValue(0);
  const tail = useAnimatedValue(0);
  const blink = useAnimatedValue(1);
  const open = useAnimatedValue(mood === "shy" ? 0 : 1);
  const sweat = useAnimatedValue(mood === "error" ? 1 : 0);
  const joy = useAnimatedValue(mood === "happy" ? 1 : 0);
  const hop = useAnimatedValue(0);
  const shake = useAnimatedValue(0);
  const [pupil] = useState(() => new Animated.ValueXY(gazeFor(mood, gaze)));

  // Entrance: pop up with a squash, then the cap lands on the head.
  useEffect(() => {
    if (!hasIntro) return;
    const anim = Animated.sequence([
      Animated.delay(introDelay),
      // Overlap the two springs: waiting for the bouncy pop-up to fully settle makes the cap land late.
      Animated.parallel([
        Animated.spring(enter, { toValue: 1, friction: 5, tension: 70, useNativeDriver: nativeDriver }),
        Animated.sequence([
          Animated.delay(420),
          Animated.spring(capDrop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: nativeDriver }),
        ]),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [hasIntro, introDelay, enter, capDrop]);

  // Ambient loops: breathing and tail taps.
  useEffect(() => {
    if (!live) return;
    const ease = Easing.inOut(Easing.sin);
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1500, easing: ease, useNativeDriver: nativeDriver }),
        Animated.timing(breath, { toValue: 0, duration: 1500, easing: ease, useNativeDriver: nativeDriver }),
      ]),
    );
    const tapping = Animated.loop(
      Animated.sequence([
        Animated.timing(tail, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
        Animated.timing(tail, { toValue: 0, duration: 320, easing: Easing.bounce, useNativeDriver: nativeDriver }),
        Animated.timing(tail, { toValue: 0.6, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
        Animated.timing(tail, { toValue: 0, duration: 300, easing: Easing.bounce, useNativeDriver: nativeDriver }),
        Animated.delay(2200),
      ]),
    );
    breathing.start();
    tapping.start();
    return () => {
      breathing.stop();
      tapping.stop();
    };
  }, [live, breath, tail]);

  // Blinks at irregular intervals, sometimes twice.
  useEffect(() => {
    if (!live) return;
    let timer: ReturnType<typeof setTimeout>;
    const once = () =>
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.08, duration: 70, useNativeDriver: nativeDriver }),
        Animated.timing(blink, { toValue: 1, duration: 120, useNativeDriver: nativeDriver }),
      ]);
    const schedule = () => {
      timer = setTimeout(
        () => {
          const anim = Math.random() < 0.25 ? Animated.sequence([once(), Animated.delay(90), once()]) : once();
          anim.start(schedule);
        },
        2200 + Math.random() * 2800,
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [live, blink]);

  // Gaze: wander while idle, otherwise follow the mood (and `gaze` while looking).
  useEffect(() => {
    const target = gazeFor(mood, gaze);
    if (!live) {
      pupil.setValue(target);
      return;
    }
    Animated.spring(pupil, { toValue: target, friction: 7, tension: 80, useNativeDriver: nativeDriver }).start();
    if (mood !== "idle") return;
    let timer: ReturnType<typeof setTimeout>;
    let i = 0;
    const wander = () => {
      timer = setTimeout(
        () => {
          i = (i + 1 + Math.floor(Math.random() * 2)) % IDLE_GLANCES.length;
          Animated.spring(pupil, { toValue: IDLE_GLANCES[i]!, friction: 7, tension: 60, useNativeDriver: nativeDriver }).start();
          wander();
        },
        1400 + Math.random() * 1800,
      );
    };
    wander();
    return () => clearTimeout(timer);
  }, [live, mood, gaze, pupil]);

  // Mood reactions.
  useEffect(() => {
    const fade = (v: Animated.Value, to: number) =>
      live ? Animated.timing(v, { toValue: to, duration: 200, useNativeDriver: nativeDriver }) : null;
    const settle = (v: Animated.Value, to: number) => {
      const anim = fade(v, to);
      if (anim) anim.start();
      else v.setValue(to);
    };
    settle(open, mood === "shy" ? 0 : 1);
    settle(sweat, mood === "error" ? 1 : 0);
    settle(joy, mood === "happy" ? 1 : 0);
    if (!live) return;

    if (mood === "error") {
      const steps = [1, -1, 0.7, -0.7, 0.35, 0];
      Animated.sequence(steps.map((v) => Animated.timing(shake, { toValue: v, duration: 60, useNativeDriver: nativeDriver }))).start();
    }
    if (mood === "happy") {
      const jump = () =>
        Animated.sequence([
          Animated.timing(hop, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
          Animated.timing(hop, { toValue: 0, duration: 300, easing: Easing.bounce, useNativeDriver: nativeDriver }),
        ]);
      const anim = Animated.sequence([jump(), jump()]);
      anim.start();
      return () => anim.stop();
    }
  }, [live, mood, open, sweat, joy, hop, shake]);

  const fill = StyleSheet.absoluteFill;
  const eyeScale = Animated.multiply(blink, open.interpolate({ inputRange: [0, 1], outputRange: [0.04, 1] }));

  return (
    <View
      style={[{ width: size, height: (size * H) / W }, style]}
      pointerEvents="none"
      accessible={Boolean(label)}
      accessibilityRole={label ? "image" : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? "auto" : "no-hide-descendants"}
      accessibilityElementsHidden={!label}
    >
      <Animated.View
        style={[
          fill,
          {
            opacity: enter.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: "clamp" }),
            transformOrigin: "50% 100%",
            transform: [
              { translateX: Animated.multiply(shake, 6 * u) },
              { translateY: Animated.add(enter.interpolate({ inputRange: [0, 1], outputRange: [H * 0.45 * u, 0] }), Animated.multiply(hop, -22 * u)) },
              { scaleY: enter.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
            ],
          },
        ]}
      >
        <Animated.View style={[fill, { transformOrigin: "62% 89%", transform: [{ rotate: tail.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-12deg"] }) }] }]}>
          <Layer>
            <Path d={TAIL} fill={MASCOT.body} />
          </Layer>
        </Animated.View>

        <Animated.View
          style={[
            fill,
            {
              transformOrigin: "50% 96%",
              transform: [
                { scaleX: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) },
                { scaleY: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
              ],
            },
          ]}
        >
          <Layer>
            <Path d={BODY} fill={MASCOT.body} />
            <Path d={LEGS} stroke={MASCOT.ink} strokeWidth={2.2} strokeLinecap="round" fill="none" />
          </Layer>

          <Animated.View
            style={[
              fill,
              {
                opacity: open.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: "clamp" }),
                transformOrigin: `50% ${(EYE_L.y / H) * 100}%`,
                transform: [{ scaleY: eyeScale }],
              },
            ]}
          >
            <Layer>
              <Circle cx={EYE_R.x} cy={EYE_R.y} r={EYE_R_SIZE} fill={MASCOT.eye} stroke={MASCOT.ink} strokeWidth={2.5} />
              <Circle cx={EYE_L.x} cy={EYE_L.y} r={EYE_R_SIZE} fill={MASCOT.eye} stroke={MASCOT.ink} strokeWidth={2.5} />
            </Layer>
            <Animated.View style={[fill, { transform: [{ translateX: Animated.multiply(pupil.x, u) }, { translateY: Animated.multiply(pupil.y, u) }] }]}>
              <Layer>
                <Circle cx={EYE_L.x} cy={EYE_L.y} r={6.5} fill={MASCOT.ink} />
                <Circle cx={EYE_R.x} cy={EYE_R.y} r={6.5} fill={MASCOT.ink} />
                <Circle cx={EYE_L.x + 2.2} cy={EYE_L.y - 2.2} r={1.8} fill="#FFFFFF" />
                <Circle cx={EYE_R.x + 2.2} cy={EYE_R.y - 2.2} r={1.8} fill="#FFFFFF" />
              </Layer>
            </Animated.View>
          </Animated.View>

          <Animated.View style={[fill, { opacity: open.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
            <Layer>
              <Path d="M59 58 Q70 49 81 58 M83 58 Q94 49 105 58" stroke={MASCOT.ink} strokeWidth={2.6} strokeLinecap="round" fill="none" />
              <Ellipse cx={58} cy={72} rx={7} ry={4} fill={MASCOT.blush} fillOpacity={0.75} />
              <Ellipse cx={106} cy={72} rx={7} ry={4} fill={MASCOT.blush} fillOpacity={0.75} />
            </Layer>
          </Animated.View>

          <Animated.View style={[fill, { opacity: joy }]}>
            <Layer>
              <Path d="M76 76 Q79 80 82 76 Q85 80 88 76" stroke={MASCOT.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Layer>
          </Animated.View>

          <Animated.View
            style={[fill, { opacity: sweat, transform: [{ translateY: Animated.multiply(sweat.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }), u) }] }]}
          >
            <Layer>
              <Path d="M116 26 Q109 37 116 42 Q123 37 116 26 Z" fill={MASCOT.sweat} stroke={MASCOT.ink} strokeWidth={1.5} />
            </Layer>
          </Animated.View>

          {(accessories.includes("glasses") || accessories.includes("sunglasses") || accessories.includes("book")) && (
            <Layer>
              {accessories.includes("glasses") && <Glasses />}
              {accessories.includes("sunglasses") && <Sunglasses />}
              {accessories.includes("book") && <Book />}
            </Layer>
          )}

          {accessories.includes("cap") && (
            <Animated.View
              style={[
                fill,
                {
                  opacity: capDrop.interpolate({ inputRange: [0, 0.2], outputRange: [0, 1], extrapolate: "clamp" }),
                  transformOrigin: "41% 12%",
                  transform: [
                    { translateY: capDrop.interpolate({ inputRange: [0, 1], outputRange: [-60 * u, 0] }) },
                    { rotate: capDrop.interpolate({ inputRange: [0, 1], outputRange: ["-28deg", "0deg"] }) },
                  ],
                },
              ]}
            >
              <Layer>
                <Cap />
              </Layer>
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}
