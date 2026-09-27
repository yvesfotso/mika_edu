import { localize, mentionFor, type AttemptMode, type DashboardDto, type LocalizedText, type RecommendationDto, type SubjectSummaryDto } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useColors, toneFor, type TileTone } from "@/lib/theme";
import { useSession } from "@/providers/session";
import { ProgressRing } from "./progress-ring";
import { subjectIcon, TileIcon } from "./tile-icon";

type IconName = ComponentProps<typeof Ionicons>["name"];

export interface RecentAttempt {
  id: string;
  mode: AttemptMode;
  title: LocalizedText;
  submittedAt: string;
  score: number;
  maxScore: number;
  percentage: number;
}

export function Panel({
  title,
  action,
  children,
  style,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <View style={[{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 14 }, style]}>
      {(title || action) && (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {title ? (
            <Text style={{ fontSize: 17, fontWeight: "600", color: c.text }} accessibilityRole="header">
              {title}
            </Text>
          ) : (
            <View />
          )}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ fontSize: 17, fontWeight: "600", color: c.text }} accessibilityRole="header">
        {title}
      </Text>
      {action}
    </View>
  );
}

export function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8}>
      <Text style={{ fontSize: 12.5, color: c.muted, textDecorationLine: "underline" }}>{label}</Text>
    </Pressable>
  );
}

export function PlusButton({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}
    >
      {busy ? <ActivityIndicator size="small" color={c.primaryText} /> : <Ionicons name="add" size={18} color={c.primaryText} />}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Recommended chapters ("New courses" row)
// ---------------------------------------------------------------------------

function RecommendationCard({
  rec,
  tone,
  busy,
  onPress,
  width,
}: {
  rec: RecommendationDto;
  tone: TileTone;
  busy: boolean;
  onPress: () => void;
  width?: number;
}) {
  const c = useColors();
  const { t, locale } = useSession();
  const reason = { weak: t("reasonWeak"), forgetting: t("reasonForgetting"), not_started: t("reasonNotStarted") }[rec.reason];
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`${t("practice")}: ${localize(rec.chapterTitle, locale)}`}
      style={({ pressed }) => ({
        flex: width ? undefined : 1,
        width,
        minWidth: 180,
        backgroundColor: c.card,
        borderRadius: 22,
        padding: 16,
        gap: 16,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <TileIcon name="flash-outline" tone={tone} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: c.text }} numberOfLines={2}>
            {localize(rec.chapterTitle, locale)}
          </Text>
          <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }} numberOfLines={1}>
            {localize(rec.subjectName, locale)}
          </Text>
        </View>
        {busy && <ActivityIndicator color={c.text} />}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ gap: 3 }}>
          <Text style={{ fontSize: 11, color: c.muted }}>{t("masteryLabel")}</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: c.text }}>
            <Ionicons name="star" size={12} color="#F5B400" /> {Math.round(rec.mastery * 100)}%
          </Text>
        </View>
        <View style={{ gap: 3 }}>
          <Text style={{ fontSize: 11, color: c.muted }}>{t("statusLabel")}</Text>
          <Text style={{ fontSize: 13, fontWeight: "600", color: c.text }}>{reason}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function RecommendedRow({
  recs,
  busyId,
  onPractise,
  horizontal,
}: {
  recs: RecommendationDto[];
  busyId: string | null;
  onPractise: (chapterId: string) => void;
  horizontal: boolean;
}) {
  const tones: TileTone[] = ["peach", "mint", "lavender"];
  const cards = recs.map((rec, i) => (
    <RecommendationCard
      key={rec.chapterId}
      rec={rec}
      tone={tones[i % tones.length]!}
      busy={busyId === rec.chapterId}
      onPress={() => onPractise(rec.chapterId)}
      width={horizontal ? 230 : undefined}
    />
  ));
  if (horizontal) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
        {cards}
      </ScrollView>
    );
  }
  return <View style={{ flexDirection: "row", gap: 14 }}>{cards}</View>;
}

// ---------------------------------------------------------------------------
// Today's plan ("Daily schedule")
// ---------------------------------------------------------------------------

export interface PlanItem {
  key: string;
  icon: IconName;
  tone: TileTone;
  title: string;
  subtitle: string;
  onPress?: () => void;
  busy?: boolean;
}

export function PlanList({ items }: { items: PlanItem[] }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      {items.map((item) => {
        const content = (
          <>
            <TileIcon name={item.icon} tone={item.tone} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, fontWeight: "600", color: c.text }} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </View>
            {item.busy ? (
              <ActivityIndicator color={c.text} />
            ) : item.onPress ? (
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="chevron-forward" size={14} color={c.text} />
              </View>
            ) : null}
          </>
        );
        const rowStyle = { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, paddingVertical: 6 };
        return item.onPress ? (
          <Pressable key={item.key} onPress={item.onPress} accessibilityRole="button" style={({ pressed }) => [rowStyle, { opacity: pressed ? 0.7 : 1 }]}>
            {content}
          </Pressable>
        ) : (
          <View key={item.key} style={rowStyle}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Subjects in progress ("Course you're taking")
// ---------------------------------------------------------------------------

export function SubjectRows({ subjects, onOpen }: { subjects: SubjectSummaryDto[]; onOpen: (id: string) => void }) {
  const c = useColors();
  const { t, locale } = useSession();
  return (
    <View style={{ gap: 10 }}>
      {subjects.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => onOpen(s.id)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            backgroundColor: c.card,
            borderRadius: 18,
            padding: 12,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <TileIcon name={subjectIcon(s.icon)} tone={toneFor(s.id)} size={40} />
          <View style={{ flex: 1.4 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: c.text }} numberOfLines={1}>
              {localize(s.name, locale)}
            </Text>
            <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>
              {t("chapters", { n: s.chapterCount })}
              {s.targetGrade ? ` · ${t("targetChip", { grade: s.targetGrade })}` : ""}
            </Text>
          </View>
          <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: c.text }}>{t("coefficient", { n: s.coefficient })}</Text>
          <ProgressRing value={s.mastery} />
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Exam card ("Go premium")
// ---------------------------------------------------------------------------

export function ExamCard({ data, onMock, busy }: { data: DashboardDto; onMock?: () => void; busy: boolean }) {
  const c = useColors();
  const { t, locale } = useSession();
  if (!data.exam) return null;
  const examName = localize(data.exam.name, locale);
  const track = data.exam.tracks.find((tr) => tr.id === data.profile.targetTrackId);
  const program = data.exam.program;
  const settings = data.profile.programSettings;
  const mention = program.kind === "average" && settings?.targetAverage !== undefined ? mentionFor(program, settings.targetAverage) : null;
  const goal =
    program.kind === "average" && settings?.targetAverage !== undefined
      ? `${t("goalAverage", { avg: settings.targetAverage, scale: program.scale })}${mention ? ` · ${localize(mention, locale)}` : ""}`
      : program.kind === "grades" && settings?.subjects?.length
        ? t("subjectsCount", { n: settings.subjects.length })
        : null;
  const countdown =
    data.daysUntilExam === null
      ? t("examDateUnknown", { exam: examName })
      : data.daysUntilExam === 0
        ? t("examToday", { exam: examName })
        : data.daysUntilExam > 0
          ? t("daysToExam", { n: data.daysUntilExam, exam: examName })
          : examName;

  return (
    <View style={{ backgroundColor: c.strong, borderRadius: 22, padding: 18, overflow: "hidden", minHeight: 170 }}>
      <View style={{ position: "absolute", right: -30, top: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: c.strongRaised }} />
      <View
        style={{
          position: "absolute",
          right: 18,
          bottom: 18,
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: c.primary,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ rotate: "-8deg" }],
        }}
      >
        <Ionicons name="school" size={32} color={c.primaryText} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="school-outline" size={14} color="#FFFFFF" />
        <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600" }}>{t("appName")}</Text>
      </View>
      <Text style={{ color: "#FFFFFF", fontSize: 21, fontWeight: "700", marginTop: 12, marginRight: 70, letterSpacing: -0.3 }} numberOfLines={2}>
        {track ? t("chosenSeries", { exam: examName, track: localize(track.name, locale) }) : examName}
      </Text>
      <Text style={{ color: c.strongMuted, fontSize: 12, marginTop: 6, marginRight: 80 }}>{countdown}</Text>
      {goal && (
        <View style={{ alignSelf: "flex-start", marginTop: 10, backgroundColor: c.strongRaised, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
          <Text style={{ color: c.primary, fontSize: 12.5, fontWeight: "800" }}>{goal}</Text>
        </View>
      )}
      {onMock && (
        <Pressable
          onPress={onMock}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            marginTop: 16,
            backgroundColor: c.primary,
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 9,
            opacity: pressed ? 0.85 : 1,
            flexDirection: "row",
            gap: 6,
            alignItems: "center",
          })}
        >
          {busy && <ActivityIndicator size="small" color={c.primaryText} />}
          <Text style={{ color: c.primaryText, fontSize: 12.5, fontWeight: "700" }}>{t("examCardCta")}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Recent quizzes ("Assignments")
// ---------------------------------------------------------------------------

const MODE_TILE: Record<AttemptMode, [IconName, TileTone]> = {
  practice: ["create-outline", "lavender"],
  mock: ["timer-outline", "peach"],
  past_paper: ["document-text-outline", "sky"],
};

export function RecentQuizzes({ attempts, onOpen }: { attempts: RecentAttempt[]; onOpen: (id: string) => void }) {
  const c = useColors();
  const { t, locale } = useSession();
  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  const when = new Intl.DateTimeFormat(tag, { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });

  if (attempts.length === 0) {
    return <Text style={{ fontSize: 13, color: c.muted }}>{t("noAttempts")}</Text>;
  }
  return (
    <View style={{ gap: 10 }}>
      {attempts.map((a) => {
        const [icon, tone] = MODE_TILE[a.mode];
        const status: [string, TileTone] =
          a.percentage >= 70 ? [t("scoreGreat"), "mint"] : a.percentage >= 50 ? [t("scoreGood"), "lavender"] : [t("scoreReview"), "peach"];
        return (
          <Pressable
            key={a.id}
            onPress={() => onOpen(a.id)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: c.card,
              borderRadius: 18,
              padding: 12,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <TileIcon name={icon} tone={tone} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: c.text }} numberOfLines={1}>
                {localize(a.title, locale)}
              </Text>
              <Text style={{ fontSize: 11.5, color: c.muted, marginTop: 2 }}>{when.format(new Date(a.submittedAt))}</Text>
            </View>
            <View style={{ backgroundColor: c.tiles[status[1]].bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 11.5, fontWeight: "600", color: c.tiles[status[1]].ink }}>
                {status[0]} · {Math.round(a.percentage)}%
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
