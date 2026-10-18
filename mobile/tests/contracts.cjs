const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, stubs, globals = {}) {
  const filename = path.join(__dirname, '..', relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => {
    if (!(name in stubs)) throw new Error(`Unexpected dependency: ${name}`);
    return stubs[name];
  }, ...globals }, { filename });
  return exports;
}

// A plain object/array literal returned by a vm.runInNewContext()-loaded module has a
// DIFFERENT Object/Array prototype than one constructed in this file's own realm — two
// JSON-serializable values that look identical still fail `assert.deepEqual` (this file's
// `assert` is `node:assert/strict`, which aliases `deepEqual` to `deepStrictEqual`, and
// strict equality cares about that prototype identity). Round-tripping through JSON drops
// it, since every value compared this way here is already plain data (no functions,
// undefined, or Dates) — this isn't appropriate for values that aren't.
const plain = (value) => JSON.parse(JSON.stringify(value));

const query = { useQuery: (config) => config, useMutation: (config) => config, useQueryClient: () => ({ invalidateQueries() {} }) };
const infinite = { INFINITE_LIST_PAGE_SIZE: 10, useInfiniteList: (key, fetchPage) => ({ fetchPage }) };
test('saved local profile photos use the phone-reachable API origin', () => {
  const { resolveAssetUrl } = load('src/lib/assetUrl.ts', {}, { URL });
  const base = 'http://192.168.1.25:8000/api';
  assert.equal(resolveAssetUrl('http://127.0.0.1:8000/storage/passport.jpg?v=2', base), 'http://192.168.1.25:8000/storage/passport.jpg?v=2');
  assert.equal(resolveAssetUrl('/storage/passport.jpg', base), 'http://192.168.1.25:8000/storage/passport.jpg');
  assert.equal(resolveAssetUrl('https://cdn.example.com/storage/photo.jpg?signature=123', base), 'https://cdn.example.com/storage/photo.jpg?signature=123');
  assert.equal(resolveAssetUrl('file:///picked-photo.jpg', base), 'file:///picked-photo.jpg');
  assert.equal(resolveAssetUrl(null, base), null);
  assert.equal(resolveAssetUrl('javascript:alert(1)', base), null);
});
test('picker MIME metadata becomes the native multipart content type', () => {
  const { uploadFile } = load('src/lib/uploadFile.ts', {});
  const part = uploadFile({ uri: 'file:///passport.png', fileName: 'passport.png', mimeType: 'image/png' });
  assert.equal(part.type, 'image/png');
  assert.equal(part.name, 'passport.png');
  assert.equal(part.mimeType, undefined);
  assert.equal(uploadFile({ uri: 'file:///unknown.pdf' }).type, 'application/octet-stream');
});
class NativeFormData {
  parts = [];
  append(name, value) {
    // Android's NetworkingModule rejects a URI part without content-type.
    if (value && typeof value === 'object' && value.uri) assert.equal(typeof value.type, 'string');
    this.parts.push([name, value]);
  }
}

test('leave upload supplies a native file part and requested history page', async () => {
  let request;
  const api = { post: (...args) => { request = args; }, get: (...args) => args };
  const module = load('src/features/leave/api.ts', {
    '@tanstack/react-query': query, 'expo-file-system': {}, 'expo-sharing': {},
    '../../lib/useInfiniteList': infinite,
    '../../lib/apiClient': { api }, '../../lib/secureToken': {},
  }, { FormData: NativeFormData });
  await module.useCreateLeaveRequest().mutationFn({ leave_type_id: 1, starts_on: '2026-10-20', ends_on: '2026-10-21', evidence: { uri: 'file:///evidence.pdf', name: 'evidence.pdf', type: 'application/pdf' } });
  assert.equal(request[0], '/leave/requests');
  assert.equal(request[1].parts.find(([key]) => key === 'evidence')[1].type, 'application/pdf');
  assert.equal(module.useMyLeaveRequests().fetchPage(3)[1].params.page, 3);
});

test('profile, document and signed-copy uploads preserve native file parts', async () => {
  const requests = [];
  const module = load('src/features/profile/api.ts', {
    '@tanstack/react-query': query, '../../lib/apiClient': { api: { post: (...args) => requests.push(args) } },
    '../../context/AuthContext': { useAuth: () => ({ refresh() {} }) },
  }, { FormData: NativeFormData });
  const file = { uri: 'file:///scan.png', name: 'scan.png', type: 'image/png' };
  await module.useUpdateMyProfile().mutationFn({ passport_photo: file });
  await module.useSubmitMyDocument().mutationFn({ document_type_id: 1, title: 'ID', file });
  await module.useSubmitSignedCopy().mutationFn({ documentId: 7, file });
  assert.equal(requests[0][1].parts.find(([key]) => key === '_method')[1], 'PATCH');
  assert.equal(requests[2][0], '/documents/7/signed-copy');
  assert.equal(requests[2][1].parts.find(([key]) => key === 'file')[1].type, 'image/png');
});

test('payslip pagination requests the selected page', () => {
  const module = load('src/features/payroll/api.ts', {
    '@tanstack/react-query': query, '../../lib/apiClient': { api: { get: (...args) => args } }, '../leave/api': {},
    '../../lib/useInfiniteList': infinite,
  });
  assert.equal(module.useMyPayslips().fetchPage(4)[1].params.page, 4);
});

test('a download completed after logout is deleted and never shared', async () => {
  let token = 'old-session'; let shared = false; let deleted = false;
  class File {
    static async downloadFileAsync() { token = null; return { uri: 'file:///cached.pdf', exists: true, delete() { deleted = true; } }; }
  }
  const module = load('src/features/leave/api.ts', {
    '@tanstack/react-query': query, 'expo-file-system': { File, Paths: { cache: 'cache' } },
    '../../lib/useInfiniteList': infinite,
    'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => { shared = true; } },
    '../../lib/apiClient': { apiClient: { defaults: { baseURL: 'https://example.test/api' } } },
    '../../lib/secureToken': { getStoredToken: () => token },
  });
  await assert.rejects(module.downloadAndShare('/documents/1/download', '../test.pdf'), /session changed/);
  assert.equal(shared, false);
  assert.equal(deleted, true);
});

test('late logout persistence cannot invalidate a newer login', async () => {
  let releaseDelete; const events = []; let disk = 'old';
  const module = load('src/lib/secureToken.ts', {
    'expo-secure-store': { getItemAsync: async () => disk, deleteItemAsync: () => new Promise((resolve) => { releaseDelete = () => { disk = null; resolve(); }; }), setItemAsync: async (_, value) => { disk = value; } },
    './sessionEvents': { notifySessionChange: () => events.push(module.getStoredToken()) },
  });
  await module.loadStoredToken();
  const logout = module.setStoredToken(null);
  const login = module.setStoredToken('new');
  await Promise.resolve();
  assert.deepEqual(events, [null, 'new']);
  releaseDelete(); await logout; await login;
  assert.equal(disk, 'new'); assert.equal(module.getStoredToken(), 'new');
  assert.deepEqual(events, [null, 'new']);
});

test('failed token persistence rejects sign-in and does not poison the next write', async () => {
  let fail = true;
  const module = load('src/lib/secureToken.ts', {
    'expo-secure-store': { getItemAsync: async () => null, deleteItemAsync: async () => {}, setItemAsync: async () => { if (fail) throw new Error('locked'); } },
    './sessionEvents': { notifySessionChange() {} },
  });
  await assert.rejects(module.setStoredToken('one'), /locked/);
  assert.equal(module.getStoredToken(), null);
  fail = false; await module.setStoredToken('two'); assert.equal(module.getStoredToken(), 'two');
});

test('startup read cannot overwrite a newer login', async () => {
  let resolveRead;
  const module = load('src/lib/secureToken.ts', {
    'expo-secure-store': { getItemAsync: () => new Promise((resolve) => { resolveRead = resolve; }), setItemAsync: async () => {} },
    './sessionEvents': { notifySessionChange() {} },
  });
  const reading = module.loadStoredToken(); await module.setStoredToken('new'); resolveRead('old');
  await reading; assert.equal(module.getStoredToken(), 'new');
});

test('biometric startup reads identity only and credential access requires native authentication', async () => {
  const reads = [];
  const writes = [];
  const module = load('src/lib/secureToken.ts', {
    'expo-secure-store': {
      getItemAsync: async (key, options) => { reads.push({ key, options }); return JSON.stringify({ email: 'test@example.test', name: 'Test', password: 'synthetic' }); },
      canUseBiometricAuthentication: () => true,
      setItemAsync: async (key, value, options) => { writes.push({ key, value: JSON.parse(value), options }); },
      deleteItemAsync: async () => {},
    },
    './sessionEvents': { notifySessionChange() {} },
  });
  const identity = await module.loadBiometricIdentity();
  assert.equal(identity.password, undefined);
  assert.match(reads[0].key, /identity/);
  await module.loadBiometricCredential();
  assert.equal(reads[1].options.requireAuthentication, true);
  await module.setBiometricCredential({ email: 'test@example.test', name: 'Test', password: 'synthetic' });
  assert.equal(writes[0].options.requireAuthentication, true);
  assert.equal(writes[1].value.password, undefined);
});

test('a native biometric-prompt failure stays on the biometric view; only an account-level rejection falls back to the password form', () => {
  class FakeApiError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }
  const { classifyBiometricFailure } = load('src/lib/biometricErrorPresentation.ts', {
    './apiClient': { ApiError: FakeApiError },
  });

  // A wrong fingerprint, a cancelled prompt, or a lockout all surface as some
  // native (non-ApiError) rejection from the OS — none of these are password
  // problems, so the caller must stay put and let the person retry.
  for (const nativeFailure of [new Error('UserCancel'), new Error('AuthenticationFailed'), 'not even an Error object', undefined]) {
    const outcome = classifyBiometricFailure(nativeFailure, 'Fingerprint');
    assert.equal(outcome.fallBackToPasswordForm, false);
    assert.match(outcome.message, /Fingerprint not recognized/);
    assert.doesNotMatch(outcome.message, /email|password field|Enter your/i);
  }

  // Nothing saved on this device at all (biometric sign-in was never enabled,
  // or was disabled) — genuinely nothing to retry, so fall back.
  const nothingSaved = classifyBiometricFailure(new FakeApiError('No saved sign-in found on this device.', 401), 'Face ID');
  assert.equal(nothingSaved.fallBackToPasswordForm, true);
  assert.equal(nothingSaved.message, 'No saved sign-in found on this device.');

  // The saved password was rejected by the server (changed elsewhere, account
  // disabled) — also genuinely nothing to retry biometrically.
  const rejectedByServer = classifyBiometricFailure(new FakeApiError('These credentials do not match our records.', 401), 'Face ID');
  assert.equal(rejectedByServer.fallBackToPasswordForm, true);
  assert.equal(rejectedByServer.message, 'These credentials do not match our records.');
});

test('pending-action navigation: only complete_profile is actionable, module access gates every destination, unknown keys fail gracefully', () => {
  const { resolvePendingAction } = load('src/lib/pendingActionNavigation.ts', {});
  const fullAccess = { leave: true, serviceDesk: true };
  const noAccess = { leave: false, serviceDesk: false };

  assert.deepEqual(plain(resolvePendingAction('complete_profile', fullAccess)), { tone: 'actionable', destination: { kind: 'profile' } });
  assert.deepEqual(plain(resolvePendingAction('profile_approval', fullAccess)), { tone: 'informational', destination: { kind: 'profile' } });
  assert.deepEqual(plain(resolvePendingAction('leave_approval', fullAccess)), { tone: 'informational', destination: { kind: 'leaveTab' } });
  assert.deepEqual(plain(resolvePendingAction('leave_handover_cover', fullAccess)), { tone: 'informational', destination: { kind: 'leaveTab' } });
  assert.deepEqual(plain(resolvePendingAction('ticket_pending', fullAccess)), { tone: 'informational', destination: { kind: 'ticketsTab' } });

  // Module access revoked after the action was generated — fail gracefully, no destination.
  assert.deepEqual(plain(resolvePendingAction('leave_approval', noAccess).destination), { kind: 'none' });
  assert.deepEqual(plain(resolvePendingAction('ticket_pending', noAccess).destination), { kind: 'none' });
  // Profile has no module gate — unaffected by access.
  assert.deepEqual(plain(resolvePendingAction('complete_profile', noAccess).destination), { kind: 'profile' });

  // A key this client doesn't recognize yet — informational, not tappable, never throws.
  assert.deepEqual(plain(resolvePendingAction('future_unknown_key', fullAccess)), { tone: 'informational', destination: { kind: 'none' } });
});

test('"Needs your attention" heading only appears when something in the list actually is', () => {
  const { selectPendingActionsHeading } = load('src/lib/pendingActionNavigation.ts', {});
  // complete_profile present — genuinely something to act on.
  assert.equal(selectPendingActionsHeading(['actionable', 'informational', 'informational']), 'Needs your attention');
  // Every item is just a status (e.g. leave_approval, ticket_pending, ...) — must not
  // be framed as something requiring intervention.
  assert.equal(selectPendingActionsHeading(['informational', 'informational']), 'Updates');
  assert.equal(selectPendingActionsHeading(['informational']), 'Updates');
  assert.equal(selectPendingActionsHeading([]), 'Updates');
});

test('manager eligibility is has_manager_scope alone — nothing else substitutes, and it tracks a mid-session permission change', () => {
  const { isEligibleForManagerHome } = load('src/lib/managerEligibility.ts', {});

  assert.equal(isEligibleForManagerHome({ has_manager_scope: true }), true);
  assert.equal(isEligibleForManagerHome({ has_manager_scope: false }), false);
  assert.equal(isEligibleForManagerHome(null), false);
  assert.equal(isEligibleForManagerHome(undefined), false);

  // A session with manager-sounding extra fields (designation, department, even an
  // HR/service-desk permission) must NOT make this true on its own — only the one
  // field does. Plain JS objects are fine here; the function only reads has_manager_scope.
  assert.equal(
    isEligibleForManagerHome({ has_manager_scope: false, designation: 'Engineering Manager', department: 'Engineering', service_desk_view: true, is_hr_admin: true }),
    false,
  );
  assert.equal(
    isEligibleForManagerHome({ has_manager_scope: true, designation: 'Individual Contributor' }),
    true,
  );

  // A mid-session permission change (e.g. after pulling to refresh re-fetches the
  // session) — the function is pure and re-derives fresh each call, no hidden caching.
  let session = { has_manager_scope: true };
  assert.equal(isEligibleForManagerHome(session), true);
  session = { has_manager_scope: false }; // permission revoked, session re-fetched
  assert.equal(isEligibleForManagerHome(session), false);
});

test('team scope label describes exactly what the backend resolved, with a safe fallback', () => {
  const { describeTeamScope } = load('src/lib/managerTeamSummary.ts', {});
  assert.equal(describeTeamScope({ type: 'department', department: { id: 1, code: 'ENG', name: 'Engineering' } }), 'Engineering department');
  assert.equal(describeTeamScope({ type: 'cluster', cluster: { id: 2, code: 'WEST', name: 'West Region' } }), 'West Region cluster');
  assert.equal(describeTeamScope({ type: 'direct_reports' }), 'Your direct reports');
  // Malformed combinations (claims department scope but the department object is
  // missing) fall back safely rather than rendering "undefined department".
  assert.equal(describeTeamScope({ type: 'department' }), 'Your direct reports');
  assert.equal(describeTeamScope(null), 'Your team');
  assert.equal(describeTeamScope(undefined), 'Your team');
});

test('manager team summary only surfaces current-state counts, defaults missing fields to 0, and never reads the all-time attendance/leave totals', () => {
  const { selectManagerTeamSummary } = load('src/lib/managerTeamSummary.ts', {});

  const full = {
    scope: { type: 'department', department: { id: 1, code: 'ENG', name: 'Engineering' } },
    employees: { total: 12, active: 10, draft: 1, invited: 1, onboarding: 0, suspended: 0, exited: 0 },
    team_health: { profiles_pending: 2, profiles_submitted: 1, profiles_approved: 7, incomplete_profiles: 3 },
    leave: { available: true, pending_requests: 4, approved_requests: 50, rejected_requests: 2, days_pending: 6, days_approved: 120 },
    attendance: { available: true, present: 900, late: 40, absent: 12, corrections_pending: 1, duration_minutes: 50000 },
  };
  const summary = plain(selectManagerTeamSummary(full));
  assert.deepEqual(summary, { scopeLabel: 'Engineering department', teamSize: 10, leavePending: 4, correctionsPending: 1, incompleteProfiles: 3 });
  // `active`, not `total` — total includes exited/draft employees, not meaningfully "the team".
  assert.notEqual(summary.teamSize, full.employees.total);
  // The all-time cumulative fields (present/late/absent/approved_requests/days_*) are
  // genuinely not read anywhere in the mapping — confirmed by the output object's own
  // keys, not just by inspection of the source.
  assert.deepEqual(Object.keys(summary).sort(), ['correctionsPending', 'incompleteProfiles', 'leavePending', 'scopeLabel', 'teamSize']);

  // A genuinely empty team (a newly-promoted manager with no reports yet) — real
  // zeros, not an error, not hidden.
  const empty = {
    scope: { type: 'direct_reports' },
    employees: { total: 0, active: 0, draft: 0, invited: 0, onboarding: 0, suspended: 0, exited: 0 },
    team_health: { profiles_pending: 0, profiles_submitted: 0, profiles_approved: 0, incomplete_profiles: 0 },
    leave: { available: true, pending_requests: 0, approved_requests: 0, rejected_requests: 0, days_pending: 0, days_approved: 0 },
    attendance: { available: true, present: 0, late: 0, absent: 0, corrections_pending: 0, duration_minutes: 0 },
  };
  assert.deepEqual(plain(selectManagerTeamSummary(empty)), { scopeLabel: 'Your direct reports', teamSize: 0, leavePending: 0, correctionsPending: 0, incompleteProfiles: 0 });

  // Missing/optional sub-objects (a real response surprising the client) default to 0
  // rather than throwing.
  const partial = { scope: { type: 'direct_reports' } };
  assert.deepEqual(plain(selectManagerTeamSummary(partial)), { scopeLabel: 'Your direct reports', teamSize: 0, leavePending: 0, correctionsPending: 0, incompleteProfiles: 0 });
});

test('manager scope revocation is detected only on a true-to-false transition, so the cached manager dashboard is purged exactly then — not on grant, not when nothing changed, not on a session that never existed', () => {
  const { managerScopeWasRevoked } = load('src/lib/managerEligibility.ts', {});

  // The one case that must purge: a session that WAS a manager no longer is.
  assert.equal(managerScopeWasRevoked({ has_manager_scope: true }, { has_manager_scope: false }), true);

  // Every other transition must NOT purge — a scope grant, no change either way
  // (true->true or false->false), and no prior session at all (first bootstrap,
  // nothing stale to purge).
  assert.equal(managerScopeWasRevoked({ has_manager_scope: false }, { has_manager_scope: true }), false);
  assert.equal(managerScopeWasRevoked({ has_manager_scope: true }, { has_manager_scope: true }), false);
  assert.equal(managerScopeWasRevoked({ has_manager_scope: false }, { has_manager_scope: false }), false);
  assert.equal(managerScopeWasRevoked(null, { has_manager_scope: false }), false);
  assert.equal(managerScopeWasRevoked(undefined, { has_manager_scope: true }), false);
  // A session that disappears entirely also counts as revoked — `next: null`
  // means "no session," which is certainly not manager-eligible. In practice
  // this exact call site (bootstrap's success branch) never passes null for
  // `next`, since a full logout instead goes through clearSession's own
  // queryClient.clear(); this case just confirms the function stays correct
  // (not merely non-crashing) if it were ever reached that way.
  assert.equal(managerScopeWasRevoked({ has_manager_scope: true }, null), true);
});

test('manager dashboard refetch after pull-to-refresh is gated on the FRESH session, not a stale pre-refresh value — so a request is never fired the instant scope is revoked, and never skipped the instant it is granted', () => {
  const { shouldRefetchManagerDashboard } = load('src/lib/managerEligibility.ts', {});

  // Scope just revoked: the fresh session says no, regardless of what the
  // caller believed before the refresh (this is the exact race the review
  // flagged — refetching here would be an unnecessary, doomed-to-403 request).
  assert.equal(shouldRefetchManagerDashboard({ has_manager_scope: false }, true), false);

  // Scope just granted mid-session: the fresh session says yes, even though
  // the caller's prior render had no reason to believe it was eligible yet.
  assert.equal(shouldRefetchManagerDashboard({ has_manager_scope: true }, false), true);

  // Steady state, no transition either way: fresh session is authoritative.
  assert.equal(shouldRefetchManagerDashboard({ has_manager_scope: true }, true), true);
  assert.equal(shouldRefetchManagerDashboard({ has_manager_scope: false }, false), false);

  // The refresh itself couldn't resolve anything new (network/server error, or
  // superseded by a newer session transition) — fall back to what was already
  // known rather than guessing either way.
  assert.equal(shouldRefetchManagerDashboard(undefined, true), true);
  assert.equal(shouldRefetchManagerDashboard(undefined, false), false);

  // An explicit logout/invalid-token result (null) is a real answer, not an
  // unknown — never refetch.
  assert.equal(shouldRefetchManagerDashboard(null, true), false);
});

test('notification deep-linking: the explicit allowlist covers every real backend action_url, rejects unauthorized/malformed/unsupported combinations', () => {
  const { resolveNotificationDestination } = load('src/lib/notificationNavigation.ts', {});
  const fullAccess = { leave: true, serviceDesk: true, employeeSelfService: true };
  const noAccess = { leave: false, serviceDesk: false, employeeSelfService: false };

  // Supported: a ticket notification whose entity_id agrees with the id embedded in action_url.
  assert.deepEqual(
    plain(resolveNotificationDestination({ entity_type: 'ticket', entity_id: 42, action_url: '/service-desk?ticket=42' }, fullAccess)),
    { kind: 'ticketDetail', ticketId: 42 },
  );
  // Malformed: entity_id disagrees with the URL's id — don't guess, fall back to the list.
  assert.deepEqual(
    plain(resolveNotificationDestination({ entity_type: 'ticket', entity_id: 7, action_url: '/service-desk?ticket=42' }, fullAccess)),
    { kind: 'ticketsTab' },
  );
  // Supported: the "comment by someone else" ticket notification shape (/me/tickets, no id).
  assert.deepEqual(plain(resolveNotificationDestination({ entity_type: 'ticket', entity_id: null, action_url: '/me/tickets' }, fullAccess)), { kind: 'ticketsTab' });
  // Unauthorized: same valid ticket shape, but the module was disabled since the notification was sent.
  assert.deepEqual(plain(resolveNotificationDestination({ entity_type: 'ticket', entity_id: 42, action_url: '/service-desk?ticket=42' }, noAccess)), { kind: 'unsupported' });

  assert.deepEqual(plain(resolveNotificationDestination({ entity_type: 'leave_request', entity_id: 9, action_url: '/me/leave' }, fullAccess)), { kind: 'leaveTab' });
  assert.deepEqual(plain(resolveNotificationDestination({ entity_type: 'leave_request', entity_id: 9, action_url: '/me/leave' }, noAccess)), { kind: 'unsupported' });

  assert.deepEqual(plain(resolveNotificationDestination({ entity_type: 'company_event', entity_id: null, action_url: '/calendar' }, noAccess)), { kind: 'moreScreen', screen: 'Calendar' });

  assert.deepEqual(plain(resolveNotificationDestination({ entity_type: 'employee_document', entity_id: 3, action_url: '/me/profile?tab=documents' }, fullAccess)), { kind: 'moreScreen', screen: 'Documents' });
  assert.deepEqual(plain(resolveNotificationDestination({ entity_type: 'employee_appreciation', entity_id: 5, action_url: '/me/lifestyle' }, fullAccess)), { kind: 'moreScreen', screen: 'Lifestyle' });

  // approval_request is self-facing here (decidedActionFor's two employee-subject branches) — routes to Leave or Documents, same as the dedicated entity types above.
  assert.deepEqual(plain(resolveNotificationDestination({ entity_type: 'approval_request', entity_id: 11, action_url: '/me/leave' }, fullAccess)), { kind: 'leaveTab' });
  assert.deepEqual(plain(resolveNotificationDestination({ entity_type: 'approval_request', entity_id: 11, action_url: '/me/profile?tab=documents' }, fullAccess)), { kind: 'moreScreen', screen: 'Documents' });
  // The reviewer-facing approval_request shape — no manager-approval screen exists on mobile (Phase C, explicitly out of scope) — unsupported, not a crash or a guess.
  assert.deepEqual(plain(resolveNotificationDestination({ entity_type: 'approval_request', entity_id: 11, action_url: '/approvals/11' }, fullAccess)), { kind: 'unsupported' });

  // Admin/HR-facing entity types with no employee-mobile screen at all.
  for (const entityType of ['organization', 'employee_invitation', 'employee']) {
    assert.deepEqual(plain(resolveNotificationDestination({ entity_type: entityType, entity_id: 1, action_url: '/anything' }, fullAccess)), { kind: 'unsupported' });
  }
  // Unrecognized entity_type, missing fields, and a ticket-shaped entity_type with a URL that doesn't match the known pattern.
  assert.deepEqual(plain(resolveNotificationDestination({}, fullAccess)), { kind: 'unsupported' });
  assert.deepEqual(plain(resolveNotificationDestination({ entity_type: 'ticket', entity_id: 1, action_url: '/something-else' }, fullAccess)), { kind: 'unsupported' });
});

test('Lifestyle Home card: feature flags gate content, an empty/disabled result never renders, counts are honest about being capped', () => {
  const { selectLifestyleHomeSummary } = load('src/lib/lifestyleHomeSummary.ts', {});
  const today = new Date('2026-10-20T12:00:00');
  const milestones = [{ employee: { name: 'Amara' }, type: 'birthday', date: '2026-10-23' }];

  // Both features off — never visible even though data is present, and no request should have been needed to know that (the screen is expected to gate the queries themselves on these same flags).
  assert.equal(selectLifestyleHomeSummary({ milestonesEnabled: false, appreciationEnabled: false, milestones, receivedAppreciationCount: 5, receivedAppreciationCapped: false, today }).visible, false);

  // Milestones only.
  const milestonesOnly = selectLifestyleHomeSummary({ milestonesEnabled: true, appreciationEnabled: false, milestones, receivedAppreciationCount: 5, receivedAppreciationCapped: false, today });
  assert.equal(milestonesOnly.visible, true);
  assert.equal(milestonesOnly.milestoneLabel, "Amara's birthday is in 3 days");
  assert.equal(milestonesOnly.appreciationLabel, null); // feature disabled — never shown even though a count was supplied.

  // Appreciation only, exact count (not capped). "received", not "new" — the
  // received-appreciation query has no read/unread concept, so the label must not
  // imply one.
  const appreciationOnly = selectLifestyleHomeSummary({ milestonesEnabled: false, appreciationEnabled: true, milestones: undefined, receivedAppreciationCount: 2, receivedAppreciationCapped: false, today });
  assert.equal(appreciationOnly.milestoneLabel, null);
  assert.equal(appreciationOnly.appreciationLabel, '2 appreciations received');

  // Capped count is honest ("N+"), singular wording only when both exact and 1.
  const capped = selectLifestyleHomeSummary({ milestonesEnabled: false, appreciationEnabled: true, milestones: undefined, receivedAppreciationCount: 10, receivedAppreciationCapped: true, today });
  assert.equal(capped.appreciationLabel, '10+ appreciations received');
  const exactlyOne = selectLifestyleHomeSummary({ milestonesEnabled: false, appreciationEnabled: true, milestones: undefined, receivedAppreciationCount: 1, receivedAppreciationCapped: false, today });
  assert.equal(exactlyOne.appreciationLabel, '1 appreciation received');

  // Nothing to show at all — the card must not render an empty shell.
  const nothing = selectLifestyleHomeSummary({ milestonesEnabled: true, appreciationEnabled: true, milestones: [], receivedAppreciationCount: 0, receivedAppreciationCapped: false, today });
  assert.equal(nothing.visible, false);

  // "today" and "tomorrow" wording, and an anniversary's year count.
  const todayMilestone = selectLifestyleHomeSummary({ milestonesEnabled: true, appreciationEnabled: false, milestones: [{ employee: { name: 'Jordan' }, type: 'anniversary', date: '2026-10-20', years_of_service: 4 }], receivedAppreciationCount: 0, receivedAppreciationCapped: false, today });
  assert.equal(todayMilestone.milestoneLabel, "Jordan's 4-year work anniversary is today");
});

test('overnight correction dates survive timezone and year boundaries; invalid times fail', () => {
  const { correctionTimestamp } = load('src/lib/calendarDate.ts', {});
  assert.equal(correctionTimestamp('2026-12-31', '08:00', true), '2027-01-01T08:00:00');
  for (const time of ['99:99', '24:00', '12:60', '1:00']) assert.equal(correctionTimestamp('2026-10-14', time), undefined);
  assert.equal(correctionTimestamp('2026-02-30', '08:00'), undefined);
});

test('calendar loads actual API pages beyond the per-page cap', async () => {
  const requested = [];
  const { pagedResource } = load('src/lib/pagedResource.ts', { './apiClient': { api: { get: async (_, config) => {
    requested.push(config.params.page);
    assert.equal(config.params.per_page, 100);
    return { data: [config.params.page], meta: { last_page: 2, total: 101 } };
  } } } });
  const result = await pagedResource('/events', 300);
  assert.deepEqual(requested, [1, 2]); assert.equal(result.data.join(','), '1,2');
});

test('profile clearing sends intentional empty fields instead of silently dropping them', async () => {
  let sent;
  const module = load('src/features/profile/api.ts', {
    '@tanstack/react-query': query, '../../lib/apiClient': { api: { post: (_, body) => { sent = body; } } },
    '../../context/AuthContext': { useAuth: () => ({ refresh() {} }) },
  }, { FormData: NativeFormData });
  await module.useUpdateMyProfile().mutationFn({ personal_email: null, residential_address: undefined });
  assert.deepEqual(sent.parts.find(([key]) => key === 'personal_email'), ['personal_email', '']);
  assert.equal(sent.parts.some(([key]) => key === 'residential_address'), false);
});

test('directory explicitly requests every department and lifestyle queries obey flags', () => {
  const directory = load('src/features/directory/api.ts', { '@tanstack/react-query': query, '../../lib/useInfiniteList': infinite, '../../lib/apiClient': { api: { get: (...args) => args } } });
  assert.equal(directory.useEmployeeDirectory({ department_id: 'all' }).fetchPage(2)[1].params.department_id, 'all');
  const lifestyle = load('src/features/lifestyle/api.ts', { '@tanstack/react-query': query, '../../lib/useInfiniteList': { ...infinite, useInfiniteList: (_, __, options) => options }, '../../lib/apiClient': {} });
  assert.equal(lifestyle.useMilestones(30, false).enabled, false);
  assert.equal(lifestyle.useAppreciations('all', false).enabled, false);
});
