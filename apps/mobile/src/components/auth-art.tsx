import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

// A large lobe filling the upper left and a wave across the bottom, each with a glowing rim,
// over a near-black field — the dark/lime/lavender palette used across the app.
const LOBE = "M0,0 L318,0 C 312,150 280,300 196,392 C 140,454 70,492 0,506 Z";
const LOBE_EDGE = "M318,0 C 312,150 280,300 196,392 C 140,454 70,492 0,506";
const WAVE = "M0,700 L0,590 C 60,560 110,500 168,420 C 214,356 264,318 312,338 C 352,355 372,408 420,418 L420,700 Z";
const WAVE_EDGE = "M0,590 C 60,560 110,500 168,420 C 214,356 264,318 312,338 C 352,355 372,408 420,418";

/** Decorative abstract gradient artwork for the sign-in and sign-up screens. */
export function AuthArt({ style, label }: { style?: StyleProp<ViewStyle>; label?: string }) {
  return (
    <View
      style={[{ overflow: "hidden", backgroundColor: "#1D1D29" }, style]}
      accessible={Boolean(label)}
      accessibilityLabel={label}
      accessibilityRole="image"
    >
      <Svg width="100%" height="100%" viewBox="0 0 420 700" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="field" x1="1" y1="0" x2="0.2" y2="1">
            <Stop offset="0" stopColor="#121219" />
            <Stop offset="0.5" stopColor="#1D1D29" />
            <Stop offset="1" stopColor="#2C2840" />
          </LinearGradient>
          <LinearGradient id="lobe" x1="0" y1="0" x2="1" y2="0.8">
            <Stop offset="0" stopColor="#1B1A27" />
            <Stop offset="0.55" stopColor="#2E2A45" />
            <Stop offset="0.85" stopColor="#4A3F7A" />
            <Stop offset="1" stopColor="#7C68D8" />
          </LinearGradient>
          <RadialGradient id="lobeShade" cx="0.05" cy="0.55" r="0.55">
            <Stop offset="0" stopColor="#08080D" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#08080D" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="wave" x1="0" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#3A3358" />
            <Stop offset="0.4" stopColor="#23222F" />
            <Stop offset="1" stopColor="#4B3F86" />
          </LinearGradient>
          <RadialGradient id="waveShade" cx="0.15" cy="0.95" r="0.5">
            <Stop offset="0" stopColor="#08080D" stopOpacity="0.7" />
            <Stop offset="1" stopColor="#08080D" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="limeRim" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F3FFC2" />
            <Stop offset="0.6" stopColor="#D5F26A" />
            <Stop offset="1" stopColor="#A9CF2F" />
          </LinearGradient>
          <LinearGradient id="lavenderRim" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F1EAFF" />
            <Stop offset="0.5" stopColor="#C9B6F6" />
            <Stop offset="1" stopColor="#9C87F0" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width="420" height="700" fill="url(#field)" />

        <Path d={LOBE} fill="url(#lobe)" />
        <Path d={LOBE} fill="url(#lobeShade)" />
        <Path d={LOBE_EDGE} stroke="url(#limeRim)" strokeOpacity={0.14} strokeWidth={26} fill="none" />
        <Path d={LOBE_EDGE} stroke="url(#limeRim)" strokeOpacity={0.3} strokeWidth={10} fill="none" />
        <Path d={LOBE_EDGE} stroke="url(#limeRim)" strokeOpacity={0.95} strokeWidth={2.5} fill="none" />

        <Path d={WAVE} fill="url(#wave)" />
        <Path d={WAVE} fill="url(#waveShade)" />
        <Path d={WAVE_EDGE} stroke="url(#lavenderRim)" strokeOpacity={0.16} strokeWidth={24} fill="none" />
        <Path d={WAVE_EDGE} stroke="url(#lavenderRim)" strokeOpacity={0.32} strokeWidth={9} fill="none" />
        <Path d={WAVE_EDGE} stroke="url(#lavenderRim)" strokeOpacity={0.9} strokeWidth={2.2} fill="none" />

        <Circle cx="352" cy="150" r="26" fill="#D5F26A" fillOpacity={0.9} />
        <Circle cx="352" cy="150" r="44" stroke="#D5F26A" strokeOpacity={0.25} strokeWidth={2} fill="none" />
      </Svg>
    </View>
  );
}
