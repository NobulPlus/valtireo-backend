const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../mobile/node_modules/typescript');
function load(file, stubs, extras = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(`mobile/${file}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { if (!(name in stubs)) throw Error(name); return stubs[name]; }, ...extras });
  return exports;
}
async function run() {
  const directory = load('src/features/directory/api.ts', {
    '@tanstack/react-query': { useQuery: x => x }, '../../lib/apiClient': { api: { get: (url, options) => options.params } },
  });
  console.log('Directory all params:', directory.useEmployeeDirectory({ department_id: 'all' }).queryFn());
  let parts;
  const profile = load('src/features/profile/api.ts', {
    '@tanstack/react-query': { useMutation: x => x, useQueryClient: () => ({}) },
    '../../context/AuthContext': { useAuth: () => ({}) },
    '../../lib/apiClient': { api: { post: (url, form) => { parts = form.parts; } } },
  }, { FormData: class { parts = []; append(k,v) { this.parts.push([k,v]); } } });
  await profile.useUpdateMyProfile().mutationFn({ personal_email: null, residential_address: null });
  console.log('Cleared profile fields payload:', parts);
  let finishDeletion;
  let session = 'old';
  const events = [];
  const tokens = load('src/lib/secureToken.ts', {
    'expo-secure-store': { getItemAsync: async () => 'old-token', deleteItemAsync: () => new Promise(resolve => { finishDeletion = resolve; }), setItemAsync: async () => {} },
    './sessionEvents': { notifySessionChange: () => { events.push(tokens.getStoredToken()); session = null; } },
  });
  await tokens.loadStoredToken();
  const deletion = tokens.setStoredToken(null);
  await tokens.setStoredToken('new-token');
  session = 'new login';
  finishDeletion(); await deletion;
  console.log('Delayed token-delete event after new login:', { token: tokens.getStoredToken(), session, events });
}
run();
