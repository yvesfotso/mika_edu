import { Ionicons } from "@expo/vector-icons";
import { useState, type ComponentProps, type Ref } from "react";
import { Platform, Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { useColors } from "@/lib/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Pill-shaped input with an optional trailing icon (or icon button). */
export function PillInput({
  icon,
  onIconPress,
  iconLabel,
  label,
  hint,
  ref,
  ...props
}: TextInputProps & {
  icon?: IconName;
  onIconPress?: () => void;
  iconLabel?: string;
  /** Visible label above the field; the placeholder is used when omitted. */
  label?: string;
  hint?: string;
  ref?: Ref<TextInput>;
}) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label && <Text style={{ fontSize: 13, fontWeight: "600", color: c.text, marginLeft: 6 }}>{label}</Text>}
      <View
        style={{
          height: 50,
          borderWidth: 1.5,
          borderRadius: 999,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: c.card,
          borderColor: focused ? c.text : c.border,
        }}
      >
        <TextInput
          ref={ref}
          placeholderTextColor={c.faint}
          accessibilityLabel={label ?? props.placeholder}
          style={[{ flex: 1, fontSize: 15, color: c.text, height: "100%" }, Platform.OS === "web" && ({ outlineStyle: "none" } as object)]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {icon &&
          (onIconPress ? (
            <Pressable onPress={onIconPress} accessibilityRole="button" accessibilityLabel={iconLabel} hitSlop={10}>
              <Ionicons name={icon} size={18} color={c.faint} />
            </Pressable>
          ) : (
            <Ionicons name={icon} size={18} color={c.faint} />
          ))}
      </View>
      {hint && <Text style={{ fontSize: 12, color: c.muted, marginLeft: 6 }}>{hint}</Text>}
    </View>
  );
}
