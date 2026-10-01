import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Alert, Appearance } from "react-native";
import { darkTheme, lightTheme, type AppTheme } from "./theme";

type ThemeMode = "dark" | "light";
const storageKey = "pitstop-mobile-theme";
const ThemeContext = createContext<{ theme: AppTheme; setMode: (mode: ThemeMode) => void } | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [ready, setReady] = useState(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    if (ready) Appearance.setColorScheme(mode);
  }, [mode, ready]);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then((saved) => {
      if (active && (saved === "light" || saved === "dark")) setModeState(saved);
    }).catch(() => {}).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({
    theme: mode === "light" ? lightTheme : darkTheme,
    setMode: (next: ThemeMode) => {
      setModeState(next);
      writes.current = writes.current.then(() => AsyncStorage.setItem(storageKey, next)).catch(() => {
        Alert.alert("Appearance", "Your theme changed, but could not be saved for next time.");
      });
    },
  }), [mode]);
  return <ThemeContext.Provider value={value}>{ready ? children : null}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}
