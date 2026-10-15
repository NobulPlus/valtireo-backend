import { useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Avatar';
import { DecorativeAccents } from '../components/DecorativeAccents';
import { IconTile } from '../components/IconTile';
import { useMyDashboard } from '../features/dashboard/api';
import { downloadAndShare } from '../features/leave/api';
import { useUnreadNotificationCount } from '../features/notifications/api';
import { getGreeting, type GreetingPeriod } from '../lib/greeting';
import { radius, shadow, spacing, useTheme, useV2Colors, v2ModuleColors, V2_FONTS, type ThemePreference, type V2Colors } from '../theme';
import type { HomeStackParamList } from '../navigation/HomeStack';
import type { MainTabParamList } from '../navigation/MainTabs';
import type { MoreStackParamList } from '../navigation/MoreStack';

type Props = CompositeScreenProps<NativeStackScreenProps<HomeStackParamList, 'Home'>, BottomTabScreenProps<MainTabParamList>>;

type MoreDestination = Exclude<keyof MoreStackParamList, 'MoreMenu'>;

/**
 * Jumping into a MoreTab screen from Home must not just push onto whatever
 * MoreTab's stack already has — bottom-tabs keeps every tab's nested stack
 * alive across tab switches, so repeated Home shortcuts into different
 * features (Documents, then Assets, ...) would otherwise pile up into one
 * unrelated back-stack, and pressing back from Assets would land on
 * Documents instead of the More menu. Reset to the menu first, then push the
 * destination — but only when actually switching features, so reopening the
 * same feature you're already in (e.g. tapping "My assets" again while still
 * on Assets) doesn't discard its in-progress state.
 */
function currentMoreTabScreen(navigation: Props['navigation']): string | undefined {
  const parentState = navigation.getParent()?.getState() as
    | { routes?: { name: string; state?: { routes?: { name: string }[]; index?: number } }[] }
    | undefined;
  const moreRoute = parentState?.routes?.find((route) => route.name === 'MoreTab');
  const nestedRoutes = moreRoute?.state?.routes;
  const nestedIndex = moreRoute?.state?.index;
  if (!nestedRoutes || nestedIndex === undefined) return undefined;
  return nestedRoutes[nestedIndex]?.name;
}

function goIntoMoreTab(navigation: Props['navigation'], screen: MoreDestination) {
  if (currentMoreTabScreen(navigation) !== screen) {
    navigation.navigate('MoreTab', { screen: 'MoreMenu' });
  }
  navigation.navigate('MoreTab', { screen });
}

/**
 * Only modules that have no other home on this screen go here: Leave,
 * Attendance and Tickets already have their own bottom tab, and
 * Directory/Alerts already have header shortcuts, so repeating them here
 * would just be the same destination behind a second button.
 */
const QUICK_ACCESS = [
  { icon: 'laptop-outline', label: 'My assets', moduleColorKey: 'assets', module: 'assets', go: (nav: Props['navigation']) => goIntoMoreTab(nav, 'Assets') },
  { icon: 'document-text-outline', label: 'Documents', moduleColorKey: 'documents', module: 'employee_self_service', go: (nav: Props['navigation']) => goIntoMoreTab(nav, 'Documents') },
  { icon: 'cash-outline', label: 'Payslips', moduleColorKey: 'payslips', module: 'payroll', go: (nav: Props['navigation']) => goIntoMoreTab(nav, 'Payslips') },
] as const;

const COMPLIANCE_LABELS: Record<string, string> = {
  missing: 'Missing',
  expired: 'Expired',
  expiring_soon: 'Expiring soon',
  pending_acknowledgment: 'Needs acknowledgment',
  awaiting_signature: 'Awaiting signature',
  rejected: 'Rejected',
  changes_requested: 'Changes requested',
};

/** Which pill tone a compliance state reads as — missing/expired/rejected are the urgent tier, the rest are a heads-up. */
const COMPLIANCE_SEVERITY: Record<string, 'danger' | 'warning'> = {
  missing: 'danger',
  expired: 'danger',
  rejected: 'danger',
  expiring_soon: 'warning',
  pending_acknowledgment: 'warning',
  awaiting_signature: 'warning',
  changes_requested: 'warning',
};

const THEME_CYCLE: ThemePreference[] = ['system', 'light', 'dark'];
const THEME_ICON: Record<ThemePreference, keyof typeof Ionicons.glyphMap> = {
  system: 'contrast-outline',
  light: 'sunny-outline',
  dark: 'moon-outline',
};

const GREETING_ICON: Record<GreetingPeriod, keyof typeof Ionicons.glyphMap> = {
  morning: 'sunny-outline',
  afternoon: 'partly-sunny-outline',
  evening: 'moon-outline',
};

/** The single neutral icon treatment every card below the header shares — repetition, not variety, is what reads as "designed." */
function SectionIcon({ name, color, style }: { name: keyof typeof Ionicons.glyphMap; color: string; style?: object }) {
  return (
    <View style={[{ width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Ionicons name={name} size={18} color={color} />
    </View>
  );
}

export function HomeScreen({ navigation }: Props) {
  const { scheme, preference, setPreference } = useTheme();
  const v2 = useV2Colors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(v2), [v2]);
  const { session, moduleByKey } = useAuth();
  const { data, isLoading, isRefetching, refetch } = useMyDashboard();
  const { data: unread } = useUnreadNotificationCount();
  const quickAccess = QUICK_ACCESS.filter((item) => !item.module || moduleByKey(item.module)?.can_access === true);
  const greeting = getGreeting();
  // primaryStrong/primaryDark — the same light/dark text-color split used for
  // Login's links, since this is the identical "small teal text on bg/surface"
  // pairing (see docs/design-system/01-color-tokens.md §1).
  const linkColor = scheme === 'dark' ? v2.primaryDark : v2.primaryStrong;

  function cycleTheme() {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(preference) + 1) % THEME_CYCLE.length];
    setPreference(next);
  }

  return (
    <View style={styles.root}>
      <DecorativeAccents scheme={scheme} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.lg }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={v2.primary} />}
      >
        <View style={styles.headerRow}>
          <View>
            <View style={styles.greetingRow}>
              <Ionicons name={GREETING_ICON[greeting.period]} size={13} color={v2.muted} />
              <Text style={styles.greetingLabel}>{greeting.label},</Text>
            </View>
            <Text style={styles.greetingName}>{session?.user.name?.split(' ')[0] ?? 'there'}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={cycleTheme} style={styles.headerIconButton} accessibilityLabel={`Appearance: ${preference}. Tap to change.`}>
              <Ionicons name={THEME_ICON[preference]} size={20} color={v2.ink} />
            </Pressable>
            {session?.workspace?.employee_experience.allow_employee_directory === true ? (
              <Pressable onPress={() => goIntoMoreTab(navigation, 'Directory')} style={styles.headerIconButton} accessibilityLabel="Colleague directory">
                <Ionicons name="people-outline" size={20} color={v2.ink} />
              </Pressable>
            ) : null}
            <Pressable onPress={() => navigation.navigate('Notifications')} style={styles.headerIconButton} accessibilityLabel="Notifications">
              <Ionicons name="notifications-outline" size={20} color={v2.ink} />
              {unread && unread.unread_count > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread.unread_count > 9 ? '9+' : unread.unread_count}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Profile')} style={styles.avatarRing}>
              <Avatar uri={session?.user.photo_url} name={session?.user.name ?? 'Your'} fallbackColor={v2.primary} fallbackTextColor={v2.inkOnAccent} />
            </Pressable>
          </View>
        </View>

        <View style={styles.quickAccessCard}>
          <Text style={styles.sectionLabel}>Quick access</Text>
          <View style={styles.grid}>
            {quickAccess.map((item) => {
              const tileColor = v2ModuleColors[item.moduleColorKey].icon;
              return (
                <IconTile
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  bg={tileColor}
                  iconColor="#FFFFFF"
                  onPress={() => item.go(navigation)}
                />
              );
            })}
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={v2.primary} />
        ) : !data ? (
          <Text style={styles.caption}>Could not load your dashboard. Pull down to retry.</Text>
        ) : (
          <>
            {data.pending_actions.length > 0 ? (
              <View style={[styles.card, styles.rowCard]}>
                <SectionIcon name="alert-circle-outline" color="#FFFFFF" style={{ backgroundColor: v2ModuleColors.tickets.icon }} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>Needs your attention</Text>
                  {data.pending_actions.map((action) => (
                    <Text key={action.key} style={styles.pendingItem}>• {action.label}</Text>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Ionicons name="calendar-outline" size={16} color={v2ModuleColors.leave.icon} />
                <Text style={[styles.statValue, (data.leave?.pending_requests ?? 0) > 0 && { color: v2.warning }]}>
                  {data.leave?.pending_requests ?? 0}
                </Text>
                <Text style={styles.statLabel}>Leave pending</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="time-outline" size={16} color={v2ModuleColors.attendance.icon} />
                <Text style={styles.statValue}>{data.attendance?.this_month.present ?? 0}</Text>
                <Text style={styles.statLabel}>Days present</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="document-text-outline" size={16} color={v2ModuleColors.documents.icon} />
                <Text style={[styles.statValue, data.document_compliance.length > 0 && { color: v2.warning }]}>
                  {data.document_compliance.length}
                </Text>
                <Text style={styles.statLabel}>Doc items</Text>
              </View>
            </View>

            {data.work ? (
              <View style={[styles.card, styles.rowCard]}>
                <SectionIcon name="person-outline" color="#FFFFFF" style={{ backgroundColor: v2ModuleColors.profile.icon }} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>My role</Text>
                  <View style={styles.roleRow}>
                    <Ionicons name="briefcase-outline" size={16} color={v2.muted} />
                    <Text style={styles.body}>
                      {data.work.designation?.name ?? 'No designation'}
                      {data.work.department ? ` · ${data.work.department.name}` : ''}
                    </Text>
                  </View>
                  {data.work.reporting_manager ? (
                    <View style={styles.roleRow}>
                      <Ionicons name="person-outline" size={16} color={v2.muted} />
                      <Text style={styles.body}>Reports to {data.work.reporting_manager.full_name}</Text>
                    </View>
                  ) : null}
                  {data.tenure ? (
                    <View style={styles.roleRow}>
                      <Ionicons name="ribbon-outline" size={16} color={v2.muted} />
                      <Text style={styles.body}>
                        {data.tenure.years_of_service} year(s) of service · next anniversary in {data.tenure.days_until_anniversary} day(s)
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {data.attendance && (data.attendance.this_month.late > 0 || data.attendance.this_month.absent > 0 || data.attendance.corrections_pending > 0) ? (
              <View style={[styles.card, styles.rowCard]}>
                <SectionIcon name="time-outline" color="#FFFFFF" style={{ backgroundColor: v2ModuleColors.attendance.icon }} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>Attendance this month</Text>
                  <Text style={styles.body}>
                    {data.attendance.this_month.late} late · {data.attendance.this_month.absent} absent
                    {data.attendance.corrections_pending > 0 ? ` · ${data.attendance.corrections_pending} correction(s) pending` : ''}
                  </Text>
                </View>
              </View>
            ) : null}

            {data.document_compliance.length > 0 ? (
              <View style={[styles.card, styles.rowCard]}>
                <SectionIcon name="document-text-outline" color="#FFFFFF" style={{ backgroundColor: v2ModuleColors.documents.icon }} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>Documents needing attention</Text>
                  {data.document_compliance.map((item) => {
                    const severity = COMPLIANCE_SEVERITY[item.state] ?? 'warning';
                    const pillColor = severity === 'danger' ? v2.danger : v2.warning;
                    return (
                      <View key={item.requirement.id} style={styles.balanceRow}>
                        <Text style={styles.body}>{item.requirement.name}</Text>
                        <View style={[styles.pill, { backgroundColor: `${pillColor}1F` }]}>
                          <Text style={[styles.pillText, { color: pillColor }]}>{COMPLIANCE_LABELS[item.state] ?? item.state}</Text>
                        </View>
                      </View>
                    );
                  })}
                  <Pressable onPress={() => goIntoMoreTab(navigation, 'Documents')} style={{ marginTop: spacing.sm }}>
                    <Text style={[styles.link, { color: linkColor }]}>Go to documents</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {data.leave?.handover_assignments.length ? (
              <View style={[styles.card, styles.rowCard]}>
                <SectionIcon name="people-outline" color="#FFFFFF" style={{ backgroundColor: v2ModuleColors.directory.icon }} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>Covering for a colleague</Text>
                  {data.leave.handover_assignments.map((assignment) => (
                    <View key={assignment.id} style={styles.handoverRow}>
                      <Text style={styles.body}>
                        {assignment.employee.full_name} · {assignment.starts_on} → {assignment.ends_on}
                      </Text>
                      {assignment.handover_note ? <Text style={styles.caption}>{assignment.handover_note}</Text> : null}
                      {assignment.handover_download_url ? (
                        <Pressable
                          onPress={() => void downloadAndShare(`/leave/requests/${assignment.id}/handover-document/download`, assignment.handover_file_name ?? 'handover-document')}
                          style={{ marginTop: spacing.xs }}
                        >
                          <Text style={[styles.link, { color: linkColor }]}>View handover document</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {data.leave?.balances.length ? (
              <View style={[styles.card, styles.rowCard]}>
                <SectionIcon name="calendar-outline" color="#FFFFFF" style={{ backgroundColor: v2ModuleColors.leave.icon }} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>Leave balances</Text>
                  <View style={styles.chipRow}>
                    {data.leave.balances.map((balance) => (
                      <View key={balance.leave_type.id} style={styles.leaveBalanceChip}>
                        <Text style={styles.leaveBalanceLabel}>{balance.leave_type.name}</Text>
                        <Text style={[styles.leaveBalanceValue, { color: v2ModuleColors.leave.icon }]}>{balance.days_available} days</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ) : null}

            {data.next_holiday ? (
              <View style={[styles.card, styles.rowCard, { alignItems: 'center' }]}>
                <SectionIcon name="sunny-outline" color={v2.inkOnAccent} style={{ backgroundColor: v2.accentApricot }} />
                <Text style={[styles.body, { flex: 1, fontFamily: V2_FONTS.interSemiBold }]}>
                  {data.next_holiday.name} — {data.next_holiday.days_away} day(s) away
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (v2: V2Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: v2.bg },
  flex: { flex: 1 },
  container: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs / 2 },
  greetingLabel: { fontFamily: V2_FONTS.interMedium, fontSize: 13, color: v2.muted },
  greetingName: { fontFamily: V2_FONTS.manropeExtraBold, fontSize: 32, color: v2.ink, letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Restyled off the old translucent-white-on-gradient treatment — a neutral
  // chip fill reads correctly now that the header sits on the plain page
  // background instead of a dark gradient.
  headerIconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: v2.chip, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 3, backgroundColor: v2.danger, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontFamily: V2_FONTS.interBold },
  avatarRing: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: v2.primary },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },

  quickAccessCard: {
    backgroundColor: v2.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: v2.border,
    ...shadow.soft,
  },
  sectionLabel: { fontFamily: V2_FONTS.interBold, fontSize: 12, color: v2.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, columnGap: spacing.xs },

  card: { backgroundColor: v2.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: v2.border },
  rowCard: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: V2_FONTS.interSemiBold, fontSize: 16, color: v2.ink, marginBottom: spacing.sm },
  body: { fontFamily: V2_FONTS.interRegular, fontSize: 14, color: v2.ink },
  caption: { fontFamily: V2_FONTS.interRegular, fontSize: 13, color: v2.muted },
  pendingItem: { fontFamily: V2_FONTS.interRegular, fontSize: 14, color: v2.ink, marginBottom: spacing.xs },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, borderRadius: radius.md, padding: spacing.md, backgroundColor: v2.surface, borderWidth: 1, borderColor: v2.border },
  statValue: { fontFamily: V2_FONTS.manropeBold, fontSize: 22, color: v2.ink, marginTop: spacing.sm },
  statLabel: { fontFamily: V2_FONTS.interRegular, fontSize: 12, color: v2.muted, marginTop: 2 },

  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
  handoverRow: { paddingVertical: spacing.xs, gap: spacing.xs / 2 },
  // primaryStrong/primaryDark, not primary — same reasoning as Login's links
  // (small teal text directly on a surface fails contrast with `primary` alone,
  // see docs/design-system/01-color-tokens.md §1). Applied via the `linkColor`
  // computed once per render rather than recomputing `scheme === 'dark'` per style.
  link: { fontFamily: V2_FONTS.interSemiBold, fontSize: 13 },
  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 3 },
  pillText: { fontSize: 11, fontFamily: V2_FONTS.interBold },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  leaveBalanceChip: { backgroundColor: v2.chip, borderRadius: radius.sm, paddingHorizontal: spacing.sm + 4, paddingVertical: spacing.xs + 2 },
  leaveBalanceLabel: { fontFamily: V2_FONTS.interRegular, fontSize: 12, color: v2.muted },
  leaveBalanceValue: { fontFamily: V2_FONTS.interBold, fontSize: 15 },
});
