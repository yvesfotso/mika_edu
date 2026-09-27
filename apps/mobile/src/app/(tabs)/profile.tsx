import { localize, mentionFor, type DashboardDto, type ExamDto } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Panel } from "@/components/dashboard/sections";
import { TileIcon } from "@/components/dashboard/tile-icon";
import { Button, Screen, T } from "@/components/ui";
import { api, cacheKey, errorMessage } from "@/lib/api";
import { notify } from "@/lib/dialog";
import { store } from "@/lib/storage";
import { setThemePreference, SIDEBAR_BREAKPOINT, spacing, useColors, useThemePreference } from "@/lib/theme";
import { useSession } from "@/providers/session";

const GOALS = [15, 30, 45, 60, 90];

function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: selected ? c.primary : c.background }}
    >
      <Text style={{ color: selected ? c.primaryText : c.text, fontWeight: "700", fontSize: 13.5 }}>{label}</Text>
    </Pressable>
  );
}

export default function Profile() {
  const c = useColors();
  const { t, locale, setLocale, profile, session, userId, updateProfile, pendingSync, syncNow, signOut } = useSession();
  const { width } = useWindowDimensions();
  const wide = width >= SIDEBAR_BREAKPOINT;
  const [syncing, setSyncing] = useState(false);
  const themePref = useThemePreference();
  const dashboard = userId ? store.get<DashboardDto>(cacheKey(userId, "/me/dashboard")) : null;
  const exams = store.get<ExamDto[]>("cache:public:/exams");
  const exam = dashboard?.exam ?? exams?.find((e) => e.id === profile?.targetExamId);
  const track = exam?.tracks.find((tr) => tr.id === profile?.targetTrackId);
  const name = profile?.displayName ?? "";
  const [contacting, setContacting] = useState(false);
  const settings = profile?.programSettings;
  const subjectNames = new Map((track?.subjects ?? []).map((s) => [s.id, localize(s.name, locale)]));
  const program = exam?.program;
  const mention = program && settings?.targetAverage !== undefined ? mentionFor(program, settings.targetAverage) : null;

  async function contactTeam() {
    setContacting(true);
    try {
      const { conversationId } = await api.post<{ conversationId: string }>("/conversations/support");
      router.push(`/chat/${conversationId}`);
    } catch (err) {
      notify(errorMessage(err, t("offlineNoData")));
    } finally {
      setContacting(false);
    }
  }

  async function setGoal(minutes: number) {
    try {
      await updateProfile({ dailyGoalMinutes: minutes });
    } catch (err) {
      notify(errorMessage(err, t("offlineNoData")));
    }
  }

  const identity = (
    <View style={{ backgroundColor: c.strong, borderRadius: 22, padding: 20, flexDirection: "row", alignItems: "center", gap: 16, overflow: "hidden" }}>
      <View style={{ position: "absolute", right: -30, top: -30, width: 130, height: 130, borderRadius: 65, backgroundColor: c.strongRaised }} />
      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: c.primaryText }}>{(name.trim()[0] ?? "?").toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.strongText, fontSize: 20, fontWeight: "700" }} numberOfLines={1}>
          {name || t("profile")}
        </Text>
        <Text style={{ color: c.strongMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
          {session?.email}
        </Text>
      </View>
    </View>
  );

  const plan = (
    <Panel title={t("yourPlan")}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TileIcon name="school-outline" tone="lavender" size={42} />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "600" }}>{exam ? localize(exam.name, locale) : t("changeExam")}</T>
          {track && <T variant="small">{localize(track.name, locale)}</T>}
        </View>
        {profile?.canChangeProgram ? (
          <Button title={t("changeExam")} variant="secondary" compact onPress={() => router.push("/onboarding")} />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: c.background, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Ionicons name="lock-closed" size={13} color={c.text} />
            <Text style={{ fontSize: 12.5, fontWeight: "700", color: c.text }}>{t("examLocked")}</Text>
          </View>
        )}
      </View>
      {!profile?.canChangeProgram && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.background, borderRadius: 16, padding: 12 }}>
          <T variant="small" style={{ flex: 1 }}>
            {t("examLockedText")}
          </T>
          <Button title={t("contactTeam")} variant="dark" compact icon="chatbubble-ellipses-outline" loading={contacting} onPress={contactTeam} />
        </View>
      )}
      <T variant="small">{t("dailyGoal")}</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {GOALS.map((g) => (
          <Pill key={g} label={t("minutes", { n: g })} selected={profile?.dailyGoalMinutes === g} onPress={() => setGoal(g)} />
        ))}
      </View>
    </Panel>
  );

  const programPanel = program && (
    <Panel
      title={t("programSettings")}
      action={<Button title={t("editProgramSettings")} variant="secondary" compact icon="create-outline" onPress={() => router.push("/program-settings")} />}
    >
      {program.kind === "grades" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(settings?.subjects ?? []).map((id) => (
            <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.background, borderRadius: 999, paddingLeft: 12, paddingRight: 4, paddingVertical: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: c.text }}>{subjectNames.get(id) ?? "—"}</Text>
              <View style={{ minWidth: 26, height: 26, borderRadius: 13, backgroundColor: settings?.targetGrades?.[id] ? c.primary : c.card, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: c.primaryText }}>{settings?.targetGrades?.[id] ?? "–"}</Text>
              </View>
            </View>
          ))}
          {(settings?.subjects ?? []).length === 0 && <T variant="small">{t("chooseSubjectsHint", { min: program.minSubjects, max: program.maxSubjects })}</T>}
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: c.text }}>
            {settings?.targetAverage ?? "–"}
            <Text style={{ fontSize: 15, color: c.muted }}>/{program.scale}</Text>
          </Text>
          {mention && (
            <View style={{ backgroundColor: c.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ fontWeight: "800", color: c.primaryText }}>{localize(mention, locale)}</Text>
            </View>
          )}
        </View>
      )}
    </Panel>
  );

  const language = (
    <Panel title={t("language")}>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Pill label="English" selected={locale === "en"} onPress={() => setLocale("en")} />
        <Pill label="Français" selected={locale === "fr"} onPress={() => setLocale("fr")} />
      </View>
    </Panel>
  );

  const appearance = (
    <Panel title={t("appearance")}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        <Pill label={t("themeLight")} selected={themePref === "light"} onPress={() => setThemePreference("light")} />
        <Pill label={t("themeDark")} selected={themePref === "dark"} onPress={() => setThemePreference("dark")} />
        <Pill label={t("themeSystem")} selected={themePref === "system"} onPress={() => setThemePreference("system")} />
      </View>
    </Panel>
  );

  const offline = (
    <Panel title={t("offlineData")}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TileIcon name={pendingSync > 0 ? "cloud-upload-outline" : "cloud-done-outline"} tone={pendingSync > 0 ? "lemon" : "mint"} size={38} />
        <T style={{ flex: 1 }}>{pendingSync > 0 ? t("pendingSync", { n: pendingSync }) : t("allSynced")}</T>
        {pendingSync > 0 && (
          <Button
            title={t("syncNow")}
            variant="dark"
            compact
            loading={syncing}
            onPress={async () => {
              setSyncing(true);
              await syncNow();
              setSyncing(false);
            }}
          />
        )}
      </View>
      <Button
        title={t("clearOffline")}
        variant="secondary"
        icon="trash-outline"
        onPress={() => {
          if (userId) store.removePrefix(`cache:${userId}:/lessons/`);
        }}
      />
    </Panel>
  );

  const signOutButton = (
    <Button title={t("signOut")} variant="dark" icon="log-out-outline" onPress={() => void signOut().then(() => router.replace("/welcome"))} />
  );

  return (
    <Screen>
      <T variant="title">{t("profile")}</T>
      {wide ? (
        <View style={{ flexDirection: "row", gap: 22, alignItems: "flex-start" }}>
          <View style={{ flex: 1, gap: 18 }}>
            {identity}
            {plan}
            {programPanel}
          </View>
          <View style={{ flex: 1, gap: 18 }}>
            {language}
            {appearance}
            {offline}
            {signOutButton}
          </View>
        </View>
      ) : (
        <>
          {identity}
          {plan}
          {programPanel}
          {language}
          {appearance}
          {offline}
          {signOutButton}
        </>
      )}
    </Screen>
  );
}
