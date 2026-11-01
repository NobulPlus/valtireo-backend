import { useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { ProductIconField } from '../components/ProductIconField';
import { useConnectCalls } from '../features/connect/api';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';

export function ConnectCallsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const query = useConnectCalls(true);
  const calls = query.data?.calls.data ?? [];

  return (
    <View style={styles.flex}>
      <ProductIconField />
      {query.data && !query.data.media_ready ? (
        <Text style={styles.notice}>Live audio is awaiting media-service configuration. Messaging and voice notes remain available.</Text>
      ) : null}
      <FlatList
        data={calls}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={query.isLoading ? <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} /> : <Text style={styles.empty}>No calls yet.</Text>}
        renderItem={({ item }) => {
          const person = item.incoming ? item.caller : item.callee;
          return (
            <View style={styles.row}>
              <Avatar name={person.name} uri={person.photo_url} size={36} fallbackColor={colors.chip} fallbackTextColor={colors.pine} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{person.name}</Text>
                <Text style={styles.meta}>{item.incoming ? 'Incoming' : 'Outgoing'} · {item.status} · {new Date(item.created_at).toLocaleString()}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  notice: { fontSize: 12, color: colors.muted, padding: spacing.lg, paddingBottom: 0 },
  list: { padding: spacing.lg, gap: spacing.sm },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.xl, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.line },
  name: { fontSize: 14, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2, textTransform: 'capitalize' },
});
