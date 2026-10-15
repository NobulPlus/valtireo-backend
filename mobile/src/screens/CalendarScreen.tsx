import { useMemo } from 'react';
import { QueryError } from '../components/QueryError';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAgenda, type AgendaItem } from '../features/calendar/api';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../theme';

const KIND_LABELS: Record<AgendaItem['kind'], string> = {
  holiday: 'Holiday',
  event: 'Company event',
  leave: 'My leave',
};

function formatRange(date: string, endDate: string): string {
  return date === endDate ? date : `${date} → ${endDate}`;
}

function AgendaRow({ item, colors, typography, styles }: { item: AgendaItem; colors: ThemeColors; typography: Typography; styles: ReturnType<typeof makeStyles> }) {
  const kindColors: Record<AgendaItem['kind'], string> = { holiday: colors.warning, event: colors.pine, leave: colors.success };
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={typography.heading}>{item.title}</Text>
        <Text style={[styles.kind, { color: kindColors[item.kind] }]}>{KIND_LABELS[item.kind]}</Text>
      </View>
      <Text style={typography.body}>{formatRange(item.date, item.endDate)}</Text>
      {item.subtitle ? <Text style={typography.caption}>{item.subtitle}</Text> : null}
    </View>
  );
}

export function CalendarScreen() {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { items, isLoading, isError, isRefetching, refetch, canLoadMore, loadMore } = useAgenda();

  return (
    <View style={styles.flex}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <AgendaRow item={item} colors={colors} typography={typography} styles={styles} />}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListHeaderComponent={isError ? <QueryError retry={refetch} /> : null}
        ListFooterComponent={
          canLoadMore ? (
            <Pressable onPress={loadMore} disabled={isRefetching} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
              <Text style={styles.link}>Load more</Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          isError ? null : isLoading ? <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} /> : <Text style={[typography.caption, styles.empty]}>Nothing coming up.</Text>
        }
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  list: { padding: spacing.lg },
  empty: { textAlign: 'center', marginTop: spacing.xl },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs, gap: spacing.sm },
  kind: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  link: { color: colors.pine, fontWeight: '600', fontSize: 13 },
});
