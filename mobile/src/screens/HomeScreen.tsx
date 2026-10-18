import { useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Avatar';
import { DecorativeAccents } from '../components/DecorativeAccents';
import { IconTile } from '../components/IconTile';
import { useManagerDashboard, useMyDashboard } from '../features/dashboard/api';
import { downloadAndShare } from '../features/leave/api';
import { useAppreciations, useLifestylePreferences, useMilestones } from '../features/lifestyle/api';
import { useUnreadNotificationCount } from '../features/notifications/api';
import { getGreeting, type GreetingPeriod } from '../lib/greeting';
import { selectLifestyleHomeSummary } from '../lib/lifestyleHomeSummary';
import { isEligibleForManagerHome, shouldRefetchManagerDashboard } from '../lib/managerEligibility';
import { selectManagerTeamSummary } from '../lib/managerTeamSummary';
import { goIntoMoreTab, type HomeAreaNavigation } from '../lib/navigation';
import { resolvePendingAction, selectPendingActionsHeading, type PendingActionDestination } from '../lib/pendingActionNavigation';
import { INFINITE_LIST_PAGE_SIZE } from '../lib/useInfiniteList';
import { radius, shadow, spacing, useTheme, useV2Colors, v2ModuleColors, V2_FONTS, type ThemePreference, type V2Colors } from '../theme';
import type { HomeStackParamList } from '../navigation/HomeStack';
import type { MainTabParamList } from '../navigation/MainTabs';

type Props = CompositeScreenProps<NativeStackScreenProps<HomeStackParamList, 'Home'>, BottomTabScreenProps<MainTabParamList>>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The imperative half of resolvePendingAction's result — the decision itself (which destination, which tone) is pure and unit-tested; this is just "call the matching navigate()." */
function navigateForPendingAction(destination: PendingActionDestination, navigation: HomeAreaNavigation) {
  switch (destination.kind) {
    case 'profile':
      navigation.navigate('Profile');
      return;
    case 'leaveTab':
      navigation.navigate('LeaveTab');
      return;
    case 'ticketsTab':
      navigation.navigate('TicketsTab');
      return;
    case 'none':
      return;
  }
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
  // Calendar has no module gate of its own (MoreMenuScreen's `module: null`) and no
  // other always-available entry point on Home — the Next Holiday card only appears
  // when there's an upcoming holiday to show, so it isn't a reliable path there.
  { icon: 'calendar-outline', label: 'Calendar', moduleColorKey: 'calendar', module: null, go: (nav: Props['navigation']) => goIntoMoreTab(nav, 'Calendar') },
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
  const { width: windowWidth } = useWindowDimensions();
  // More breathing room between the icon buttons/avatar than the original flat
  // 8px, but clamped down on narrow phones so the header never overflows or
  // forces the icons to crowd the greeting name.
  const headerActionGap = clamp(windowWidth * 0.03, spacing.sm + 4, spacing.md);
  const styles = useMemo(() => makeStyles(v2, headerActionGap), [v2, headerActionGap]);
  const { session, moduleByKey, refresh: refreshSession } = useAuth();
  const { data, isLoading, isRefetching, refetch } = useMyDashboard();
  const { data: unread } = useUnreadNotificationCount();

  // The ONLY signal gating the manager section — see docs/design-system/11's Manager IA
  // and mobile/src/lib/managerEligibility.ts for why no other field substitutes for it.
  // Because the query below is only `enabled` when this is true, a non-manager account
  // never issues a request to /dashboard/manager at all.
  const hasManagerScope = isEligibleForManagerHome(session);
  const managerDashboard = useManagerDashboard(hasManagerScope);
  const quickAccess = QUICK_ACCESS.filter((item) => !item.module || moduleByKey(item.module)?.can_access === true);
  const greeting = getGreeting();
  // primaryStrong/primaryDark — the same light/dark text-color split used for
  // Login's links, since this is the identical "small teal text on bg/surface"
  // pairing (see docs/design-system/01-color-tokens.md §1).
  const linkColor = scheme === 'dark' ? v2.primaryDark : v2.primaryStrong;

  // Pending-action navigation must respect the same module access the rest of
  // Home already does — a stale action referencing a now-disabled module must
  // resolve to "not tappable", never a broken navigate() call.
  const pendingActionAccess = {
    leave: moduleByKey('leave')?.can_access === true,
    serviceDesk: moduleByKey('service_desk')?.can_access === true,
  };

  // Lifestyle card: mirrors LifestyleScreen.tsx's own gating exactly (feature
  // flags first, then conditionally-enabled queries) so Home never fires the
  // milestones/appreciations requests when the organization has either
  // feature turned off.
  const lifestylePreferences = useLifestylePreferences();
  const milestonesEnabled = lifestylePreferences.data?.features.milestones_enabled === true;
  const appreciationEnabled = lifestylePreferences.data?.features.appreciation_enabled === true;
  const milestonesQuery = useMilestones(30, milestonesEnabled);
  const receivedAppreciationQuery = useAppreciations('received', appreciationEnabled);
  const receivedAppreciationCount = receivedAppreciationQuery.items?.length;
  const lifestyleSummary = selectLifestyleHomeSummary({
    milestonesEnabled,
    appreciationEnabled,
    milestones: milestonesQuery.data,
    receivedAppreciationCount,
    // No count endpoint exists for appreciations (per docs/design-system/10 item 8) — a
    // full first page means there may be more than shown, so the label says "N+", not a
    // precise total it can't actually guarantee.
    receivedAppreciationCapped: receivedAppreciationCount === INFINITE_LIST_PAGE_SIZE,
  });

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
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || (hasManagerScope && managerDashboard.isRefetching)}
            onRefresh={() => {
              void refetch();
              // Re-checks has_manager_scope itself — the app has no automatic
              // mid-session permission re-check (a known, reported limitation, not
              // something this phase adds new infrastructure for), so pulling to
              // refresh is the one user-triggerable way to pick up a permission
              // change without signing out and back in.
              //
              // Resolved BEFORE deciding whether to refetch the manager dashboard,
              // deliberately not in parallel with it: racing the two meant a
              // just-revoked session's stale `hasManagerScope` (captured from
              // render scope, not yet aware of the revocation) could still fire
              // one more manager-dashboard request. shouldRefetchManagerDashboard
              // fails closed on a failed/superseded refresh (its `undefined`
              // case) rather than falling back to this stale value — see its
              // doc comment for why that fallback would be unsafe here.
              void (async () => {
                const freshSession = await refreshSession();
                if (shouldRefetchManagerDashboard(freshSession)) void managerDashboard.refetch();
              })();
            }}
            tintColor={v2.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.greetingBlock}>
            <View style={styles.greetingRow}>
              <Ionicons name={GREETING_ICON[greeting.period]} size={13} color={v2.muted} />
              <Text style={styles.greetingLabel} numberOfLines={1}>{greeting.label},</Text>
            </View>
            {/* numberOfLines + the block's own flexShrink (below) keep a long name from
                wrapping onto a second line and pushing the icon row off a narrow screen —
                it truncates instead. */}
            <Text style={styles.greetingName} numberOfLines={1}>{session?.user.name?.split(' ')[0] ?? 'there'}</Text>
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
            <Pressable onPress={() => navigation.navigate('Notifications')} style={[styles.headerIconButton, { marginRight: spacing.xs }]} accessibilityLabel="Notifications">
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
                  widthPercent="22%"
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
            {data.pending_actions.length > 0 ? (() => {
              // Resolved once, reused for both the heading choice and the row render —
              // the data, order, and per-item destinations are exactly what Phase A
              // shipped; only the heading (and this card's icon, for the same reason)
              // adapts to whether anything in the list actually needs the employee to
              // do something, so an all-informational list is never framed as urgent.
              const resolutions = data.pending_actions.map((action) => ({ action, resolution: resolvePendingAction(action.key, pendingActionAccess) }));
              const hasActionableItem = resolutions.some(({ resolution }) => resolution.tone === 'actionable');
              return (
              <View style={[styles.card, styles.rowCard]}>
                <SectionIcon
                  name={hasActionableItem ? 'alert-circle-outline' : 'information-circle-outline'}
                  color={hasActionableItem ? '#FFFFFF' : v2.muted}
                  style={{ backgroundColor: hasActionableItem ? v2ModuleColors.tickets.icon : v2.chip }}
                />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{selectPendingActionsHeading(resolutions.map((r) => r.resolution.tone))}</Text>
                  {resolutions.map(({ action, resolution }) => {
                    const tappable = resolution.destination.kind !== 'none';
                    const row = (
                      <View style={styles.pendingItemRow}>
                        <Text
                          style={[styles.pendingItem, resolution.tone === 'informational' && styles.pendingItemInformational]}
                          numberOfLines={2}
                        >
                          • {action.label}
                        </Text>
                        {/* Only the one truly actionable key gets the "go fix this" affordance —
                            an informational status never looks like a task requiring intervention. */}
                        {tappable && resolution.tone === 'actionable' ? (
                          <Ionicons name="chevron-forward" size={16} color={v2.ink} />
                        ) : null}
                      </View>
                    );
                    return tappable ? (
                      <Pressable
                        key={action.key}
                        onPress={() => navigateForPendingAction(resolution.destination, navigation)}
                        accessibilityRole="button"
                        accessibilityLabel={action.label}
                      >
                        {row}
                      </Pressable>
                    ) : (
                      <View key={action.key}>{row}</View>
                    );
                  })}
                </View>
              </View>
              );
            })() : null}

            {/* Manager-only. Positioned after the employee's own pending actions and
                before their personal stats, per the approved Home hierarchy — a
                manager's own urgent items always outrank their team's summary, and
                the team section never displaces or replaces anything below it. */}
            {hasManagerScope ? (() => {
              const summary = managerDashboard.data ? selectManagerTeamSummary(managerDashboard.data) : null;
              return (
                <View style={styles.card}>
                  <View style={[styles.rowCard, { marginBottom: spacing.md }]}>
                    <SectionIcon name="people-outline" color="#FFFFFF" style={{ backgroundColor: v2.primary }} />
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>Team at a glance</Text>
                      <Text style={styles.caption}>{summary?.scopeLabel ?? 'Your team'}</Text>
                    </View>
                  </View>
                  {managerDashboard.isLoading ? (
                    <ActivityIndicator color={v2.primary} />
                  ) : managerDashboard.isError ? (
                    // Never render stale or fabricated zeros on a failed/unauthorized
                    // fetch — a quiet message, not a QueryError banner, since this is a
                    // secondary section, not the screen's primary content.
                    <Text style={styles.caption}>Couldn&apos;t load your team summary. Pull down to retry.</Text>
                  ) : summary ? (
                    <View style={styles.statsRow}>
                      <View style={styles.statCard}>
                        <Ionicons name="people-outline" size={16} color={v2.primary} />
                        <Text style={styles.statValue}>{summary.teamSize}</Text>
                        <Text style={styles.statLabel}>Team</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Ionicons name="calendar-outline" size={16} color={v2ModuleColors.leave.icon} />
                        <Text style={[styles.statValue, summary.leavePending > 0 && { color: v2.warning }]}>{summary.leavePending}</Text>
                        <Text style={styles.statLabel}>Leave pending</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Ionicons name="time-outline" size={16} color={v2ModuleColors.attendance.icon} />
                        <Text style={[styles.statValue, summary.correctionsPending > 0 && { color: v2.warning }]}>{summary.correctionsPending}</Text>
                        <Text style={styles.statLabel}>Corrections</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Ionicons name="person-outline" size={16} color={v2ModuleColors.profile.icon} />
                        <Text style={[styles.statValue, summary.incompleteProfiles > 0 && { color: v2.warning }]}>{summary.incompleteProfiles}</Text>
                        <Text style={styles.statLabel}>Profiles</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })() : null}

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

            {lifestyleSummary.visible ? (
              <Pressable
                onPress={() => goIntoMoreTab(navigation, 'Lifestyle')}
                style={[styles.card, styles.rowCard]}
                accessibilityRole="button"
                accessibilityLabel="Birthdays, anniversaries, and appreciation"
              >
                <SectionIcon name="heart-outline" color="#FFFFFF" style={{ backgroundColor: v2ModuleColors.lifestyle.icon }} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>Life at work</Text>
                  {lifestyleSummary.milestoneLabel ? <Text style={styles.body}>{lifestyleSummary.milestoneLabel}</Text> : null}
                  {lifestyleSummary.appreciationLabel ? (
                    <Text style={[styles.body, lifestyleSummary.milestoneLabel ? { marginTop: spacing.xs } : undefined]}>
                      {lifestyleSummary.appreciationLabel}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={v2.muted} />
              </Pressable>
            ) : null}

            {data.next_holiday ? (
              <Pressable
                onPress={() => goIntoMoreTab(navigation, 'Calendar')}
                style={[styles.card, styles.rowCard, { alignItems: 'center' }]}
                accessibilityRole="button"
                accessibilityLabel={`${data.next_holiday.name}, ${data.next_holiday.days_away} days away. View calendar.`}
              >
                <SectionIcon name="sunny-outline" color={v2.inkOnAccent} style={{ backgroundColor: v2.accentApricot }} />
                <Text style={[styles.body, { flex: 1, fontFamily: V2_FONTS.interSemiBold }]}>
                  {data.next_holiday.name} — {data.next_holiday.days_away} day(s) away
                </Text>
                <Ionicons name="chevron-forward" size={18} color={v2.muted} />
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (v2: V2Colors, headerActionGap: number) => StyleSheet.create({
  root: { flex: 1, backgroundColor: v2.bg },
  flex: { flex: 1 },
  container: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  // Shrinks (and the name truncates via numberOfLines) before it ever forces
  // the icon row to overflow or compress on a narrow screen.
  greetingBlock: { flexShrink: 1, marginRight: spacing.sm },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs / 2 },
  greetingLabel: { fontFamily: V2_FONTS.interMedium, fontSize: 13, color: v2.muted },
  greetingName: { fontFamily: V2_FONTS.manropeExtraBold, fontSize: 32, color: v2.ink, letterSpacing: -0.5 },
  // flexShrink: 0 — the icon row keeps its full size even if the greeting
  // block above needs to shrink first; gap is responsive (see headerActionGap).
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: headerActionGap, flexShrink: 0 },
  // Restyled off the old translucent-white-on-gradient treatment — a neutral
  // chip fill reads correctly now that the header sits on the plain page
  // background instead of a dark gradient.
  headerIconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: v2.chip, alignItems: 'center', justifyContent: 'center' },
  // Tucked in slightly from the original -4/-4 so it doesn't crowd the avatar
  // now that the button beside it also carries its own small marginRight.
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 3, backgroundColor: v2.danger, alignItems: 'center', justifyContent: 'center' },
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
  // 14 -> 15/21, matching the documented v2 `body` scale (docs/design-system/02
  // §1) — the original value had drifted a point below the spec, which read as
  // noticeably small for the role/attendance detail lines on an actual device.
  body: { fontFamily: V2_FONTS.interRegular, fontSize: 15, lineHeight: 21, color: v2.ink },
  caption: { fontFamily: V2_FONTS.interRegular, fontSize: 13, color: v2.muted },
  // Tappable rows get a real touch target (44+); the row wrapper carries the
  // spacing that used to live on the Text itself.
  pendingItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, minHeight: 44, paddingVertical: spacing.xs },
  pendingItem: { fontFamily: V2_FONTS.interRegular, fontSize: 15, lineHeight: 21, color: v2.ink, flex: 1 },
  // Informational statuses are never styled like an urgent task — muted text,
  // no chevron (applied conditionally where the row is rendered).
  pendingItemInformational: { color: v2.muted },

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
  leaveBalanceChip: { backgroundColor: v2.chip, borderRadius: radius.sm, paddingHorizontal: spacing.sm + 4, paddingVertical: spacing.xs + 4 },
  // Bumped from 12/interRegular — too faint relative to the value below it.
  leaveBalanceLabel: { fontFamily: V2_FONTS.interMedium, fontSize: 13, color: v2.muted },
  // Strengthened from 15 to 18 (and added a small top gap) so the number reads
  // as the chip's primary content and the label above it as clearly
  // subordinate — the same "big number, small label" hierarchy the stat cards
  // above already use, now applied consistently to the leave-balance chips.
  leaveBalanceValue: { fontFamily: V2_FONTS.interBold, fontSize: 18, marginTop: 2 },
});
