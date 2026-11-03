import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { KeyboardAvoidingScreen } from '../components/KeyboardAvoidingScreen';
import { ProductIconField } from '../components/ProductIconField';
import { QueryError } from '../components/QueryError';
import {
  openApprovalDocument,
  openApprovalLeaveEvidence,
  openApprovalTicketAttachment,
  useActOnApprovalRequest,
  useApprovalRequest,
} from '../features/approvals/api';
import { formatSnakeCase, statusTone } from '../features/approvals/presentation';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useV2Colors, V2_FONTS, type V2Colors } from '../theme';
import type { ApprovalsStackParamList } from '../navigation/ApprovalsStack';
import type { ApprovalDecisionAction } from '../types/api';

type Props = NativeStackScreenProps<ApprovalsStackParamList, 'ApprovalDetail'>;

const DECISION_OPTIONS: { value: ApprovalDecisionAction; label: string }[] = [
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Reject' },
  { value: 'request_changes', label: 'Request changes' },
  { value: 'cancel', label: 'Cancel' },
];

export function ApprovalDetailScreen({ route, navigation }: Props) {
  const v2 = useV2Colors();
  const styles = useMemo(() => makeStyles(v2), [v2]);
  const { approvalRequestId } = route.params;
  const { data: request, isLoading, isError, error, refetch } = useApprovalRequest(approvalRequestId);
  const act = useActOnApprovalRequest(approvalRequestId);

  const [decisionAction, setDecisionAction] = useState<ApprovalDecisionAction>('approve');
  const [note, setNote] = useState('');
  const [opening, setOpening] = useState(false);

  if (isError) return <QueryError retry={refetch} error={error} />;
  if (isLoading || !request) return <ActivityIndicator color={v2.primary} style={{ marginTop: spacing.xl }} />;

  const isPending = request.status === 'pending';
  const decisionOptions = DECISION_OPTIONS.filter((option) => !request.allowed_actions || request.allowed_actions.includes(option.value));
  const selectedAction = decisionOptions.some((option) => option.value === decisionAction) ? decisionAction : decisionOptions[0]?.value;
  const approveRestriction = request.action_restrictions?.approve;
  const tone = statusTone(request.status, v2);

  async function handleOpen(task: () => Promise<void>) {
    setOpening(true);
    try {
      await task();
    } catch {
      Alert.alert('Could not open file', 'Please try again.');
    } finally {
      setOpening(false);
    }
  }

  async function handleDecide() {
    if (!selectedAction) return;
    try {
      await act.mutateAsync({ action: selectedAction, note: note.trim() || undefined, expected_step_order: request?.current_step_order });
      // Fire-and-forget, same as every other submit flow in the app (NewTicketScreen,
      // NewLeaveRequestScreen): the confirmation shouldn't cost an extra required tap
      // before the screen moves on — this reviewer's own decisionOptions for a
      // multi-step workflow go empty the moment the decision lands anyway, so there's
      // nothing useful left to do on this screen once it's recorded.
      Alert.alert('Decision recorded', `This request has been ${selectedAction === 'approve' ? 'approved' : selectedAction === 'reject' ? 'rejected' : selectedAction === 'cancel' ? 'cancelled' : 'sent back for changes'}.`);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not record decision', err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <View style={styles.root}>
    <ProductIconField />
    <KeyboardAvoidingScreen>
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.badgeRow}>
        <View style={[styles.pill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.pillText, { color: tone.fg }]}>{formatSnakeCase(request.status)}</Text>
        </View>
        <Text style={styles.caption}>{formatSnakeCase(request.module)} · {formatSnakeCase(request.action)}</Text>
      </View>
      <Text style={styles.title}>{request.title}</Text>
      <Text style={[styles.caption, { marginTop: spacing.xs }]}>
        Requested by {request.requester?.name ?? 'System'}
        {request.subject_employee ? ` for ${request.subject_employee.full_name}` : ''}
      </Text>

      {request.ticket ? (
        <View style={styles.detailBox}>
          {request.ticket.category ? (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText}>{request.ticket.category.name.toUpperCase()}</Text>
            </View>
          ) : null}
          <Text style={styles.body}>{request.ticket.description}</Text>
          {request.ticket.attachment_download_url ? (
            <Pressable onPress={() => void handleOpen(() => openApprovalTicketAttachment(request.ticket!))} disabled={opening} style={{ marginTop: spacing.sm }}>
              <Text style={styles.link}>{opening ? 'Opening…' : `Open attachment: ${request.ticket.attachment_file_name ?? 'file'}`}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {request.leave_request ? (
        <View style={styles.detailBox}>
          {request.leave_request.handover_to ? (
            <Text style={styles.body}>Handover to {request.leave_request.handover_to.full_name}</Text>
          ) : null}
          {request.leave_request.handover_note ? <Text style={[styles.caption, { marginTop: spacing.xs }]}>{request.leave_request.handover_note}</Text> : null}
          {request.leave_request.evidence_download_url ? (
            <Pressable onPress={() => void handleOpen(() => openApprovalLeaveEvidence(request.leave_request!))} disabled={opening} style={{ marginTop: spacing.sm }}>
              <Text style={styles.link}>{opening ? 'Opening…' : `View evidence: ${request.leave_request.evidence_file_name ?? 'file'}`}</Text>
            </Pressable>
          ) : null}
          {request.leave_request.handover_download_url ? (
            <Pressable onPress={() => void handleOpen(() => openApprovalLeaveEvidence(request.leave_request!))} disabled={opening} style={{ marginTop: spacing.sm }}>
              <Text style={styles.link}>{opening ? 'Opening…' : `View handover doc: ${request.leave_request.handover_file_name ?? 'file'}`}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {request.document ? (
        <View style={styles.detailBox}>
          <Pressable onPress={() => void handleOpen(() => openApprovalDocument(request.document!))} disabled={opening}>
            <Text style={styles.link}>{opening ? 'Opening…' : `Open document: ${request.document.title}`}</Text>
          </Pressable>
        </View>
      ) : null}

      {isPending && decisionOptions.length === 0 ? (
        <View style={styles.decideBox}>
          <Text style={styles.caption}>
            You don&apos;t have an action available on this request right now — you may not be the reviewer for its current step, or it&apos;s waiting on someone else.
          </Text>
        </View>
      ) : isPending ? (
        <View style={styles.decideBox}>
          {approveRestriction ? (
            // decisionOptions already excludes 'approve' whenever this is set (see
            // ApprovalDecisionAuthorizationService::capabilities — allowed_actions and
            // action_restrictions are mutually exclusive per action), so reaching this
            // branch means other actions are still available below; phrase it as a
            // scoped note, not a blocking error for the whole decision.
            <Text style={[styles.caption, { color: v2.warning, marginBottom: spacing.sm }]}>
              {['self_approval_not_allowed', 'payroll_submitter_cannot_approve'].includes(approveRestriction)
                ? "You can't approve a request you submitted or a personal request made on your behalf, but you can still decide it below."
                : "Approving isn't available to you for this request, but you can still decide it below."}
            </Text>
          ) : null}
          <Text style={styles.label}>Decision</Text>
          <View style={styles.optionRow}>
            {decisionOptions.map((option) => {
              const active = option.value === selectedAction;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setDecisionAction(option.value)}
                  style={[styles.optionChip, active && styles.optionChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.label, { marginTop: spacing.md }]}>Note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            style={styles.input}
            multiline
            placeholder="Optional — some workflows require a note when rejecting or requesting changes."
            placeholderTextColor={v2.muted}
          />
          <View style={{ marginTop: spacing.md }}>
            <Button variant="gradient" label="Record decision" onPress={() => void handleDecide()} loading={act.isPending} disabled={!selectedAction} />
          </View>
        </View>
      ) : (
        <View style={styles.decideBox}>
          <Text style={styles.label}>Decision history</Text>
          {(request.decisions ?? []).length === 0 ? (
            <Text style={styles.caption}>No decisions recorded yet.</Text>
          ) : (
            (request.decisions ?? []).map((decision) => (
              <View key={decision.id} style={styles.decisionCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.decisionActor}>{decision.actor?.name ?? 'System'}</Text>
                  <Text style={styles.caption}>{new Date(decision.created_at).toLocaleString()}</Text>
                </View>
                <Text style={styles.caption}>{formatSnakeCase(decision.action)} → {formatSnakeCase(decision.next_status)}</Text>
                {decision.note ? <Text style={[styles.body, { marginTop: spacing.xs }]}>&ldquo;{decision.note}&rdquo;</Text> : null}
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
    </KeyboardAvoidingScreen>
    </View>
  );
}

const makeStyles = (v2: V2Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: v2.bg },
  flex: { flex: 1 },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm + 1, paddingVertical: 4 },
  pillText: { fontFamily: V2_FONTS.interBold, fontSize: 11 },
  title: { fontFamily: V2_FONTS.manropeBold, fontSize: 20, color: v2.ink, letterSpacing: -0.2 },
  body: { fontFamily: V2_FONTS.interRegular, fontSize: 13.5, lineHeight: 19, color: v2.ink },
  caption: { fontFamily: V2_FONTS.interRegular, fontSize: 12.5, color: v2.muted },
  label: { fontFamily: V2_FONTS.interBold, fontSize: 12, color: v2.muted, letterSpacing: 0.3, marginBottom: spacing.sm },
  link: { fontFamily: V2_FONTS.interSemiBold, color: v2.primary, fontSize: 12.5 },
  categoryPill: { alignSelf: 'flex-start', backgroundColor: `${v2.primary}1F`, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 4, marginBottom: spacing.sm },
  categoryPillText: { fontFamily: V2_FONTS.interBold, fontSize: 10, color: v2.primaryStrong, letterSpacing: 0.3 },
  detailBox: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: v2.border, backgroundColor: v2.surface },
  decideBox: { marginTop: spacing.xl },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optionChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: radius.pill, borderWidth: 1.5, borderColor: v2.border, backgroundColor: v2.surface },
  optionChipActive: { backgroundColor: v2.primary, borderColor: v2.primary },
  optionChipText: { fontFamily: V2_FONTS.interSemiBold, fontSize: 13, color: v2.ink },
  optionChipTextActive: { color: v2.surface },
  input: {
    borderWidth: 1,
    borderColor: v2.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 14,
    fontFamily: V2_FONTS.interRegular,
    color: v2.ink,
    backgroundColor: v2.surface,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  decisionCard: { backgroundColor: v2.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, borderWidth: 1, borderColor: v2.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  decisionActor: { fontFamily: V2_FONTS.interBold, fontSize: 13, color: v2.ink },
});
