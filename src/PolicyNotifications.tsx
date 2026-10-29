import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { AppState, Modal, Switch, Text, View } from "react-native";
import { useAuth } from "./auth";
import { useTheme } from "./ThemeProvider";
import { AppButton, Card, Screen, SectionTitle } from "./ui";
import { downloadPolicyAttachment } from "./policy-attachments";
import type { Policy } from "./policy-types";

const Context = createContext({ count: 0, refresh: async () => {} });
export function PolicyNotificationProvider({ children }: PropsWithChildren) {
    const { apiFetch, session } = useAuth();
    const { theme } = useTheme();
    const api = useRef(apiFetch); api.current = apiFetch;
    const token = session?.idToken ?? "";
    const currentToken = useRef(token); currentToken.current = token;
    const [checkedToken, setCheckedToken] = useState("");
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [error, setError] = useState("");
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const refresh = useCallback(async () => {
        if (!token) { setCheckedToken(""); setPolicies([]); setError(""); return; }
        try {
            const response = await api.current("/api/policies/required");
            if (!response.ok) throw new Error(await response.text());
            const result = await response.json();
            if (currentToken.current !== token) return;
            setPolicies(result.policies); setCheckedToken(token); setError("");
        } catch (e) { if (currentToken.current === token) setError(e instanceof Error ? e.message : "Unable to check required policies."); }
    }, [token]);
    useEffect(() => {
        void refresh();
        const timer = setInterval(() => { if (AppState.currentState === "active") void refresh(); }, 60000);
        const listener = AppState.addEventListener("change", (state) => { if (state === "active") void refresh(); });
        return () => { clearInterval(timer); listener.remove(); };
    }, [refresh]);
    const policy = checkedToken === token ? policies[0] : undefined;
    useEffect(() => { setConfirmed(false); }, [policy?.id, policy?.version]);
    const blocked = !!token && (checkedToken !== token || !!error || policies.length > 0 || busy);
    async function perform(action: () => Promise<void>) {
        setBusy(true); setError("");
        try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Request failed"); }
        finally { setBusy(false); }
    }
    return <Context.Provider value={{ count: token ? policies.length : 0, refresh }}>
        {!blocked && children}
        <Modal visible={blocked} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => {}}>
            <Screen title="Policy acknowledgement required" subtitle="Read and acknowledge all pending policies to continue." includeTopInset>
                {!!error && <Card><Text accessibilityRole="alert" style={{ color: theme.colors.text }}>{error}</Text></Card>}
                {policy && <Card>
                    <Text style={{ color: theme.colors.text }}>{policies.length} remaining</Text>
                    <SectionTitle>{policy.title} / Version {policy.version}</SectionTitle>
                    <Text selectable style={{ color: theme.colors.text, lineHeight: 25 }}>{policy.body}</Text>
                    {!!policy.attachment_name && <AppButton label={`Download: ${policy.attachment_name}`} disabled={busy} onPress={() => void perform(() => downloadPolicyAttachment(api.current, policy, true))} />}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <Switch accessibilityLabel="I have read this policy" disabled={busy} value={confirmed} onValueChange={setConfirmed} />
                        <Text style={{ color: theme.colors.text, flex: 1 }}>I have read this policy, version {policy.version}.</Text>
                    </View>
                    <AppButton label={busy ? "Saving..." : "Acknowledge and continue"} variant="primary" disabled={busy || !confirmed} onPress={() => void perform(async () => {
                        const response = await api.current(`/api/policies/required/${policy.id}/acknowledge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: policy.version }) });
                        if (!response.ok) { const message = await response.text(); if (response.status === 409) await refresh(); throw new Error(message); }
                        setConfirmed(false); await refresh();
                    })} />
                </Card>}
                {(!policy || error) && <AppButton label={error ? "Retry" : "Checking required policies..."} disabled={busy} onPress={() => void perform(refresh)} />}
            </Screen>
        </Modal>
    </Context.Provider>;
}
export function usePolicyNotifications() { return useContext(Context); }
