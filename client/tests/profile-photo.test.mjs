import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
const source = fs.readFileSync(new URL('../src/lib/profilePhotoUrl.ts', import.meta.url), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, URL });
test('photo reads use the web API client proxy and retain the version', () => {
  for (const url of ['/api/employees/12/photo?v=2', 'http://127.0.0.1:8000/api/employees/12/photo?v=2', 'https://old.example/api/employees/12/photo?v=2']) {
    assert.equal(exports.profilePhotoEndpoint(url), '/employees/12/photo?v=2');
  }
});
test('arbitrary image destinations cannot receive bearer tokens through the photo hook', () => {
  for (const url of ['https://evil.test/collect', 'javascript:alert(1)', 'file:///photo.jpg', null]) {
    assert.equal(exports.profilePhotoEndpoint(url), null);
  }
});
