import { Children, isValidElement } from "react";
import { ActionSheetIOS, Platform, Pressable, StyleSheet, Text } from "react-native";
import { Picker, type PickerItemProps, type PickerProps } from "@react-native-picker/picker";
import { useTheme } from "./ThemeProvider";
import { darkTheme, lightTheme, type AppTheme } from "./theme";

export function AppSelect<T extends string>(props: PickerProps<T>) {
  const { theme } = useTheme();
  const styles = themedStyles[theme.mode];

  if (Platform.OS !== "ios") return <Picker {...props} />;

  const options = Children.toArray(props.children).flatMap((child) =>
    isValidElement<PickerItemProps<T>>(child) && child.props.value !== undefined
      ? [child.props]
      : [],
  );
  const selected = options.find((option) => option.value === props.selectedValue);
  const disabled = props.enabled === false || options.length === 0;
  const label = props.accessibilityLabel || props.prompt || "Select option";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${selected?.label || "Select option"}`}
      accessibilityState={{ disabled }}
      testID={props.testID}
      disabled={disabled}
      style={[props.style, styles.input, disabled && { opacity: 0.5 }]}
      onPress={() => ActionSheetIOS.showActionSheetWithOptions({
        title: label,
        options: ["Cancel", ...options.map((option) => option.label || String(option.value))],
        cancelButtonIndex: 0,
        disabledButtonIndices: options.flatMap((option, index) => option.enabled === false ? [index + 1] : []),
        userInterfaceStyle: theme.mode,
      }, (index) => {
        const option = options[index - 1];
        if (index > 0 && option?.value !== undefined && option.enabled !== false) props.onValueChange?.(option.value, index - 1);
      })}
    >
      <Text style={styles.label}>{selected?.label || "Select option"}</Text>
      <Text style={{ color: theme.colors.muted }}>{"\u25be"}</Text>
    </Pressable>
  );
}

AppSelect.Item = Picker.Item;

const createStyles = (theme: AppTheme) => StyleSheet.create({
  input: { height: undefined, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, backgroundColor: theme.colors.glass, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  label: { color: theme.colors.text, flex: 1, fontSize: 16 },
});

const themedStyles = { dark: createStyles(darkTheme), light: createStyles(lightTheme) };
