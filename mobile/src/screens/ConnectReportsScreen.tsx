import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingScreen } from '../components/KeyboardAvoidingScreen';
import { ProductIconField } from '../components/ProductIconField';
import { useConnectReports, useModerateReport } from '../features/connect/api';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';

export function ConnectReportsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const query = useConnectReports();
  const moderate = useModerateReport();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  function submit(action: 'hide' | 'dismiss') {
    if (!activeId || !reason.trim()) return;
    moderate.mutate({ reportId: activeId, action, reason: reason.trim() }, { onSuccess: () => { setActiveId(null); setReason(''); } });
  }

  return (
    <View style={styles.flex}>
      <ProductIconField />
      <KeyboardAvoidingScreen>
      <Text style={styles.notice}>Only reported excerpts are shown. Private conversations remain membership-only.</Text>
      <FlatList
        data={query.items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        onEndReached={query.fetchMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.pine} /> : null}
        ListEmptyComponent={query.isLoading ? <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} /> : <Text style={styles.empty}>No reported messages.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.body}>{item.body ?? 'Message removed'}</Text>
            <Text style={styles.meta}>Report: {item.reason} · {item.status}</Text>
            {item.status === 'open' ? (
              activeId === item.id ? (
                <View style={styles.reasonRow}>
                  <TextInput value={reason} onChangeText={setReason} placeholder="Reason for this decision" placeholderTextColor={colors.muted} style={styles.reasonInput} autoFocus />
                  <Pressable accessibilityLabel="Hide message" style={styles.iconButton} onPress={() => submit('hide')}><Ionicons name="ban-outline" size={18} color={colors.danger} /></Pressable>
                  <Pressable accessibilityLabel="Dismiss report" style={styles.iconButton} onPress={() => submit('dismiss')}><Ionicons name="checkmark" size={18} color={colors.pine} /></Pressable>
                  <Pressable accessibilityLabel="Cancel" style={styles.iconButton} onPress={() => setActiveId(null)}><Ionicons name="close" size={18} color={colors.muted} /></Pressable>
                </View>
              ) : (
                <Pressable style={styles.decideButton} onPress={() => { setActiveId(item.id); setReason(''); }}>
                  <Text style={styles.decideLabel}>Decide</Text>
                </Pressable>
              )
            ) : null}
          </View>
        )}
      />
      </KeyboardAvoidingScreen>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  notice: { fontSize: 12, color: colors.muted, padding: spacing.lg, paddingBottom: 0 },
  list: { padding: spacing.lg, gap: spacing.sm },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.xl, fontSize: 13 },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.line, gap: spacing.xs },
  body: { fontSize: 14, color: colors.ink },
  meta: { fontSize: 12, color: colors.muted },
  decideButton: { alignSelf: 'flex-start', marginTop: spacing.xs },
  decideLabel: { color: colors.pine, fontWeight: '700', fontSize: 13 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  reasonInput: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 8, fontSize: 13, color: colors.ink, backgroundColor: colors.paper },
  iconButton: { padding: 6 },
});
