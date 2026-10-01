import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./auth";
import { AppNavigator } from "./navigation";
import { ThemeProvider, useTheme } from "./ThemeProvider";

function ThemedApp() {
  const { theme } = useTheme();
  return (
    <AuthProvider>
      <StatusBar style={theme.mode === "light" ? "dark" : "light"} />
      <AppNavigator />
    </AuthProvider>
  );
}

export default function AppRoot() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
