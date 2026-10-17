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

  // Appreciation only, exact count (not capped).
  const appreciationOnly = selectLifestyleHomeSummary({ milestonesEnabled: false, appreciationEnabled: true, milestones: undefined, receivedAppreciationCount: 2, receivedAppreciationCapped: false, today });
  assert.equal(appreciationOnly.milestoneLabel, null);
  assert.equal(appreciationOnly.appreciationLabel, '2 new appreciation messages');

  // Capped count is honest ("N+"), singular wording only when both exact and 1.
  const capped = selectLifestyleHomeSummary({ milestonesEnabled: false, appreciationEnabled: true, milestones: undefined, receivedAppreciationCount: 10, receivedAppreciationCapped: true, today });
  assert.equal(capped.appreciationLabel, '10+ new appreciation messages');
  const exactlyOne = selectLifestyleHomeSummary({ milestonesEnabled: false, appreciationEnabled: true, milestones: undefined, receivedAppreciationCount: 1, receivedAppreciationCapped: false, today });
  assert.equal(exactlyOne.appreciationLabel, '1 new appreciation message');

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
