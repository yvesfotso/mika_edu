import { Redirect } from "expo-router";
import { StateView } from "@/components/ui";
import { useSession } from "@/providers/session";

/** Entry gate: signed out → welcome, no exam chosen → onboarding, otherwise → home. */
export default function Index() {
  const { initializing, session, profile } = useSession();
  if (initializing) return <StateView loading />;
  if (!session) return <Redirect href="/welcome" />;
  if (!profile) return <StateView loading />;
  if (!profile.onboardingCompleted) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
