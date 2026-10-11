import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import { AxiosError } from 'axios';

// Exercise the actual client modules without a server, browser, or added dependency.
const root = fileURLToPath(new URL('../', import.meta.url));
const compiled = await fs.mkdtemp(path.join(root, '.session-tests-'));
test.after(async () => {
  if (path.dirname(path.resolve(compiled)) !== path.resolve(root) || !path.basename(compiled).startsWith('.session-tests-')) {
    throw new Error('Unexpected temporary test directory');
  }
  await fs.rm(compiled, { recursive: true, force: true });
});
for (const name of ['ApiError', 'sessionEvents', 'apiClient', 'queryClient']) {
  const source = await fs.readFile(path.join(root, 'src/lib', name + '.ts'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replaceAll('import.meta.env', '({})')
    .replace(/from '\.\/(ApiError|sessionEvents)'/g, "from './$1.mjs'");
  await fs.writeFile(path.join(compiled, name + '.mjs'), output);
}
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
const { apiClient, setStoredToken, getStoredToken, onUnauthorized, onWorkspaceSuspended } =
  await import(pathToFileURL(path.join(compiled, 'apiClient.mjs')));
const { queryClient } = await import(pathToFileURL(path.join(compiled, 'queryClient.mjs')));

function deferredResponse() {
  let finish;
  const response = new Promise((resolve) => { finish = resolve; });
  return {
    adapter: async (config) => { await response; return { data: { private: 'old account' }, status: 200, statusText: 'OK', headers: {}, config }; },
    finish: () => finish(),
  };
}

test('switching tokens clears private query and mutation caches, including invitation sign-in', () => {
  setStoredToken('first');
  queryClient.setQueryData(['employees'], [{ name: 'Private Employee' }]);
  queryClient.getMutationCache().build(queryClient, { mutationKey: ['payroll'] });
  setStoredToken('invitation-account');
  assert.equal(queryClient.getQueryCache().getAll().length, 0);
  assert.equal(queryClient.getMutationCache().getAll().length, 0);
});

test('a late query cannot repopulate data after logout', async () => {
  setStoredToken('first');
  const pending = deferredResponse();
  const result = queryClient.fetchQuery({ queryKey: ['employees'], queryFn: () => apiClient.get('/employees', { adapter: pending.adapter }), retry: false }).catch((error) => error);
  setStoredToken(null);
  pending.finish();
  await result;
  assert.equal(queryClient.getQueryData(['employees']), undefined);
});

test('a late direct response from another session is rejected', async () => {
  setStoredToken('first');
  const pending = deferredResponse();
  const response = apiClient.get('/employees', { adapter: pending.adapter });
  setStoredToken('second');
  pending.finish();
  await assert.rejects(response, /session has changed/i);
});

test('a late anonymous response cannot establish a second session', async () => {
  setStoredToken(null);
  const pending = deferredResponse();
  const response = apiClient.post('/auth/login', {}, { adapter: pending.adapter });
  setStoredToken('other-login');
  pending.finish();
  await assert.rejects(response, /session has changed/i);
});

test('old 401 responses do not log out the new account', async () => {
  setStoredToken('first');
  let rejectRequest;
  let calls = 0;
  const unsubscribe = onUnauthorized(() => { calls += 1; });
  const response = apiClient.get('/private', { adapter: (config) => new Promise((resolve, reject) => {
    rejectRequest = () => reject(new AxiosError('Expired', 'ERR_BAD_REQUEST', config, null, { status: 401, data: { message: 'Private old-account error' }, config }));
  }) });
  setStoredToken('second');
  rejectRequest();
  await assert.rejects(response, /session has changed/i);
  assert.equal(getStoredToken(), 'second');
  assert.equal(calls, 0);
  unsubscribe();
});

test('current account revocation clears its token and cached data', async () => {
  setStoredToken('revoked');
  queryClient.setQueryData(['payroll'], { total: 123 });
  let calls = 0;
  const unsubscribe = onUnauthorized(() => { calls += 1; });
  await assert.rejects(apiClient.get('/auth/me', { adapter: async (config) => {
    throw new AxiosError('Revoked', 'ERR_BAD_REQUEST', config, null, { status: 401, data: { code: 'account_access_revoked' }, config });
  } }));
  assert.equal(getStoredToken(), null);
  assert.equal(queryClient.getQueryData(['payroll']), undefined);
  assert.equal(calls, 1);
  unsubscribe();
});

test('organization revocation uses its error code and clears the session', async () => {
  setStoredToken('organization');
  let calls = 0;
  const unsubscribe = onWorkspaceSuspended(() => { calls += 1; });
  await assert.rejects(apiClient.get('/auth/me', { adapter: async (config) => {
    throw new AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, null, { status: 403, data: { code: 'organization_access_revoked', message: 'Organization unavailable' }, config });
  } }));
  assert.equal(getStoredToken(), null);
  assert.equal(calls, 1);
  unsubscribe();
});

test('logout retains the explicitly captured token', async () => {
  setStoredToken('new-session');
  let sent;
  await assert.rejects(apiClient.post('/auth/logout', undefined, {
    headers: { Authorization: 'Bearer old-session' },
    adapter: async (config) => { sent = config.headers.Authorization; return { status: 200, data: {}, headers: {}, config }; },
  }));
  assert.equal(sent, 'Bearer old-session');
  assert.equal(getStoredToken(), 'new-session');
});
