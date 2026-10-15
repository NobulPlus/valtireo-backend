import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  label: string;
  placeholder?: string;
  value: string | null;
  options: SearchableSelectOption[];
  onChange: (value: string | null) => void;
  allowClear?: boolean;
  clearLabel?: string;
  onSearch?: (query: string) => void;
  onEndReached?: () => void;
  isFetchingMore?: boolean;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  selectedLabel?: string;
}

/**
 * A searchable modal picker — the scalable replacement for a chip row once a
 * list (departments, resolvers, colleagues) can grow past a handful of items.
 */
export function SearchableSelect({ label, placeholder = 'Select…', value, options, onChange, allowClear = true, clearLabel = 'No preference', onSearch, onEndReached, isFetchingMore, loading, error, onRetry, selectedLabel }: SearchableSelectProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value);
  const needle = query.trim().toLowerCase();
  const filtered = needle && !onSearch
    ? options.filter((option) => option.label.toLowerCase().includes(needle) || option.sublabel?.toLowerCase().includes(needle))
    : options;
  const rows = allowClear ? [{ value: '', label: clearLabel }, ...filtered] : filtered;

  function handleSelect(nextValue: string) {
    onChange(nextValue === '' ? null : nextValue);
    setOpen(false);
    setQuery('');
    onSearch?.('');
  }

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={label}>
        <Text style={selected ? styles.triggerValue : styles.triggerPlaceholder} numberOfLines={1}>
          {selected ? selected.label : selectedLabel || placeholder}
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
            data={loading || error ? [] : rows}
            keyExtractor={(item) => item.value || '__clear__'}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            renderItem={({ item }) => (
              <Pressable style={styles.option} onPress={() => handleSelect(item.value)}>
                <Text style={[styles.optionLabel, item.value === (value ?? '') && styles.optionLabelActive]}>{item.label}</Text>
                {item.sublabel ? <Text style={styles.optionSublabel}>{item.sublabel}</Text> : null}
              </Pressable>
            )}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            ListFooterComponent={isFetchingMore ? <ActivityIndicator color={colors.pine} style={{ marginVertical: spacing.sm }} /> : null}
            ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Loading colleagues…' : error ? 'Could not load colleagues.' : 'No matches.'}</Text>}
          />
          {error ? <Pressable onPress={onRetry}><Text style={styles.closeButtonText}>Retry</Text></Pressable> : null}
          <Pressable style={styles.closeButton} onPress={() => setOpen(false)}>
            <Text style={styles.closeButtonText}>Close</Text>
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
  option: { paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.line },
  optionLabel: { fontSize: 14, color: colors.ink },
  optionLabelActive: { color: colors.pine, fontWeight: '700' },
  optionSublabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  empty: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: spacing.lg },
  closeButton: { alignItems: 'center', paddingVertical: spacing.sm },
  closeButtonText: { color: colors.pine, fontWeight: '600', fontSize: 13 },
});
