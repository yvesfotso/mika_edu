import { Alert, Platform } from "react-native";

/** Alert.alert is a no-op on react-native-web, so fall back to the browser dialogs there. */
export function notify(message: string, title = ""): void {
  if (Platform.OS === "web") window.alert(title ? `${title}\n\n${message}` : message);
  else Alert.alert(title || message, title ? message : undefined);
}

export function confirm(title: string, message: string, labels: { ok: string; cancel: string }): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: labels.cancel, style: "cancel", onPress: () => resolve(false) },
      { text: labels.ok, onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}
