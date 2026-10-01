export const darkTheme = {
  mode: "dark" as "dark" | "light",
  gradient: ["#121933", "#1A2547", "#10182F"] as [string, string, string],
  colors: {
    primary: "#0E03DB",
    primarySurface: "rgba(14,3,219,0.28)",
    placeholder: "rgba(255,255,255,0.45)",
    surface: "#141B30",
    header: "#18203A",
    drawer: "#11182D",
    avatar: "#243152",
    background: "#0C1020",
    foreground: "#E8EBFF",
    text: "#FFFFFF",
    glass: "rgba(255,255,255,0.11)",
    glassStrong: "rgba(255,255,255,0.16)",
    border: "rgba(255,255,255,0.2)",
    danger: "rgba(255,99,132,0.22)",
    success: "rgba(52,211,153,0.22)",
    warning: "rgba(251,191,36,0.22)",
    info: "rgba(96,165,250,0.22)",
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
    lg: 24,
    pill: 999,
  },
  shadow: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.28,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
  },
};

export type AppTheme = typeof darkTheme;

export const lightTheme: AppTheme = {
  ...darkTheme,
  mode: "light",
  gradient: ["#F4F6FF", "#EAF0FF", "#F8FAFF"],
  colors: {
    ...darkTheme.colors,
    background: "#F4F6FF",
    foreground: "#18223D",
    text: "#18223D",
    muted: "#526079",
    placeholder: "#64748B",
    glass: "rgba(255,255,255,0.88)",
    glassStrong: "#FFFFFF",
    border: "#CAD3E3",
    surface: "#FFFFFF",
    header: "#FFFFFF",
    drawer: "#F8FAFF",
    avatar: "#E0E7FF",
    primarySurface: "#E0E3FF",
    danger: "#FFE4E8",
    success: "#DCFCE7",
    warning: "#FEF3C7",
    info: "#DBEAFE",
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
