import { useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Avatar';
import { IconTile } from '../components/IconTile';
import { Sparkle } from '../components/Sparkle';
import { useMyDashboard } from '../features/dashboard/api';
import { downloadAndShare } from '../features/leave/api';
import { useUnreadNotificationCount } from '../features/notifications/api';
import { getGreeting, type GreetingPeriod } from '../lib/greeting';
import { HERO_ACCENT, HERO_GRADIENT, radius, shadow, spacing, useTheme, type ThemeColors, type ThemePreference, type Typography } from '../theme';
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

const HERO_SPARKLES: { left: `${number}%`; top: number; size: number; opacity: number; accent?: boolean }[] = [
  { left: '12%', top: 96, size: 8, opacity: 0.55 },
  { left: '77%', top: 118, size: 10, opacity: 0.85, accent: true },
  { left: '59%', top: 168, size: 6, opacity: 0.45 },
  { left: '38%', top: 60, size: 7, opacity: 0.4 },
];

/** The gradient/grid/sparkle treatment behind the greeting — a brand moment confined to the header, not the whole screen. */
function HeroBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={HERO_GRADIENT} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="homeGrid" width={60} height={60} patternUnits="userSpaceOnUse">
            <Path d="M 60 0 L 0 0 0 60" stroke="rgba(255,255,255,0.06)" strokeWidth={1} fill="none" />
          </Pattern>
          <RadialGradient id="homeGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={HERO_ACCENT} stopOpacity={0.14} />
            <Stop offset="100%" stopColor={HERO_ACCENT} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#homeGrid)" />
        <Circle cx="88%" cy="2%" r={100} fill="url(#homeGlow)" />
      </Svg>
      {HERO_SPARKLES.map((sparkle, index) => (
        <Sparkle
          key={index}
          size={sparkle.size}
          color={sparkle.accent ? HERO_ACCENT : '#FFFFFF'}
          opacity={sparkle.opacity}
          style={{ left: sparkle.left, top: sparkle.top }}
        />
      ))}
    </View>
  );
}

/** The single neutral icon treatment every card below the hero shares — repetition, not variety, is what reads as "designed." */
function SectionIcon({ name, color, style }: { name: keyof typeof Ionicons.glyphMap; color: string; style?: object }) {
  return (
    <View style={[{ width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Ionicons name={name} size={18} color={color} />
    </View>
  );
}

export function HomeScreen({ navigation }: Props) {
  const { colors, moduleColors, typography, preference, setPreference } = useTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { session, moduleByKey } = useAuth();
  const { data, isLoading, isRefetching, refetch } = useMyDashboard();
  const { data: unread } = useUnreadNotificationCount();
  const quickAccess = QUICK_ACCESS.filter((item) => !item.module || moduleByKey(item.module)?.can_access === true);
  const greeting = getGreeting();

  function cycleTheme() {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(preference) + 1) % THEME_CYCLE.length];
    setPreference(next);
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.pine} />}
    >
      <View style={styles.hero}>
        <HeroBackdrop />
        <View style={styles.headerRow}>
          <View>
            <View style={styles.greetingRow}>
              <Ionicons name={GREETING_ICON[greeting.period]} size={13} color="rgba(255,255,255,0.7)" />
              <Text style={styles.greetingLabel}>{greeting.label},</Text>
            </View>
            <Text style={styles.greetingName}>{session?.user.name?.split(' ')[0] ?? 'there'}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={cycleTheme} style={styles.headerIconButton} accessibilityLabel={`Appearance: ${preference}. Tap to change.`}>
              <Ionicons name={THEME_ICON[preference]} size={20} color="#FFFFFF" />
            </Pressable>
            {session?.workspace?.employee_experience.allow_employee_directory === true ? (
              <Pressable onPress={() => goIntoMoreTab(navigation, 'Directory')} style={styles.headerIconButton} accessibilityLabel="Colleague directory">
                <Ionicons name="people-outline" size={20} color="#FFFFFF" />
              </Pressable>
            ) : null}
            <Pressable onPress={() => navigation.navigate('Notifications')} style={styles.headerIconButton} accessibilityLabel="Notifications">
              <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
              {unread && unread.unread_count > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread.unread_count > 9 ? '9+' : unread.unread_count}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Profile')} style={styles.avatarRing}>
              <Avatar uri={session?.user.photo_url} name={session?.user.name ?? 'Your'} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.watermark} pointerEvents="none" />
        <View style={styles.quickAccessCard}>
          <Text style={styles.sectionLabel}>Quick access</Text>
          <View style={styles.grid}>
            {quickAccess.map((item) => {
              const tileColor = moduleColors[item.moduleColorKey].icon;
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
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.pine} />
      ) : !data ? (
        <Text style={typography.caption}>Could not load your dashboard. Pull down to retry.</Text>
      ) : (
        <>
          {data.pending_actions.length > 0 ? (
            <View style={[styles.card, styles.rowCard]}>
              <SectionIcon name="alert-circle-outline" color="#FFFFFF" style={{ backgroundColor: moduleColors.tickets.icon }} />
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
              <Ionicons name="calendar-outline" size={16} color={moduleColors.leave.icon} />
              <Text style={[styles.statValue, (data.leave?.pending_requests ?? 0) > 0 && { color: colors.warning }]}>
                {data.leave?.pending_requests ?? 0}
              </Text>
              <Text style={styles.statLabel}>Leave pending</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="time-outline" size={16} color={moduleColors.attendance.icon} />
              <Text style={styles.statValue}>{data.attendance?.this_month.present ?? 0}</Text>
              <Text style={styles.statLabel}>Days present</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="document-text-outline" size={16} color={moduleColors.documents.icon} />
              <Text style={[styles.statValue, data.document_compliance.length > 0 && { color: colors.warning }]}>
                {data.document_compliance.length}
              </Text>
              <Text style={styles.statLabel}>Doc items</Text>
            </View>
          </View>

          {data.work ? (
            <View style={[styles.card, styles.rowCard]}>
              <SectionIcon name="person-outline" color="#FFFFFF" style={{ backgroundColor: moduleColors.profile.icon }} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>My role</Text>
                <View style={styles.roleRow}>
                  <Ionicons name="briefcase-outline" size={16} color={colors.muted} />
                  <Text style={typography.body}>
                    {data.work.designation?.name ?? 'No designation'}
                    {data.work.department ? ` · ${data.work.department.name}` : ''}
                  </Text>
                </View>
                {data.work.reporting_manager ? (
                  <View style={styles.roleRow}>
                    <Ionicons name="person-outline" size={16} color={colors.muted} />
                    <Text style={typography.body}>Reports to {data.work.reporting_manager.full_name}</Text>
                  </View>
                ) : null}
                {data.tenure ? (
                  <View style={styles.roleRow}>
                    <Ionicons name="ribbon-outline" size={16} color={colors.muted} />
                    <Text style={typography.body}>
                      {data.tenure.years_of_service} year(s) of service · next anniversary in {data.tenure.days_until_anniversary} day(s)
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {data.attendance && (data.attendance.this_month.late > 0 || data.attendance.this_month.absent > 0 || data.attendance.corrections_pending > 0) ? (
            <View style={[styles.card, styles.rowCard]}>
              <SectionIcon name="time-outline" color="#FFFFFF" style={{ backgroundColor: moduleColors.attendance.icon }} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Attendance this month</Text>
                <Text style={typography.body}>
                  {data.attendance.this_month.late} late · {data.attendance.this_month.absent} absent
                  {data.attendance.corrections_pending > 0 ? ` · ${data.attendance.corrections_pending} correction(s) pending` : ''}
                </Text>
              </View>
            </View>
          ) : null}

          {data.document_compliance.length > 0 ? (
            <View style={[styles.card, styles.rowCard]}>
              <SectionIcon name="document-text-outline" color="#FFFFFF" style={{ backgroundColor: moduleColors.documents.icon }} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Documents needing attention</Text>
                {data.document_compliance.map((item) => {
                  const severity = COMPLIANCE_SEVERITY[item.state] ?? 'warning';
                  const pillColor = severity === 'danger' ? colors.danger : colors.warning;
                  return (
                    <View key={item.requirement.id} style={styles.balanceRow}>
                      <Text style={typography.body}>{item.requirement.name}</Text>
                      <View style={[styles.pill, { backgroundColor: `${pillColor}1F` }]}>
                        <Text style={[styles.pillText, { color: pillColor }]}>{COMPLIANCE_LABELS[item.state] ?? item.state}</Text>
                      </View>
                    </View>
                  );
                })}
                <Pressable onPress={() => goIntoMoreTab(navigation, 'Documents')} style={{ marginTop: spacing.sm }}>
                  <Text style={styles.link}>Go to documents</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {data.leave?.handover_assignments.length ? (
            <View style={[styles.card, styles.rowCard]}>
              <SectionIcon name="people-outline" color="#FFFFFF" style={{ backgroundColor: moduleColors.directory.icon }} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Covering for a colleague</Text>
                {data.leave.handover_assignments.map((assignment) => (
                  <View key={assignment.id} style={styles.handoverRow}>
                    <Text style={typography.body}>
                      {assignment.employee.full_name} · {assignment.starts_on} → {assignment.ends_on}
                    </Text>
                    {assignment.handover_note ? <Text style={typography.caption}>{assignment.handover_note}</Text> : null}
                    {assignment.handover_download_url ? (
                      <Pressable
                        onPress={() => void downloadAndShare(`/leave/requests/${assignment.id}/handover-document/download`, assignment.handover_file_name ?? 'handover-document')}
                        style={{ marginTop: spacing.xs }}
                      >
                        <Text style={styles.link}>View handover document</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {data.leave?.balances.length ? (
            <View style={[styles.card, styles.rowCard]}>
              <SectionIcon name="calendar-outline" color="#FFFFFF" style={{ backgroundColor: moduleColors.leave.icon }} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Leave balances</Text>
                <View style={styles.chipRow}>
                  {data.leave.balances.map((balance) => (
                    <View key={balance.leave_type.id} style={[styles.leaveBalanceChip, { backgroundColor: `${moduleColors.leave.icon}1F` }]}>
                      <Text style={styles.leaveBalanceLabel}>{balance.leave_type.name}</Text>
                      <Text style={[styles.leaveBalanceValue, { color: moduleColors.leave.icon }]}>{balance.days_available} days</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {data.next_holiday ? (
            <View style={[styles.card, styles.rowCard, { alignItems: 'center' }]}>
              <SectionIcon name="sunny-outline" color={colors.pineDark} style={{ backgroundColor: colors.lime }} />
              <Text style={[typography.body, { flex: 1, fontWeight: '600' }]}>
                {data.next_holiday.name} — {data.next_holiday.days_away} day(s) away
              </Text>
            </View>
          ) : null}
        </>
      )}
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors, typography: Typography) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { paddingBottom: spacing.xl * 2 },
  hero: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 56, overflow: 'hidden', position: 'relative' },
  body: { paddingHorizontal: spacing.lg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs / 2 },
  greetingLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  greetingName: { fontSize: 38, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 3, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  avatarRing: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.lime },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  watermark: {
    position: 'absolute',
    left: -120,
    top: 380,
    width: 420,
    height: 420,
    borderRadius: 999,
    backgroundColor: colors.pine,
    opacity: 0.025,
  },
  quickAccessCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: -34,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    ...shadow.soft,
  },
  sectionLabel: { ...typography.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, columnGap: spacing.xs },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line },
  rowCard: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  cardBody: { flex: 1 },
  cardTitle: { ...typography.heading, marginBottom: spacing.sm },
  pendingItem: { ...typography.body, marginBottom: spacing.xs },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  statValue: { fontSize: 23, fontWeight: '800', color: colors.ink, marginTop: spacing.sm },
  statLabel: { ...typography.caption, marginTop: 2 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
  handoverRow: { paddingVertical: spacing.xs, gap: spacing.xs / 2 },
  link: { color: colors.pine, fontWeight: '600', fontSize: 13 },
  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 3 },
  pillText: { fontSize: 10.5, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  leaveBalanceChip: { backgroundColor: colors.paper, borderRadius: radius.sm, paddingHorizontal: spacing.sm + 4, paddingVertical: spacing.xs + 2 },
  leaveBalanceLabel: { ...typography.caption },
  leaveBalanceValue: { fontSize: 15, fontWeight: '800', color: colors.ink },
});
