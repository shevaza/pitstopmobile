import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { PoliciesScreen } from "./PoliciesScreen";
import { useTheme } from "./ThemeProvider";
import { getNavigationTheme } from "./theme";

const Stack = createNativeStackNavigator();
export function RequiredPolicyReview() {
    const { theme } = useTheme();
    return <NavigationContainer theme={getNavigationTheme(theme)}>
        <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: theme.colors.header }, headerTintColor: theme.colors.text }}>
            <Stack.Screen name="Policies" component={PoliciesScreen} options={{ title: "Policies", headerBackVisible: false }} />
        </Stack.Navigator>
    </NavigationContainer>;
}
