const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const { outputText } = ts.transpileModule(readFileSync(require.resolve('../src/policy-attachments.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
function setup() {
 const state = { canceled: false, size: 3, written: null, shared: null, deleted: false };
 class Directory {
  create() {} delete() { state.deleted = true; }
 }
 class File {
  size = state.size;
  uri = 'file:///cache/policy.pdf';
  async base64() { return 'YWJj'; }
  write(bytes) { state.written = Array.from(bytes); }
 }
 const mocks = {
  'expo-document-picker': { getDocumentAsync: async () => ({ canceled: state.canceled, assets: [{ name: 'policy.pdf', uri: 'file:///picked.pdf' }] }) },
  'expo-file-system': { Directory, File, Paths: { cache: 'file:///cache' } },
  'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async (uri) => { state.shared = uri; } },
 };
 const result = {};
 runInNewContext(outputText, { exports: result, Error, Uint8Array, Date, require: (name) => mocks[name] });
 return { state, ...result };
}

test('picker cancellation and oversized files do not create publication attachments', async () => {
 const api = setup();
 api.state.canceled = true;
 assert.equal(await api.pickPolicyAttachment(), null);
 api.state.canceled = false;
 api.state.size = 5242881;
 await assert.rejects(api.pickPolicyAttachment(), /5 MB/);
 api.state.size = 3;
 const attachment = await api.pickPolicyAttachment();
 assert.equal(attachment.name, 'policy.pdf'); assert.equal(attachment.data, 'YWJj'); assert.equal(attachment.size, 3);
});

test('download uses authenticated API, writes original bytes, shares, and cleans up', async () => {
 const api = setup();
 await api.downloadPolicyAttachment(async (path, init) => {
  assert.equal(path, '/api/policies/policy-id/attachment');
  assert.equal(init.headers.Accept, 'application/octet-stream');
  return new Response(new Uint8Array([0, 128, 255]));
 }, { id: 'policy-id', attachment_name: 'policy.pdf' });
 assert.deepEqual(api.state.written, [0, 128, 255]);
 assert.equal(api.state.shared, 'file:///cache/policy.pdf');
 assert.equal(api.state.deleted, true);
});

test('access denial never saves or shares attachment data', async () => {
 const api = setup();
 await assert.rejects(api.downloadPolicyAttachment(async () => new Response('Forbidden', { status: 403 }), { id: 'policy-id', attachment_name: 'policy.pdf' }), /Forbidden/);
 assert.equal(api.state.written, null); assert.equal(api.state.shared, null);
});


test('mandatory policy dialog downloads through the assigned-user endpoint', async () => {
 const api = setup();
 await api.downloadPolicyAttachment(async (path) => {
  assert.equal(path, '/api/policies/required/policy-id/attachment');
  return new Response('abc');
 }, { id: 'policy-id', attachment_name: 'policy.pdf' }, true);
 assert.equal(api.state.deleted, true);
});
