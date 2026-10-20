import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { AppState } from "react-native";
import { useAuth } from "./auth";

const Context = createContext({ count: 0, refresh: async () => {} });
export function PolicyNotificationProvider({ children }: PropsWithChildren) {
    const { apiFetch, moduleAccess, session } = useAuth();
    const [count, setCount] = useState(0);
    const refresh = useCallback(async () => {
        if (!session || !moduleAccess.policies) { setCount(0); return; }
        try {
            const response = await apiFetch("/api/policies");
            if (response.ok) setCount((await response.json()).pendingCount);
            else if (response.status === 403) setCount(0);
        } catch { /* Retry on resume or next poll. */ }
    }, [apiFetch, moduleAccess.policies, session]);
    useEffect(() => {
        void refresh();
        const timer = setInterval(() => { if (AppState.currentState === "active") void refresh(); }, 60000);
        const listener = AppState.addEventListener("change", (state) => { if (state === "active") void refresh(); });
        return () => { clearInterval(timer); listener.remove(); };
    }, [refresh]);
    return <Context.Provider value={{ count, refresh }}>{children}</Context.Provider>;
}
export function usePolicyNotifications() { return useContext(Context); }
