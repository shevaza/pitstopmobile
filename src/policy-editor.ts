import { isEmployeeType } from "./employee-types";
import type { Policy, PolicyAttachment } from "./policy-types";

export type PolicyEditor = {
    id?: string;
    version: string;
    expectedVersion?: number;
    title: string;
    body: string;
    attachment?: PolicyAttachment;
    target_roles: string[];
    target_employee_types: string[];
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
        target_roles: [...(policy?.target_roles ?? [])],
        target_employee_types: [...(policy?.target_employee_types ?? [])],
        target_departments: [...(policy?.target_departments ?? [])],
        target_users: [...(policy?.target_users ?? [])],
    };
}

export function policyEditorError(editor: PolicyEditor): string | null {
    if (editor.target_roles.some((role) => !role.trim() || role.length > 100 || /[\x00-\x1f\x7f]/.test(role))) return "Select valid roles.";
    if (editor.target_employee_types.some((type) => !isEmployeeType(type))) return "Select Employee, Project Based, or Intern.";
    const version = Number(editor.version);
    if (!/^\d+$/.test(editor.version) || !Number.isInteger(version) || version < 1 || version > 2147483647) {
        return "Enter a positive whole-number version (up to 2147483647).";
    }
    if (editor.expectedVersion !== undefined && version <= editor.expectedVersion) {
        return `Version must be greater than ${editor.expectedVersion}.`;
    }
    if (!editor.title.trim() || editor.title.trim().length > 200) return "Enter a title of 1 to 200 characters.";
    if (!editor.body.trim() || editor.body.trim().length > 100000) return "Enter policy text of 1 to 100000 characters.";
    if (editor.attachment) {
        const { name, size, data } = editor.attachment;
        if (!name.trim() || name.length > 255 || /[\x00-\x1f\x7f/\\]/.test(name)) return "Choose an attachment with a valid file name (up to 255 characters).";
        if (!Number.isInteger(size) || size <= 0 || size > 5 * 1024 * 1024) return "Choose a non-empty attachment up to 5 MB.";
        if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data) || data.length / 4 * 3 - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0) !== size) return "Unable to read attachment. Choose the file again.";
    }
    return null;
}

export function policyPublication(editor: PolicyEditor) {
    const error = policyEditorError(editor);
    if (error) throw new Error(error);
    return { ...editor, version: Number(editor.version), title: editor.title.trim(), body: editor.body.trim() };
}
