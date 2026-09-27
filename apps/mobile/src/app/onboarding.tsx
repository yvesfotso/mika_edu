import { localize, type ExamDto, type ProgramSettings } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import { getCalendars } from "expo-localization";
import { Redirect, router } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
import { Pressable, View } from "react-native";
import { TileIcon } from "@/components/dashboard/tile-icon";
import { ProgramSettingsEditor, programSettingsReady } from "@/components/program-settings-editor";
import { Button, Screen, StateView, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { store } from "@/lib/storage";
import { radius, spacing, toneFor, useColors, type TileTone } from "@/lib/theme";
import { useSession } from "@/providers/session";

const GOALS = [15, 30, 45, 60, 90];
const EXAMS_CACHE = "cache:public:/exams";

function Choice({
  label,
  detail,
  selected,
  onPress,
  icon,
  tone,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  icon?: ComponentProps<typeof Ionicons>["name"];
  tone?: TileTone;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        padding: 16,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: selected ? c.text : "transparent",
        backgroundColor: c.card,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {icon && tone && <TileIcon name={icon} tone={tone} size={42} />}
      <View style={{ flex: 1, gap: 3 }}>
        <T style={{ fontWeight: "600" }}>{label}</T>
        {detail ? <T variant="small">{detail}</T> : null}
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: selected ? 0 : 2,
          borderColor: c.border,
          backgroundColor: selected ? c.primary : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected && <Ionicons name="checkmark" size={15} color={c.primaryText} />}
      </View>
    </Pressable>
  );
}

function StepHeader({ step, total, title, subtitle }: { step: number; total: number; title: string; subtitle?: string }) {
  const c = useColors();
  const { t } = useSession();
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < step ? c.primary : c.track }} />
        ))}
      </View>
      <T variant="small">{t("stepOf", { i: step, n: total })}</T>
      <T variant="title">{title}</T>
      {subtitle ? <T variant="muted">{subtitle}</T> : null}
    </View>
  );
}

function GoalPill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 999,
        backgroundColor: selected ? c.primary : c.card,
      }}
    >
      <T style={{ fontWeight: "700", color: selected ? c.primaryText : c.text }}>{label}</T>
    </Pressable>
  );
}

async function fetchExams(): Promise<ExamDto[]> {
  const { exams } = await api.get<{ exams: ExamDto[] }>("/exams");
  store.set(EXAMS_CACHE, exams);
  return exams;
}

export default function Onboarding() {
  const { t, locale, profile, updateProfile } = useSession();
  const [exams, setExams] = useState<ExamDto[] | null>(() => store.get<ExamDto[]>(EXAMS_CACHE));
  const [error, setError] = useState<string | null>(null);
  const [examId, setExamId] = useState<string | null>(profile?.targetExamId ?? null);
  const [trackId, setTrackId] = useState<string | null>(profile?.targetTrackId ?? null);
  const [goal, setGoal] = useState(profile?.dailyGoalMinutes ?? 30);
  const [step, setStep] = useState<"exam" | "track" | "program" | "goal">("exam");
  const [programSettings, setProgramSettings] = useState<ProgramSettings>(profile?.programSettings ?? {});
  const [saving, setSaving] = useState(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    fetchExams().then(
      (fresh) => {
        if (!active) return;
        setExams(fresh);
        setError(null);
      },
      (err) => {
        if (active && !store.get(EXAMS_CACHE)) setError(errorMessage(err, t("offlineNoData")));
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, t]);

  const load = () => {
    setError(null);
    setAttempt((n) => n + 1);
  };

  const exam = exams?.find((e) => e.id === examId) ?? null;

  async function finish() {
    if (!examId || !trackId) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        targetExamId: examId,
        targetTrackId: trackId,
        programSettings,
        dailyGoalMinutes: goal,
        preferredLanguage: locale,
        timezone: getCalendars()[0]?.timeZone ?? undefined,
        onboardingCompleted: true,
      });
      router.replace("/(tabs)");
    } catch (err) {
      setError(errorMessage(err, t("offlineNoData")));
    } finally {
      setSaving(false);
    }
  }

  // The exam is locked after onboarding; changes go through the EduPrep team.
  if (profile && !profile.canChangeProgram) return <Redirect href="/(tabs)" />;
  if (!exams) return <StateView loading={!error} error={error} onRetry={load} />;

  const multiTrack = Boolean(exam && exam.tracks.length > 1);
  const total = multiTrack ? 4 : 3;
  const stepNumber = step === "exam" ? 1 : step === "track" ? 2 : step === "program" ? total - 1 : total;
  const programTitle = exam?.program.kind === "grades" ? t("whichSubjects") : t("whatTarget");

  return (
    <Screen maxWidth={620}>
      {step === "exam" && (
        <>
          <StepHeader step={stepNumber} total={total} title={t("whichExam")} />
          <View style={{ gap: spacing.sm + 2 }}>
            {exams.map((e) => (
              <Choice
                key={e.id}
                icon="school-outline"
                tone={toneFor(e.id)}
                label={localize(e.name, locale)}
                detail={localize(e.description, locale)}
                selected={e.id === examId}
                onPress={() => {
                  if (e.id !== examId) setTrackId(e.tracks.length === 1 ? e.tracks[0]!.id : null);
                  setExamId(e.id);
                }}
              />
            ))}
          </View>
          <Button title={t("continue")} variant="dark" disabled={!exam} onPress={() => {
              setProgramSettings({});
              setStep(multiTrack ? "track" : "program");
            }}
          />
        </>
      )}

      {step === "track" && exam && (
        <>
          <StepHeader step={stepNumber} total={total} title={t("whichTrack")} subtitle={localize(exam.name, locale)} />
          <View style={{ gap: spacing.sm + 2 }}>
            {exam.tracks.map((tr) => (
              <Choice
                key={tr.id}
                icon="git-branch-outline"
                tone={toneFor(tr.id)}
                label={localize(tr.name, locale)}
                selected={tr.id === trackId}
                onPress={() => setTrackId(tr.id)}
              />
            ))}
          </View>
          <Button
            title={t("continue")}
            variant="dark"
            disabled={!trackId}
            onPress={() => {
              setProgramSettings({});
              setStep("program");
            }}
          />
          <Button title={t("back")} variant="ghost" onPress={() => setStep("exam")} />
        </>
      )}

      {step === "program" && exam && trackId && (
        <>
          <StepHeader step={stepNumber} total={total} title={programTitle} subtitle={localize(exam.name, locale)} />
          <ProgramSettingsEditor exam={exam} trackId={trackId} value={programSettings} onChange={setProgramSettings} />
          <Button title={t("continue")} variant="dark" disabled={!programSettingsReady(exam, programSettings)} onPress={() => setStep("goal")} />
          <Button title={t("back")} variant="ghost" onPress={() => setStep(multiTrack ? "track" : "exam")} />
        </>
      )}

      {step === "goal" && (
        <>
          <StepHeader step={stepNumber} total={total} title={t("dailyGoal")} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm + 2 }}>
            {GOALS.map((g) => (
              <GoalPill key={g} label={t("minutesPerDay", { n: g })} selected={goal === g} onPress={() => setGoal(g)} />
            ))}
          </View>
          {error && <T variant="muted">{error}</T>}
          <Button title={t("startLearning")} loading={saving} disabled={!trackId} onPress={finish} />
          <Button title={t("back")} variant="ghost" onPress={() => setStep("program")} />
        </>
      )}
    </Screen>
  );
}
