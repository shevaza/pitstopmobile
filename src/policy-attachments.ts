import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { PolicyAttachment } from "./policy-types";

export async function pickPolicyAttachment(): Promise<PolicyAttachment | null> {
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: false, copyToCacheDirectory: true });
    if (result.canceled) return null;
    const asset = result.assets[0];
    const file = new File(asset.uri);
    const size = file.size;
    if (!size || size > 5 * 1024 * 1024) throw new Error("Choose a non-empty attachment up to 5 MB.");
    if (!asset.name.trim() || asset.name.length > 255 || /[\x00-\x1f\x7f/\\]/.test(asset.name)) throw new Error("Choose an attachment with a valid file name (up to 255 characters).");
    return { name: asset.name, size, data: await file.base64() };
}

export async function downloadPolicyAttachment(
    apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
    policy: { id: string; attachment_name?: string | null },
    required = false,
) {
    if (!policy.attachment_name) throw new Error("This policy has no attachment.");
    if (!await Sharing.isAvailableAsync()) throw new Error("Saving and sharing files is unavailable on this device.");
    const response = await apiFetch(`/api/policies/${required ? "required/" : ""}${encodeURIComponent(policy.id)}/attachment`, { headers: { Accept: "application/octet-stream" } });
    if (!response.ok) throw new Error(await response.text());
    const directory = new Directory(Paths.cache, "policy-attachments", `${Date.now()}`);
    directory.create({ intermediates: true });
    try {
        // Keep the extension for the system's save/share sheet; never treat a name as a path.
        const name = policy.attachment_name.replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g, "_").replace(/^\.+/, "_");
        const file = new File(directory, name);
        file.write(new Uint8Array(await response.arrayBuffer()));
        await Sharing.shareAsync(file.uri, { dialogTitle: "Save or share policy attachment" });
    } finally {
        directory.delete();
    }
}
