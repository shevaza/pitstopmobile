import "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { createDrawerNavigator, DrawerContentScrollView } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { ComponentType } from "react";
import { Image, Pressable, Switch, Text, View } from "react-native";
import { LoadingBlock } from "./ui";
import { useAuth } from "./auth";
import {
  AssetDetailScreen,
  AssetsScreen,
  AttendanceScreen,
  BulkScreen,
  CrossCheckScreen,
  DashboardScreen,
  HrScreen,
  ItTicketsAdminScreen,
  ItTicketsScreen,
  LoginScreen,
  OrgChartScreen,
  RootStackParamList,
  SettingsScreen,
  UserAccessScreen,
  UserDetailScreen,
  UsersScreen,
} from "./screens";
import { useTheme } from "./ThemeProvider";
import { getNavigationTheme } from "./theme";
import { AppModuleKey } from "./types";
import { PoliciesScreen } from "./PoliciesScreen";
import { usePolicyNotifications } from "./PolicyNotifications";

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const screenRegistry: Array<{
  key: AppModuleKey;
  name: string;
  title: string;
  component: ComponentType<any>;
}> = [
    { key: "dashboard", name: "Dashboard", title: "Dashboard", component: DashboardScreen },
    { key: "users", name: "Users", title: "Users", component: UsersScreen },
    { key: "bulk", name: "Bulk", title: "Bulk", component: BulkScreen },
    { key: "orgchart", name: "Org Chart", title: "Org Chart", component: OrgChartScreen },
    { key: "hr", name: "HR", title: "HR", component: HrScreen },
    { key: "policies", name: "Policies", title: "Policies", component: PoliciesScreen },
    { key: "attendance", name: "Attendance", title: "Attendance", component: AttendanceScreen },
    { key: "attendance", name: "Data Cross Check", title: "Data Cross Check", component: CrossCheckScreen },
    { key: "assets", name: "Assets", title: "Assets", component: AssetsScreen },
    { key: "it-tickets", name: "IT Tickets", title: "IT Tickets", component: ItTicketsScreen },
    { key: "it-tickets-admin", name: "IT Tickets Admin", title: "IT Tickets Admin", component: ItTicketsAdminScreen },
    { key: "user-access", name: "User Access", title: "User Access", component: UserAccessScreen },
    { key: "settings", name: "Settings", title: "Settings", component: SettingsScreen },
  ];

const navigationGroups = [
  { label: "Overview", routes: ["Dashboard"] },
  { label: "People & Directory", routes: ["Users", "Bulk", "Org Chart"] },
  { label: "Human Resources", routes: ["HR", "Attendance", "Data Cross Check", "Policies"] },
  { label: "IT & Operations", routes: ["Assets", "IT Tickets", "IT Tickets Admin"] },
  { label: "Administration", routes: ["User Access", "Settings"] },
];

function getInitials(value?: string) {
  if (!value) return "?";
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function NoAccessScreen() {
  const { theme } = useTheme();

  const { signOut } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: "700", textAlign: "center" }}>No modules available</Text>
      <Text style={{ color: theme.colors.muted, marginTop: 12, textAlign: "center" }}>
        Your account signed in successfully, but no mobile modules are enabled for it.
      </Text>
      <Text style={{ color: theme.colors.text, marginTop: 24, fontSize: 16 }} onPress={() => void signOut()}>
        Sign out
      </Text>
    </View>
  );
}

function AccessErrorScreen({ message }: { message: string }) {
  const { theme } = useTheme();

  const { reloadAccess, signOut } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: "700", textAlign: "center" }}>Cannot reach the backend</Text>
      <Text style={{ color: theme.colors.muted, marginTop: 12, textAlign: "center" }}>
        The mobile app signed in, but the API request for module access failed.
      </Text>
      <Text style={{ color: theme.colors.muted, marginTop: 12, textAlign: "center" }}>{message}</Text>
      <Text style={{ color: theme.colors.text, marginTop: 24, fontSize: 16 }} onPress={() => void reloadAccess()}>
        Retry
      </Text>
      <Text style={{ color: theme.colors.text, marginTop: 16, fontSize: 16 }} onPress={() => void signOut()}>
        Sign out
      </Text>
    </View>
  );
}

function DrawerNavigator() {
  const { theme, setMode } = useTheme();
  const { count } = usePolicyNotifications();

  const { moduleAccess, session, signOut } = useAuth();
  const enabledScreens = screenRegistry.filter((screen) => moduleAccess[screen.key]);
  const displayName = session?.name || session?.upn;
  const photoSource = session?.accessToken
    ? {
      uri: "https://graph.microsoft.com/v1.0/me/photo/$value",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    }
    : null;

  return (
    <Drawer.Navigator
      screenOptions={({ navigation }) => ({
        headerRight: () => moduleAccess.policies ? <Text accessibilityRole="button" accessibilityLabel={`${count} policies require acknowledgement`} style={{ color: theme.colors.text, marginRight: 16 }} onPress={() => navigation.navigate("Policies")}>Policies{count > 0 ? ` (${count} pending)` : ""}</Text> : null,
        headerStyle: { backgroundColor: theme.colors.header },
        headerTintColor: theme.colors.text,
        drawerStyle: { backgroundColor: theme.colors.drawer },
        drawerActiveTintColor: theme.colors.text,
        drawerInactiveTintColor: theme.colors.muted,
      })}
      drawerContent={(props) => (
        <DrawerContentScrollView
          style={{ backgroundColor: theme.colors.drawer }}
          contentContainerStyle={{ flexGrow: 1, paddingStart: 16, paddingEnd: 16, gap: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: "700" }}>PitStop 2.0</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {photoSource ? (
              <Image
                source={photoSource}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.glass }}
              />
            ) : (
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.colors.avatar,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: "700" }}>{getInitials(displayName)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "600" }} numberOfLines={1}>{displayName}</Text>
              {session?.email && session.email !== displayName ? (
                <Text style={{ color: theme.colors.muted, marginTop: 2 }} numberOfLines={1}>{session.email}</Text>
              ) : null}
            </View>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border }} />
          {navigationGroups.map((group) => {
            const routes = group.routes.filter((name) => props.state.routeNames.includes(name));
            if (routes.length === 0) return null;
            const ticketRoutes = routes.filter((name) => name.startsWith("IT Tickets"));
            return (
              <View key={group.label} accessibilityLabel={group.label} style={{ gap: 4 }}>
                <Text accessibilityRole="header" style={{ color: theme.colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", paddingHorizontal: 12, marginBottom: 4 }}>{group.label}</Text>
                {routes.map((routeName) => {
                  const focused = props.state.routes[props.state.index]?.name === routeName;
                  const nested = routeName === "Data Cross Check" || ticketRoutes.includes(routeName);
                  const label = routeName === "HR" ? "HR Overview" : routeName === "IT Tickets" ? "My Tickets" : routeName === "IT Tickets Admin" ? "Admin Queue" : routeName;
                  return (
                    <View key={routeName}>
                      {routeName === ticketRoutes[0] && <Text style={{ color: theme.colors.muted, fontSize: 12, fontWeight: "600", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>IT Tickets</Text>}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={label}
                        accessibilityState={{ selected: focused }}
                        onPress={() => { props.navigation.navigate(routeName); props.navigation.closeDrawer(); }}
                        style={({ pressed }) => ({
                          minHeight: 44, justifyContent: "center", borderRadius: 10,
                          marginLeft: nested ? 12 : 0, paddingHorizontal: 12, paddingVertical: 10,
                          borderLeftWidth: nested ? 1 : 0, borderLeftColor: theme.colors.border,
                          backgroundColor: focused ? theme.colors.primarySurface : pressed ? theme.colors.glassStrong : "transparent",
                        })}
                      >
                        <Text style={{ color: focused ? theme.colors.text : theme.colors.muted, fontSize: 14, fontWeight: focused ? "700" : "500" }}>{label}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            );
          })}
          <View style={{ marginTop: "auto", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: theme.colors.text, fontSize: 16 }}>Light theme</Text>
            <Switch accessibilityLabel="Light theme" value={theme.mode === "light"} onValueChange={(enabled) => setMode(enabled ? "light" : "dark")} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={() => void signOut()}
            style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", paddingVertical: 12, marginBottom: 16, borderRadius: 10, backgroundColor: theme.colors.danger, opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: "600", textAlign: "center" }}>Sign out</Text>
          </Pressable>
        </DrawerContentScrollView>
      )}
    >
      {enabledScreens.map((screen) => (
        <Drawer.Screen key={screen.name} name={screen.name} component={screen.component} options={{ title: screen.title }} />
      ))}
    </Drawer.Navigator>
  );
}

export function AppNavigator() {
  const { theme } = useTheme();

  const { initializing, accessLoading, accessError, moduleAccess, session } = useAuth();
  const enabledScreens = screenRegistry.filter((screen) => moduleAccess[screen.key]);

  if (initializing) {
    return <View style={{ flex: 1, justifyContent: "center", backgroundColor: theme.colors.background }}><LoadingBlock label="Loading mobile workspace" /></View>;
  }

  return (
    <NavigationContainer theme={getNavigationTheme(theme)}>
      {!session ? (
        <LoginScreen />
      ) : accessLoading ? (
        <View style={{ flex: 1, justifyContent: "center", backgroundColor: theme.colors.background }}><LoadingBlock label="Loading your modules" /></View>
      ) : accessError ? (
        <AccessErrorScreen message={accessError} />
      ) : enabledScreens.length === 0 ? (
        <NoAccessScreen />
      ) : (
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.header },
            headerTintColor: theme.colors.text,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen name="AppDrawer" component={DrawerNavigator} options={{ headerShown: false }} />
          <Stack.Screen name="UserDetail" component={UserDetailScreen} options={{ title: "User Detail" }} />
          <Stack.Screen name="AssetDetail" component={AssetDetailScreen} options={{ title: "Asset Detail" }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
