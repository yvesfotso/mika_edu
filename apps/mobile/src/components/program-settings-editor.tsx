import { localize, mentionFor, type ExamDto, type ProgramSettings } from "@eduprep/core";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useColors, toneFor } from "@/lib/theme";
import { useSession } from "@/providers/session";
import { subjectIcon, TileIcon } from "./dashboard/tile-icon";

/** Whether the settings are complete enough to save for this exam. */
export function programSettingsReady(exam: ExamDto, settings: ProgramSettings): boolean {
  const p = exam.program;
  if (p.kind === "grades") {
    const n = settings.subjects?.length ?? 0;
    return n >= p.minSubjects && n <= p.maxSubjects;
  }
  return settings.targetAverage !== undefined;
}

function Pill({ label, selected, onPress, small }: { label: string; selected: boolean; onPress: () => void; small?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      hitSlop={4}
      style={{
        minWidth: small ? 34 : 56,
        paddingHorizontal: small ? 10 : 16,
        paddingVertical: small ? 6 : 12,
        borderRadius: 999,
        alignItems: "center",
        backgroundColor: selected ? c.primary : c.background,
      }}
    >
      <Text style={{ fontWeight: "800", fontSize: small ? 13 : 16, color: selected ? c.primaryText : c.text }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Settings that depend on the exam's grading: subject choice and target grades for letter-graded
 * exams (GCE), a target average for averaged exams (Probatoire, BAC).
 */
export function ProgramSettingsEditor({
  exam,
  trackId,
  value,
  onChange,
}: {
  exam: ExamDto;
  trackId: string;
  value: ProgramSettings;
  onChange: (next: ProgramSettings) => void;
}) {
  const c = useColors();
  const { t, locale } = useSession();
  const program = exam.program;
  const subjects = exam.tracks.find((tr) => tr.id === trackId)?.subjects ?? [];

  if (program.kind === "grades") {
    const chosen = value.subjects ?? [];
    const grades = value.targetGrades ?? {};
    const toggle = (id: string) => {
      const next = chosen.includes(id) ? chosen.filter((s) => s !== id) : chosen.length < program.maxSubjects ? [...chosen, id] : chosen;
      const nextGrades = Object.fromEntries(Object.entries(grades).filter(([sid]) => next.includes(sid)));
      onChange({ subjects: next, targetGrades: nextGrades });
    };
    return (
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 13, color: c.muted, flex: 1 }}>
            {t("chooseSubjectsHint", { min: program.minSubjects, max: program.maxSubjects })}
          </Text>
          <View style={{ backgroundColor: c.strong, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: c.primary, fontWeight: "800", fontSize: 12 }}>{t("selectedCount", { n: chosen.length })}</Text>
          </View>
        </View>
        {subjects.map((s) => {
          const selected = chosen.includes(s.id);
          const disabled = !selected && chosen.length >= program.maxSubjects;
          return (
            <View
              key={s.id}
              style={{
                backgroundColor: c.card,
                borderRadius: 18,
                padding: 12,
                gap: 10,
                borderWidth: 2,
                borderColor: selected ? c.text : "transparent",
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <Pressable
                onPress={() => toggle(s.id)}
                disabled={disabled}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <TileIcon name={subjectIcon(s.icon)} tone={toneFor(s.id)} size={36} />
                <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: c.text }}>{localize(s.name, locale)}</Text>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 7,
                    borderWidth: selected ? 0 : 2,
                    borderColor: c.border,
                    backgroundColor: selected ? c.primary : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected && <Ionicons name="checkmark" size={16} color={c.primaryText} />}
                </View>
              </Pressable>
              {selected && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, color: c.muted }}>{t("targetGrade")}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {program.grades
                      .filter((g) => program.passGrades.includes(g))
                      .map((g) => (
                        <Pill key={g} small label={g} selected={grades[s.id] === g} onPress={() => onChange({ subjects: chosen, targetGrades: { ...grades, [s.id]: g } })} />
                      ))}
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  const targets: number[] = [];
  for (let v = program.passMark; v <= program.scale - 2; v++) targets.push(v);
  const mention = value.targetAverage !== undefined ? mentionFor(program, value.targetAverage) : null;

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {targets.map((v) => (
          <Pill key={v} label={`${v}`} selected={value.targetAverage === v} onPress={() => onChange({ targetAverage: v })} />
        ))}
      </View>
      {value.targetAverage !== undefined && (
        <View style={{ backgroundColor: c.strong, borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={{ color: c.primary, fontSize: 30, fontWeight: "800" }}>
            {value.targetAverage}
            <Text style={{ fontSize: 16, color: c.strongMuted }}>/{program.scale}</Text>
          </Text>
          {mention && <Text style={{ color: c.strongText, fontSize: 16, fontWeight: "700" }}>{localize(mention, locale)}</Text>}
        </View>
      )}
      <Text style={{ fontSize: 13, color: c.muted }}>{t("averageHint")}</Text>
      <View style={{ gap: 8 }}>
        {subjects.map((s) => (
          <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.card, borderRadius: 16, padding: 10 }}>
            <TileIcon name={subjectIcon(s.icon)} tone={toneFor(s.id)} size={32} />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: c.text }}>{localize(s.name, locale)}</Text>
            <Text style={{ fontSize: 12, color: c.muted }}>{t("compulsory")}</Text>
            <View style={{ backgroundColor: c.background, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: c.text }}>{t("coefficient", { n: s.coefficient })}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
