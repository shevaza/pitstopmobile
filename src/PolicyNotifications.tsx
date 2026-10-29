import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type PropsWithChildren } from "react";
import { AppState, Modal, Text } from "react-native";
import { useAuth } from "./auth";
import { useTheme } from "./ThemeProvider";
import { AppButton, Card, Screen } from "./ui";
import type { Policy } from "./policy-types";

const Context = createContext({ count: 0, refresh: async () => {} });
export function PolicyNotificationProvider({ children, review }: PropsWithChildren<{ review: ReactNode }>) {
    const { apiFetch, session } = useAuth();
    const { theme } = useTheme();
    const api = useRef(apiFetch); api.current = apiFetch;
    const token = session?.idToken ?? "";
    const currentToken = useRef(token); currentToken.current = token;
    const [checkedToken, setCheckedToken] = useState("");
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [error, setError] = useState("");
    const [reviewToken, setReviewToken] = useState("");
    const refresh = useCallback(async () => {
        if (!token) { setCheckedToken(""); setReviewToken(""); setPolicies([]); setError(""); return; }
        try {
            const response = await api.current("/api/policies/required");
            if (!response.ok) throw new Error(await response.text());
            const result = await response.json();
            if (currentToken.current !== token) return;
            if (!result.policies.length) setReviewToken("");
            setPolicies(result.policies); setCheckedToken(token); setError("");
        } catch (e) { if (currentToken.current === token) setError(e instanceof Error ? e.message : "Unable to check required policies."); }
    }, [token]);
    useEffect(() => {
        void refresh();
        const timer = setInterval(() => { if (AppState.currentState === "active") void refresh(); }, 60000);
        const listener = AppState.addEventListener("change", (state) => { if (state === "active") void refresh(); });
        return () => { clearInterval(timer); listener.remove(); };
    }, [refresh]);
    const blocked = !!token && (checkedToken !== token || !!error || policies.length > 0);
    const reviewing = !!token && reviewToken === token && checkedToken === token;
    return <Context.Provider value={{ count: token ? policies.length : 0, refresh }}>
        {blocked ? reviewing ? review : null : children}
        <Modal visible={blocked && !reviewing} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => {}}>
            <Screen title="Policy acknowledgement required" subtitle="Read and acknowledge all pending policies to continue." includeTopInset>
                {!!error && <Card><Text accessibilityRole="alert" style={{ color: theme.colors.text }}>{error}</Text></Card>}
                {checkedToken === token && policies.length > 0 && <Card>
                    <Text style={{ color: theme.colors.text }}>You have {policies.length} pending {policies.length === 1 ? "policy" : "policies"} to acknowledge.</Text>
                    <AppButton label="Go to Policies" variant="primary" onPress={() => setReviewToken(token)} />
                </Card>}
                {(checkedToken !== token || error) && <AppButton label={error ? "Retry" : "Checking required policies..."} onPress={() => void refresh()} />}
            </Screen>
        </Modal>
    </Context.Provider>;
}
export function usePolicyNotifications() { return useContext(Context); }
