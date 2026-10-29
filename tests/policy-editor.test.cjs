const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const { outputText } = ts.transpileModule(readFileSync(require.resolve('../src/policy-editor.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const result = {};
runInNewContext(outputText, { exports: result, Error, require: () => ({ isEmployeeType: (value) => ['Employee', 'Project Based', 'Intern'].includes(value) }) });
const { createPolicyEditor, policyPublication, policyEditorError } = result;
const valid = () => ({ ...createPolicyEditor(), title: ' Title ', body: ' Body ' });
test('new policies send a numeric manual version and default to everyone', () => {
 const payload = policyPublication({ ...valid(), version: '12' });
 assert.equal(payload.version, 12); assert.equal(payload.expectedVersion, undefined);
 assert.equal(payload.title, 'Title'); assert.equal(payload.body, 'Body');
 assert.equal(payload.target_departments.length, 0); assert.equal(payload.target_users.length, 0);
});
test('edits preserve audience and send the original version separately', () => {
 const policy = { id: 'policy-id', version: 7, title: 'Title', body: 'Body', target_departments: ['IT'], target_users: ['hr@example.com'] };
 const editor = createPolicyEditor(policy); assert.equal(editor.version, '8');
 editor.version = '15'; const payload = policyPublication(editor);
 assert.equal(payload.id, policy.id); assert.equal(payload.version, 15); assert.equal(payload.expectedVersion, 7);
 assert.equal(payload.target_departments[0], 'IT'); assert.equal(payload.target_users[0], 'hr@example.com');
 editor.target_departments.push('Finance'); assert.equal(policy.target_departments.length, 1);
});
test('invalid and non-increasing versions are rejected before publication', () => {
 for (const version of ['', ' ', '0', '-1', '1.5', '1e2', 'abc', '2147483648']) assert.throws(() => policyPublication({ ...valid(), version }), /whole-number/);
 for (const version of ['6', '7']) assert.throws(() => policyPublication({ ...valid(), expectedVersion: 7, version }), /greater than 7/);
 assert.equal(policyEditorError({ ...valid(), version: '2147483647' }), null);
});
test('empty and oversized content is blocked', () => {
 for (const fields of [{ title: ' ' }, { title: 'x'.repeat(201) }, { body: ' ' }, { body: 'x'.repeat(100001) }]) assert.throws(() => policyPublication({ ...valid(), ...fields }));
});


test('attachments are published with the same payload used by the web API', () => {
 const attachment = { name: 'policy.pdf', size: 3, data: 'YWJj' };
 assert.equal(policyPublication({ ...valid(), attachment }).attachment, attachment);
 assert.equal(policyPublication(valid()).attachment, undefined);
 for (const invalid of [
  { ...attachment, size: 0 }, { ...attachment, size: 5242881 },
  { ...attachment, size: 4 }, { ...attachment, data: '!!!!' },
  { ...attachment, name: '../policy.pdf' }, { ...attachment, name: 'x'.repeat(256) },
 ]) assert.throws(() => policyPublication({ ...valid(), attachment: invalid }));
});


test('employee type targeting survives edits and validates allowed options', () => {
 const editor = createPolicyEditor({ version: 1, title: 'Title', body: 'Body', target_employee_types: ['Intern'] });
 assert.equal(editor.target_employee_types[0], 'Intern');
 assert.equal(policyPublication(editor).target_employee_types[0], 'Intern');
 assert.equal(createPolicyEditor().target_employee_types.length, 0);
 assert.throws(() => policyPublication({ ...valid(), target_employee_types: ['Contractor'] }), /Employee, Project Based, or Intern/);
});


test('role targeting survives edits and rejects invalid role names', () => {
 const editor = createPolicyEditor({ version: 2, title: 'Title', body: 'Body', target_roles: ['Engineer'] });
 assert.equal(policyPublication(editor).target_roles[0], 'Engineer');
 assert.equal(createPolicyEditor().target_roles.length, 0);
 assert.throws(() => policyPublication({ ...valid(), target_roles: [''] }), /valid roles/);
});


test('mobile attachment edits support removal or replacement but not both', () => {
 const editor = { ...valid(), id: 'id', version: '2', expectedVersion: 1, remove_attachment: true };
 assert.equal(policyPublication(editor).remove_attachment, true);
 const attachment = { name: 'replacement.pdf', size: 3, data: 'YWJj' };
 assert.throws(() => policyPublication({ ...editor, attachment }), /replacement or removal/);
 assert.equal(policyPublication({ ...editor, attachment, remove_attachment: false }).attachment, attachment);
});
