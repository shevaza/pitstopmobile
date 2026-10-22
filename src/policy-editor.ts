import type { Policy } from "./policy-types";

export type PolicyEditor = {
    id?: string;
    version: string;
    expectedVersion?: number;
    title: string;
    body: string;
    target_departments: string[];
    target_users: string[];
};

export function createPolicyEditor(policy?: Policy): PolicyEditor {
    return {
        id: policy?.id,
        version: String(policy ? policy.version + 1 : 1),
        expectedVersion: policy?.version,
        title: policy?.title ?? "",
        body: policy?.body ?? "",
        target_departments: [...(policy?.target_departments ?? [])],
        target_users: [...(policy?.target_users ?? [])],
    };
}

export function policyEditorError(editor: PolicyEditor): string | null {
    const version = Number(editor.version);
    if (!/^\d+$/.test(editor.version) || !Number.isInteger(version) || version < 1 || version > 2147483647) {
        return "Enter a positive whole-number version (up to 2147483647).";
    }
    if (editor.expectedVersion !== undefined && version <= editor.expectedVersion) {
        return `Version must be greater than ${editor.expectedVersion}.`;
    }
    if (!editor.title.trim() || editor.title.trim().length > 200) return "Enter a title of 1 to 200 characters.";
    if (!editor.body.trim() || editor.body.trim().length > 100000) return "Enter policy text of 1 to 100000 characters.";
    return null;
}

export function policyPublication(editor: PolicyEditor) {
    const error = policyEditorError(editor);
    if (error) throw new Error(error);
    return { ...editor, version: Number(editor.version), title: editor.title.trim(), body: editor.body.trim() };
}
