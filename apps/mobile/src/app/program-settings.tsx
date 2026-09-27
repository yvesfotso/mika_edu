import type { ExamDto, ProgramSettings } from "@eduprep/core";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ProgramSettingsEditor, programSettingsReady } from "@/components/program-settings-editor";
import { Button, Screen, StateView } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { errorMessage } from "@/lib/api";
import { notify } from "@/lib/dialog";
import { useSession } from "@/providers/session";

export default function ProgramSettingsScreen() {
  const { t, profile, updateProfile } = useSession();
  const { data, error, loading, refresh } = useApi<{ exams: ExamDto[] }>("/exams");
  const [draft, setDraft] = useState<ProgramSettings>(profile?.programSettings ?? {});
  const [saving, setSaving] = useState(false);

  const exam = data?.exams.find((e) => e.id === profile?.targetExamId);
  const trackId = profile?.targetTrackId;
  if (!exam || !trackId) return <StateView loading={loading || !error} error={error} onRetry={refresh} />;

  async function save() {
    setSaving(true);
    try {
      await updateProfile({ programSettings: draft });
      notify(t("saved"));
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/profile");
    } catch (err) {
      notify(errorMessage(err, t("offlineNoData")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={["left", "right", "bottom"]} maxWidth={680}>
      <Stack.Screen options={{ title: t("programSettings") }} />
      <ProgramSettingsEditor exam={exam} trackId={trackId} value={draft} onChange={setDraft} />
      <Button title={t("save")} icon="checkmark" loading={saving} disabled={!programSettingsReady(exam, draft)} onPress={save} />
    </Screen>
  );
}
