import { useMemo, useState } from 'react';
import { ListFooterLoader } from '../components/ListFooterLoader';
import { QueryError } from '../components/QueryError';
import { SearchableSelect } from '../components/SearchableSelect';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDepartmentOptions, useEmployeeDirectory } from '../features/directory/api';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../theme';
import type { EmployeeDirectoryEntry } from '../types/api';

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
}

function DirectoryRow({ item, colors, typography, styles }: { item: EmployeeDirectoryEntry; colors: ThemeColors; typography: Typography; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(item.full_name)}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={typography.heading}>{item.full_name}</Text>
        <Text style={typography.caption}>
          {item.designation ?? 'No designation'}
          {item.department ? ` · ${item.department.name}` : ''}
        </Text>
        <Pressable onPress={() => Linking.openURL(`mailto:${item.work_email}`)} style={{ marginTop: spacing.xs }}>
          <Text style={styles.link}>{item.work_email}</Text>
        </Pressable>
        {item.phone ? (
          <Pressable onPress={() => Linking.openURL(`tel:${item.phone}`)} style={{ marginTop: spacing.xs / 2 }}>
            <Text style={styles.link}>{item.phone}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function DirectoryScreen() {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState<number | 'all'>('all');

  const departmentsQuery = useDepartmentOptions();
  const query = useEmployeeDirectory({ search: search || undefined, department_id: department });

  const entries = query.items;
  const departmentOptions = [
    { value: 'all', label: 'All departments' },
    ...(departmentsQuery.data ?? []).map((dept) => ({ value: String(dept.id), label: dept.name })),
  ];

  return (
    <View style={styles.flex}>
      <View style={styles.toolbar}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or email…"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <SearchableSelect
          label="Department"
          placeholder="All departments"
          allowClear={false}
          value={String(department)}
          options={departmentOptions}
          onChange={(value) => {
            setDepartment(value === 'all' || value === null ? 'all' : Number(value));
          }}
        />
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <DirectoryRow item={item} colors={colors} typography={typography} styles={styles} />}
        refreshing={query.isRefetching}
        onRefresh={query.refetch}
        onEndReached={query.fetchMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={query.isError ? <QueryError retry={query.refetch} /> : null}
        ListFooterComponent={<ListFooterLoader visible={query.isFetchingNextPage} />}
        ListEmptyComponent={
          query.isError ? null : query.isLoading ? <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} /> : <Text style={[typography.caption, styles.empty]}>No colleagues found.</Text>
        }
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  toolbar: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, color: colors.ink, backgroundColor: colors.white },
  list: { padding: spacing.lg, paddingTop: spacing.sm },
  empty: { textAlign: 'center', marginTop: spacing.xl },
  card: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.pine, fontWeight: '700', fontSize: 13 },
  cardBody: { flex: 1 },
  link: { color: colors.pine, fontSize: 13 },
});
