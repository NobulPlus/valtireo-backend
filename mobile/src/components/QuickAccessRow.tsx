import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { IconTile } from './IconTile';
import { QUICK_ACCESS_SLOTS, useQuickAccessOrder } from '../lib/quickAccess';
import type { MoreMenuItem, MoreMenuItemKey } from '../lib/moreMenuItems';
import { radius, spacing, useTheme, v2ModuleColors, type ThemeColors } from '../theme';

/**
 * Home's customizable Quick Access row — hold a tile to drag-reorder it (the
 * standard home-screen-icon gesture), or tap the pencil to swap which four of
 * the More menu's features show here at all. Always exactly four tiles, one
 * line — see useQuickAccessOrder for how the saved order/selection is resolved
 * and backfilled.
 */
const ROW_GAP = spacing.sm;

export function QuickAccessRow({ onNavigate }: { onNavigate: (key: MoreMenuItemKey) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { items, eligible, setOrder, isLoaded } = useQuickAccessOrder();
  const [editing, setEditing] = useState(false);
  const [rowWidth, setRowWidth] = useState(0);
  const tileWidth = rowWidth > 0 ? (rowWidth - ROW_GAP * (QUICK_ACCESS_SLOTS - 1)) / QUICK_ACCESS_SLOTS : undefined;

  if (!isLoaded) return null;

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>Quick access</Text>
        <Pressable accessibilityLabel="Customize quick access" onPress={() => setEditing(true)} style={styles.editButton}>
          <Ionicons name="pencil-outline" size={14} color={colors.muted} />
        </Pressable>
      </View>

      <DraggableFlatList
        data={items}
        horizontal
        scrollEnabled={false}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.row}
        onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
        onDragEnd={({ data }) => setOrder(data.map((item) => item.key))}
        renderItem={({ item, drag, isActive }: RenderItemParams<MoreMenuItem>) => (
          <IconTile
            icon={item.icon}
            label={item.label}
            bg={v2ModuleColors[item.moduleColorKey].icon}
            iconColor="#FFFFFF"
            widthPercent={tileWidth ?? '22%'}
            onPress={() => onNavigate(item.key)}
            onLongPress={drag}
            dragging={isActive}
          />
        )}
      />

      <Modal visible={editing} animationType="slide" transparent onRequestClose={() => setEditing(false)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Quick access</Text>
          <Text style={styles.sheetHint}>Choose up to {QUICK_ACCESS_SLOTS}. Hold a tile on Home to reorder them.</Text>
          {eligible.map((item) => {
            const checked = items.some((selected) => selected.key === item.key);
            return (
              <Pressable
                key={item.key}
                style={styles.option}
                onPress={() => {
                  if (checked) {
                    setOrder(items.filter((selected) => selected.key !== item.key).map((selected) => selected.key));
                  } else if (items.length < QUICK_ACCESS_SLOTS) {
                    setOrder([...items.map((selected) => selected.key), item.key]);
                  }
                }}
              >
                <View style={[styles.optionIcon, { backgroundColor: v2ModuleColors[item.moduleColorKey].icon }]}>
                  <Ionicons name={item.icon} size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.optionLabel}>{item.label}</Text>
                {checked ? <Ionicons name="checkmark-circle" size={20} color={colors.pine} /> : <Ionicons name="ellipse-outline" size={20} color={colors.line} />}
              </Pressable>
            );
          })}
          <Pressable style={styles.closeButton} onPress={() => setEditing(false)}>
            <Text style={styles.closeButtonText}>Done</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  editButton: { padding: 6 },
  row: { flexDirection: 'row', columnGap: ROW_GAP, marginTop: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '75%' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  sheetHint: { fontSize: 12, color: colors.muted, marginBottom: spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.line },
  optionIcon: { width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { flex: 1, fontSize: 14, color: colors.ink },
  closeButton: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  closeButtonText: { color: colors.pine, fontWeight: '700', fontSize: 15 },
});
