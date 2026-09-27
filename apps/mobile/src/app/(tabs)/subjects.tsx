import { localize, type DashboardDto, type SubjectSummaryDto } from "@eduprep/core";
import { useWindowDimensions, View } from "react-native";
import { Grid, SubjectCard, columnsFor } from "@/components/subject-card";
import { OfflineNotice, Screen, StateView, T } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { cacheKey } from "@/lib/api";
import { store } from "@/lib/storage";
import { SIDEBAR_BREAKPOINT } from "@/lib/theme";
import { useSession } from "@/providers/session";

export default function Subjects() {
  const { t, locale, profile, userId } = useSession();
  const { width } = useWindowDimensions();
  const columns = columnsFor(width, width >= SIDEBAR_BREAKPOINT);
  const trackId = profile?.targetTrackId;
  const { data, error, loading, offline, refresh } = useApi<{ subjects: SubjectSummaryDto[] }>(trackId ? `/tracks/${trackId}/subjects` : null);
  const exam = userId ? store.get<DashboardDto>(cacheKey(userId, "/me/dashboard"))?.exam : null;
  const track = exam?.tracks.find((tr) => tr.id === trackId);

  if (!data) return <StateView loading={loading || !error} error={error} onRetry={refresh} />;

  // Subjects with content first, keeping the track's order otherwise.
  const subjects = [...data.subjects].sort((a, b) => Number(b.chapterCount > 0) - Number(a.chapterCount > 0));

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <OfflineNotice visible={offline} />
      <View style={{ gap: 4 }}>
        <T variant="title">{t("subjects")}</T>
        {exam && (
          <T variant="muted">
            {localize(exam.name, locale)}
            {track ? ` · ${localize(track.name, locale)}` : ""}
          </T>
        )}
      </View>
      <Grid items={subjects} columns={columns} keyOf={(s) => s.id} render={(s) => <SubjectCard subject={s} />} />
    </Screen>
  );
}
