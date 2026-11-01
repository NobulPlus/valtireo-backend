import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';

export interface MultiSearchableOption {
  value: number;
  label: string;
  sublabel?: string;
}

interface MultiSearchableSelectProps {
  label: string;
  placeholder?: string;
  values: number[];
  options: MultiSearchableOption[];
  onChange: (values: number[]) => void;
  onSearch?: (query: string) => void;
  onEndReached?: () => void;
  isFetchingMore?: boolean;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** Direct messages need exactly one other person — picking a second replaces the first instead of adding to it. */
  single?: boolean;
}

/**
 * {@link SearchableSelect}'s sibling for picking several colleagues at once (a new
 * group/channel's members, or who to add to one) — rows stay checked and the sheet
 * stays open until the viewer taps Done, instead of closing on the first tap.
 */
export function MultiSearchableSelect({ label, placeholder = 'Select…', values, options, onChange, onSearch, onEndReached, isFetchingMore, loading, error, onRetry, single }: MultiSearchableSelectProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();
  const filtered = needle && !onSearch
    ? options.filter((option) => option.label.toLowerCase().includes(needle) || option.sublabel?.toLowerCase().includes(needle))
    : options;
  const selectedLabels = options.filter((option) => values.includes(option.value)).map((option) => option.label);

  function toggle(value: number) {
    if (single) { onChange([value]); setOpen(false); setQuery(''); onSearch?.(''); return; }
    onChange(values.includes(value) ? values.filter((id) => id !== value) : [...values, value]);
  }

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={label}>
        <Text style={selectedLabels.length ? styles.triggerValue : styles.triggerPlaceholder} numberOfLines={1}>
          {selectedLabels.length ? selectedLabels.join(', ') : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{label}</Text>
          <TextInput
            value={query}
            onChangeText={(text) => { setQuery(text); onSearch?.(text); }}
            placeholder="Search…"
            placeholderTextColor={colors.muted}
            style={styles.search}
            autoFocus
          />
          <FlatList
            data={loading || error ? [] : filtered}
            keyExtractor={(item) => String(item.value)}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            renderItem={({ item }) => {
              const checked = values.includes(item.value);
              return (
                <Pressable style={styles.option} onPress={() => toggle(item.value)} accessibilityRole="checkbox" accessibilityState={{ checked }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, checked && styles.optionLabelActive]}>{item.label}</Text>
                    {item.sublabel ? <Text style={styles.optionSublabel}>{item.sublabel}</Text> : null}
                  </View>
                  {checked ? <Ionicons name="checkmark-circle" size={20} color={colors.pine} /> : <Ionicons name="ellipse-outline" size={20} color={colors.line} />}
                </Pressable>
              );
            }}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            ListFooterComponent={isFetchingMore ? <ActivityIndicator color={colors.pine} style={{ marginVertical: spacing.sm }} /> : null}
            ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Loading colleagues…' : error ? 'Could not load colleagues.' : 'No matches.'}</Text>}
          />
          {error ? <Pressable onPress={onRetry}><Text style={styles.closeButtonText}>Retry</Text></Pressable> : null}
          <Pressable style={styles.closeButton} onPress={() => setOpen(false)}>
            <Text style={styles.closeButtonText}>{values.length ? `Done · ${values.length} selected` : 'Close'}</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.white,
  },
  triggerValue: { fontSize: 14, color: colors.ink, flex: 1, marginRight: spacing.sm },
  triggerPlaceholder: { fontSize: 14, color: colors.muted, flex: 1, marginRight: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '75%' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: spacing.md },
  search: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.white,
    marginBottom: spacing.sm,
  },
  list: { marginBottom: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.line },
  optionLabel: { fontSize: 14, color: colors.ink },
  optionLabelActive: { color: colors.pine, fontWeight: '700' },
  optionSublabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  empty: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: spacing.lg },
  closeButton: { alignItems: 'center', paddingVertical: spacing.sm },
  closeButtonText: { color: colors.pine, fontWeight: '600', fontSize: 13 },
});
