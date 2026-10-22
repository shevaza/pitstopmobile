import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ScrollView, Switch, Text, View } from "react-native";
import { useAuth } from "./auth";
import { useTheme } from "./ThemeProvider";
import { AppButton, AppInput, Badge, Card, Field, LoadingBlock, Screen, SectionTitle } from "./ui";
import { usePolicyNotifications } from "./PolicyNotifications";
import type { Policy, PolicyAcknowledgement, PolicyList, PolicyAudience } from "./policy-types";

import { createPolicyEditor, policyEditorError, policyPublication, type PolicyEditor } from "./policy-editor";

export function PoliciesScreen() {
    const scrollRef = useRef<ScrollView>(null);
    const { apiFetch, moduleAccessLevel } = useAuth();
    const { refresh } = usePolicyNotifications();
    const { theme } = useTheme();
    const text = { color: theme.colors.text };
    const [data, setData] = useState<PolicyList | null>(null);
    const [selected, setSelected] = useState<Policy | null>(null);
    const [editor, setEditor] = useState<PolicyEditor | null>(null);
    const [audience, setAudience] = useState<PolicyAudience | null>(null);
    const [recipientSearch, setRecipientSearch] = useState("");
    const [report, setReport] = useState<PolicyAcknowledgement[] | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [search, setSearch] = useState("");
    const [pendingOnly, setPendingOnly] = useState(false);
    const canModify = moduleAccessLevel.policies === "modify" && data?.canModify;
    const load = useCallback(async () => {
        const res = await apiFetch("/api/policies");
        if (!res.ok) throw new Error(await res.text());
        setData(await res.json());
        setSelected(null); setConfirmed(false); setReport(null);
    }, [apiFetch]);
    useFocusEffect(useCallback(() => { void load().catch((e) => setError(e.message)); }, [load]));

    async function perform(action: () => Promise<void>) {
        setBusy(true); setError(""); setNotice("");
        try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Request failed"); }
        finally { setBusy(false); }
    }
    async function openEditor(policy?: Policy) {
        const res = await apiFetch("/api/policies/audience");
        if (!res.ok) throw new Error(await res.text());
        setAudience(await res.json());
        setRecipientSearch("");
        setEditor(createPolicyEditor(policy));
        setSelected(null); setReport(null);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
    async function save() {
        if (!editor) return;
        const res = await apiFetch("/api/policies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(policyPublication(editor)) });
        if (!res.ok) throw new Error(await res.text());
        setEditor(null); setSelected(null); setReport(null);
        setNotice("Policy published. Recipients must acknowledge this version.");
        await load(); await refresh();
    }
    async function acknowledge() {
        if (!selected || !confirmed) return;
        const res = await apiFetch(`/api/policies/${selected.id}/acknowledge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: selected.version }) });
        if (!res.ok) throw new Error(await res.text());
        setSelected(null); setConfirmed(false); setNotice("Acknowledgement recorded.");
        await load(); await refresh();
    }
    const filtered = data?.policies.filter((p) => (!pendingOnly || (p.requires_acknowledgement !== false && !p.acknowledged_at)) && `${p.title} ${p.body}`.toLowerCase().includes(search.toLowerCase())) ?? [];
    return <Screen title="Policy portal" subtitle="Read and acknowledge company policies" scrollRef={scrollRef}>
        {!!error && <Card><Text accessibilityRole="alert" style={text}>{error}</Text><AppButton label="Refresh policies" disabled={busy} onPress={() => void perform(load)} /></Card>}
        {!!notice && <Card><Text style={text}>{notice}</Text></Card>}
        {!data && !error && <LoadingBlock label="Loading policies…" />}
        {data && <>
            <Card><SectionTitle>{data.pendingCount} policies require acknowledgement</SectionTitle><Text style={text}>New policies and updates stay pending until you acknowledge them.</Text></Card>
            <AppInput value={search} onChangeText={setSearch} placeholder="Search policies" />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Switch accessibilityLabel="Pending policies only" value={pendingOnly} onValueChange={setPendingOnly} /><Text style={text}>Pending only</Text></View>
            <AppButton label="Refresh" disabled={busy} onPress={() => void perform(load)} />
            {canModify && <AppButton label="New policy" disabled={busy} onPress={() => void perform(() => openEditor())} />}
            {editor && canModify && <Card>
                <SectionTitle>{editor.id ? "Publish an updated policy" : "New policy"}</SectionTitle>
                <Field label="Version"><AppInput value={editor.version} onChangeText={(version) => setEditor({ ...editor, version })} keyboardType="numeric" editable={!busy} /></Field>
                {editor.expectedVersion !== undefined && <Text style={text}>Current version: {editor.expectedVersion}. Enter a higher whole-number version.</Text>}
                <SectionTitle>Send to</SectionTitle>
                <Text style={text}>{!editor.target_departments.length && !editor.target_users.length ? "Everyone" : `${editor.target_departments.length} departments, ${editor.target_users.length} selected users`}</Text>
                <Text style={text}>Choose departments, users, or both. No selections sends to everyone. Department recipients are captured from Microsoft 365 when you publish.</Text>
                <AppButton label="Send to everyone (clear selections)" disabled={busy} onPress={() => setEditor({ ...editor, target_departments: [], target_users: [] })} />
                <Field label="Search departments and users"><AppInput value={recipientSearch} onChangeText={setRecipientSearch} placeholder="Name, email or department" editable={!busy} /></Field>
                <SectionTitle>Departments</SectionTitle>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                    {audience?.departments.filter((d) => d.toLowerCase().includes(recipientSearch.toLowerCase())).map((department) => <View key={department} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}>
                        <Switch accessibilityLabel={`Send to department ${department}`} disabled={busy} value={editor.target_departments.includes(department)} onValueChange={(checked) => setEditor({ ...editor, target_departments: checked ? [...editor.target_departments, department] : editor.target_departments.filter((d) => d !== department) })} />
                        <Text style={[text, { flex: 1 }]}>{department}</Text>
                    </View>)}
                    {!audience?.departments.some((d) => d.toLowerCase().includes(recipientSearch.toLowerCase())) && <Text style={text}>No matching departments.</Text>}
                </ScrollView>
                <SectionTitle>Individual users</SectionTitle>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
                    {audience?.users.filter((u) => `${u.name} ${u.upn} ${u.department}`.toLowerCase().includes(recipientSearch.toLowerCase())).map((user) => <View key={user.upn} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}>
                        <Switch accessibilityLabel={`Send to ${user.name} (${user.upn})`} disabled={busy} value={editor.target_users.includes(user.upn)} onValueChange={(checked) => setEditor({ ...editor, target_users: checked ? [...editor.target_users, user.upn] : editor.target_users.filter((upn) => upn !== user.upn) })} />
                        <Text style={[text, { flex: 1 }]}>{user.name}{"\n"}{user.upn}{user.department ? ` - ${user.department}` : ""}</Text>
                    </View>)}
                    {!audience?.users.some((u) => `${u.name} ${u.upn} ${u.department}`.toLowerCase().includes(recipientSearch.toLowerCase())) && <Text style={text}>No matching users.</Text>}
                </ScrollView>
                <Field label="Title"><AppInput value={editor.title} onChangeText={(title) => setEditor({ ...editor, title })} editable={!busy} /></Field>
                <Field label="Policy text"><AppInput value={editor.body} onChangeText={(body) => setEditor({ ...editor, body })} multiline editable={!busy} style={{ minHeight: 240 }} /></Field>
                <Text style={text}>Publishing makes this version available immediately and requires the recipients to acknowledge it.</Text>
                {!!policyEditorError(editor) && <Text style={text}>{policyEditorError(editor)}</Text>}
                <AppButton label={busy ? "Publishing…" : "Publish policy"} variant="primary" disabled={busy || !!policyEditorError(editor)} onPress={() => void perform(save)} />
                <AppButton label="Cancel" disabled={busy} onPress={() => setEditor(null)} />
            </Card>}
            {selected && <Card>
                <SectionTitle>{selected.title}</SectionTitle><Text style={text}>Version {selected.version} · {new Date(selected.updated_at).toLocaleString()}</Text>
                <Text style={text}>Published by {selected.updated_by_upn}</Text>
                <Text selectable style={[text, { lineHeight: 25, marginVertical: 16 }]}>{selected.body}</Text>
                {canModify && <Text style={text}>Audience: {selected.recipient_upns == null ? "Everyone" : [...(selected.target_departments ?? []), ...(selected.target_users ?? [])].join(", ") + ` (${selected.recipient_upns.length} recipients)`}</Text>}
                {selected.requires_acknowledgement === false ? <Text style={text}>This policy is assigned to other recipients.</Text> : selected.acknowledged_at ? <Text style={text}>Acknowledged {new Date(selected.acknowledged_at).toLocaleString()}</Text> : <>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Switch accessibilityLabel="I have read this policy" value={confirmed} onValueChange={setConfirmed} /><Text style={[text, { flex: 1 }]}>I confirm that I have read version {selected.version} of this policy.</Text></View>
                    <AppButton label="Acknowledge policy" variant="primary" disabled={busy || !confirmed} onPress={() => void perform(acknowledge)} />
                </>}
                {canModify && <>
                    <AppButton label="Edit policy" disabled={busy} onPress={() => void perform(() => openEditor(selected))} />
                    <AppButton label="View acknowledgements" disabled={busy} onPress={() => void perform(async () => {
                        const res = await apiFetch(`/api/policies/${selected.id}/acknowledgements`);
                        if (!res.ok) throw new Error(await res.text());
                        setReport((await res.json()).acknowledgements);
                    })} />
                </>}
                {report && <><SectionTitle>Acknowledgement history ({report.length})</SectionTitle>{report.map((row) => <Text key={`${row.user_upn}:${row.version}`} style={[text, { marginVertical: 8 }]}>{row.user_upn} · v{row.version}{"\n"}{new Date(row.acknowledged_at).toLocaleString()}</Text>)}{!report.length && <Text style={text}>No acknowledgements yet.</Text>}</>}
                <AppButton label="Close policy" disabled={busy} onPress={() => { setSelected(null); setReport(null); }} />
            </Card>}
            {filtered.map((policy) => <Card key={policy.id}>
                <Badge label={policy.requires_acknowledgement === false ? "Assigned to other recipients" : policy.acknowledged_at ? "Acknowledged" : policy.version === 1 ? "New · Acknowledgement required" : "Updated · Acknowledgement required"} tone={policy.requires_acknowledgement === false ? "info" : policy.acknowledged_at ? "success" : "warning"} />
                <SectionTitle>{policy.title}</SectionTitle><Text style={text}>Version {policy.version} · {new Date(policy.updated_at).toLocaleDateString()}</Text>
                <Text style={text} numberOfLines={2}>{policy.body}</Text>
                <AppButton label="Read policy" disabled={busy} onPress={() => { setSelected(policy); setConfirmed(false); setReport(null); setEditor(null); scrollRef.current?.scrollTo({ y: 0, animated: true }); }} />
            </Card>)}
            {!filtered.length && <Card><Text style={text}>{data.policies.length ? "No matching policies." : "No policies published yet."}</Text></Card>}
        </>}
    </Screen>;
}

