export const darkTheme = {
  mode: "dark" as "dark" | "light",
  gradient: ["#0B1220", "#102344", "#0B1220"] as [string, string, string],
  colors: {
    primary: "#1266F1",
    primarySurface: "rgba(18,102,241,0.28)",
    placeholder: "rgba(255,255,255,0.45)",
    surface: "#151F30",
    header: "#151F30",
    drawer: "#111B2C",
    avatar: "rgba(18,102,241,0.24)",
    background: "#0B1220",
    foreground: "#E8EEF8",
    text: "#E8EEF8",
    glass: "#151F30",
    glassStrong: "#1B2940",
    border: "rgba(255,255,255,0.2)",
    danger: "rgba(244,63,94,0.18)",
    success: "rgba(20,184,166,0.18)",
    warning: "rgba(245,158,11,0.18)",
    info: "rgba(18,102,241,0.18)",
    muted: "rgba(255,255,255,0.72)",
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 14,
    pill: 999,
  },
  shadow: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 10,
    },
  },
};

export type AppTheme = typeof darkTheme;

export const lightTheme: AppTheme = {
  ...darkTheme,
  mode: "light",
  gradient: ["#EEF2F8", "#E8F0FF", "#F5F7FB"],
  colors: {
    ...darkTheme.colors,
    background: "#EEF2F8",
    foreground: "#172338",
    text: "#172338",
    muted: "rgba(0,0,0,0.72)",
    placeholder: "rgba(0,0,0,0.5)",
    glass: "#FFFFFF",
    glassStrong: "#F5F7FB",
    border: "rgba(0,0,0,0.16)",
    surface: "#FFFFFF",
    header: "#FFFFFF",
    drawer: "#FFFFFF",
    avatar: "rgba(18,102,241,0.12)",
    primarySurface: "rgba(18,102,241,0.12)",
    danger: "rgba(244,63,94,0.18)",
    success: "rgba(20,184,166,0.18)",
    warning: "rgba(245,158,11,0.18)",
    info: "rgba(18,102,241,0.18)",
  },
  shadow: { card: { ...darkTheme.shadow.card, shadowOpacity: 0.08, elevation: 3 } },
};

export function getNavigationTheme(theme: AppTheme) {
  return {
    dark: theme.mode === "dark",
    colors: {
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.primary,
    },
    fonts: {
      regular: { fontFamily: "System", fontWeight: "400" as const },
      medium: { fontFamily: "System", fontWeight: "500" as const },
      bold: { fontFamily: "System", fontWeight: "700" as const },
      heavy: { fontFamily: "System", fontWeight: "800" as const },
    },
  };
}
