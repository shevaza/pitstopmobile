import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "./ui";
import { useTheme } from "./ThemeProvider";
import { darkTheme, lightTheme, type AppTheme } from "./theme";

function parseDate(value: string) {
  if (!value) return new Date();
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function AppDateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const { theme } = useTheme();
  const styles = themedStyles[theme.mode];

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  const close = () => setOpen(false);
  return (
    <>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value || "Choose date"}`} style={styles.input} onPress={() => { setDraft(parseDate(value)); setOpen(true); }}>
          <Text style={{ color: value ? theme.colors.text : theme.colors.muted }}>{value || "Choose date"}</Text>
          <Text style={{ color: theme.colors.muted }}>▾</Text>
        </Pressable>
        {value ? <AppButton label="Clear" onPress={() => onChange("")} /> : null}
      </View>
      {open && Platform.OS === "android" ? (
        <DateTimePicker value={draft} mode="date" onChange={(event, date) => { close(); if (event.type === "set" && date) onChange(dateValue(date)); }} />
      ) : null}
      <Modal visible={open && Platform.OS !== "android"} transparent animationType="slide" onRequestClose={close}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cancel date selection" onPress={close} />
          <SafeAreaView edges={["bottom"]} style={styles.sheet}>
            <Text style={styles.title}>{label}</Text>
            <DateTimePicker value={draft} mode="date" display="spinner" themeVariant={theme.mode} textColor={theme.colors.text} onChange={(_, date) => { if (date) setDraft(date); }} />
            <View style={styles.row}>
              <AppButton label="Cancel" onPress={close} style={{ flex: 1 }} />
              <AppButton label="Done" variant="primary" onPress={() => { onChange(dateValue(draft)); close(); }} style={{ flex: 1 }} />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: { flex: 1, minHeight: 48, paddingHorizontal: 14, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.glass, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: "600" },
});

const themedStyles = { dark: createStyles(darkTheme), light: createStyles(lightTheme) };
