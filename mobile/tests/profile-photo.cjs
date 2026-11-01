const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, stubs = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, URL, require: (name) => { if (!(name in stubs)) throw Error(name); return stubs[name]; } });
  return exports;
}
test('private photo requests follow the configured API and keep replacement versions', () => {
  const { resolveAssetUrl, avatarSource } = load('assetUrl.ts');
  const base = 'http://192.168.1.20:8000/api';
  for (const host of ['http://127.0.0.1:8000', 'https://old.example.test']) {
    assert.equal(resolveAssetUrl(`${host}/api/employees/42/photo?v=new`, base), `${base}/employees/42/photo?v=new`);
  }
  const source = avatarSource('/api/employees/42/photo?v=new', base, 'test-token');
  assert.equal(source.headers.Authorization, 'Bearer test-token');
  for (const uri of ['file:///preview.jpg', 'content://preview', 'https://cdn.example.test/a.jpg']) {
    assert.equal(avatarSource(uri, base, 'test-token').headers, undefined);
  }
});
test('mobile preparation resizes portrait and landscape images and returns JPEG multipart metadata', async () => {
  for (const [width, height, expected] of [[4000, 3000, { width: 1024 }], [2000, 4000, { height: 1024 }], [400, 300, null]]) {
    let resized = null; let released = 0;
    const image = { saveAsync: async (options) => { assert.equal(options.format, 'jpeg'); return { uri: 'file:///converted.jpg' }; }, release: () => released++ };
    const context = { resize: (size) => { resized = JSON.parse(JSON.stringify(size)); }, renderAsync: async () => image, release: () => released++ };
    const { prepareProfilePhoto } = load('profilePhoto.ts', { 'expo-image-manipulator': { ImageManipulator: { manipulate: () => context }, SaveFormat: { JPEG: 'jpeg' } }, 'expo-file-system': { File: class { exists = true; size = 100000; } } });
    const result = await prepareProfilePhoto({ uri: 'file:///original.heic', width, height });
    assert.deepEqual(resized, expected);
    assert.equal(result.name, 'profile-photo.jpg');
    assert.equal(result.type, 'image/jpeg');
    assert.equal(released, 2);
  }
});
test('oversized processed photos are discarded before upload', async () => {
  let deleted = false;
  const { prepareProfilePhoto } = load('profilePhoto.ts', {
    'expo-image-manipulator': { ImageManipulator: { manipulate: () => ({ renderAsync: async () => ({ saveAsync: async () => ({ uri: 'file:///large.jpg' }), release() {} }), release() {} }) }, SaveFormat: { JPEG: 'jpeg' } },
    'expo-file-system': { File: class { exists = true; size = 3 * 1024 * 1024; delete() { deleted = true; } } },
  });
  await assert.rejects(prepareProfilePhoto({ uri: 'file:///original.jpg', width: 400, height: 400 }), /2 MB/);
  assert.equal(deleted, true);
});
