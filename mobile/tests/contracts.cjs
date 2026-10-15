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
