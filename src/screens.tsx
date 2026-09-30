import { fetchCrossCheck } from "./cross-check-client";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import Papa from "papaparse";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useAuth } from "./auth";
import { assetGroups, getAssetGroupsFromApi } from "./assetGroups";
import { theme } from "./theme";
import { AppModuleKey, AssetFormState, AssetRecord, AttendanceResponse, Metrics, ModuleAccessLevel, TicketAttachment, TicketAttachmentInput, TicketRecord, UserRecord, UsersSyncResult, appModules, getDefaultModuleAccess, getDefaultModuleAccessLevels, getMissingModuleKeys, normalizeModuleAccess, normalizeModuleAccessLevels } from "./types";
import { csvEscape, displayValue, formatDate, normalizeText } from "./utils";
import {
  AppButton,
  Badge,
  Card,
  EmptyBlock,
  Field,
  InlineLabel,
  LoadingBlock,
  Screen,
  SectionTitle,
  AppInput,
} from "./ui";

export type RootStackParamList = {
  AppDrawer: undefined;
  UserDetail: { id: string };
  AssetDetail: { id: string };
};

function MessageCard({ label, tone }: { label: string; tone: "danger" | "success" }) {
  return (
    <Card>
      <Badge label={tone === "danger" ? "Error" : "Success"} tone={tone} />
      <Text style={[styles.metaText, { marginTop: 10 }]}>{label}</Text>
    </Card>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <Card style={{ flex: 1, minWidth: 140 }}>
      <Text style={styles.metaText}>{title}</Text>
      <Text style={styles.bigNumber}>{value}</Text>
    </Card>
  );
}

function createAssetForm(assetGroup: string = assetGroups[0]): AssetFormState {
  return {
    assetTag: "",
    name: "",
    assetGroup,
    assetType: "",
    status: "active",
    quantity: "1",
    location: "",
    serialNumber: "",
    manufacturer: "",
    model: "",
    notes: "",
  };
}

const ticketPriorities: TicketRecord["priority"][] = ["low", "medium", "high", "urgent"];
const ticketStatuses: TicketRecord["status"][] = ["open", "in-progress", "waiting-user", "resolved", "closed"];

function ticketStatusTone(status: TicketRecord["status"]) {
  if (status === "resolved" || status === "closed") return "success";
  if (status === "waiting-user") return "warning";
  if (status === "in-progress") return "info";
  return "default";
}

function AccessLevelPicker({ value, onChange }: { value: ModuleAccessLevel; onChange: (value: ModuleAccessLevel) => void }) {
  const options: Array<{ value: ModuleAccessLevel; label: string }> = [
    { value: "none", label: "None" },
    { value: "read", label: "Read" },
    { value: "modify", label: "Modify" },
  ];

  return (
    <View style={styles.accessLevelPicker}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          style={[
            styles.accessLevelOption,
            value === option.value ? styles.accessLevelOptionActive : null,
          ]}
        >
          <Text style={[styles.accessLevelText, value === option.value ? styles.accessLevelTextActive : null]}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

async function pickTicketImage(source: "library" | "camera"): Promise<TicketAttachmentInput | null> {
  const permission = source === "camera"
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Images", source === "camera" ? "Camera permission is required." : "Photo library permission is required.");
    return null;
  }

  const result = source === "camera"
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7, base64: true })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
  if (result.canceled || !result.assets[0]?.base64) return null;

  const asset = result.assets[0];
  const mimeType = asset.mimeType || "image/jpeg";
  return {
    fileName: asset.fileName || `ticket-image-${Date.now()}.jpg`,
    mimeType,
    dataUrl: `data:${mimeType};base64,${asset.base64}`,
  };
}

function AttachmentStrip({ attachments }: { attachments?: Array<TicketAttachment | TicketAttachmentInput> }) {
  if (!attachments?.length) return null;
  return (
    <View style={styles.attachmentGrid}>
      {attachments.map((attachment, index) => {
        const dataUrl = "data_url" in attachment ? attachment.data_url : attachment.dataUrl;
        const name = "file_name" in attachment ? attachment.file_name : attachment.fileName;
        const key = "id" in attachment ? attachment.id : `${name}-${index}`;
        return (
          <View key={key} style={styles.attachmentItem}>
            <Image source={{ uri: dataUrl }} style={styles.attachmentImage} resizeMode="cover" />
            <Text style={styles.attachmentName} numberOfLines={1}>{name}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function LoginScreen() {
  const { signIn } = useAuth();

  return (
      <Screen title="PitStop 2.0" subtitle="Welcome to Pitstop 2.0 developed internally by ITCAN Solutions for Company General Management." scroll={false} includeTopInset>
      <Image source={require("../assets/splash-icon.png")} style={styles.loginLogo} resizeMode="contain" />
      <Card style={{ marginTop: 12 }}>
        <Text style={styles.heroText}>
          This mobile workspace keeps the current modules and API workflows, while delegating the server-side work to the existing backend.
        </Text>
        <AppButton label="Continue with Microsoft" variant="primary" onPress={() => void signIn()} style={{ marginTop: 16 }} />
      </Card>
    </Screen>
  );
}

export function DashboardScreen() {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiFetch("/api/metrics");
        if (!response.ok) throw new Error((await response.text()) || "Failed to load metrics");
        setData((await response.json()) as Metrics);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [apiFetch]);

  return (
    <Screen title="Dashboard" subtitle="Metrics and recent activity preserved from the current dashboard.">
      {loading ? <LoadingBlock label="Loading metrics..." /> : null}
      {error ? <MessageCard label={error} tone="danger" /> : null}
      {data ? (
        <>
          <View style={styles.grid}>
            <StatCard title="Employees" value={data.totals.employees} />
            <StatCard title="Active" value={data.totals.active} />
            <StatCard title="Disabled" value={data.totals.disabled} />
            <StatCard title="Guests" value={data.totals.guests} />
          </View>

          <Card>
            <SectionTitle>Top Departments</SectionTitle>
            {data.departments.slice(0, 10).map((department) => (
              <View key={department.name} style={styles.departmentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{department.name}</Text>
                  <Text style={styles.metaText}>
                    Active {department.active} | Disabled {department.disabled}
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.max(8, Math.min(100, (department.count / Math.max(data.totals.employees, 1)) * 100))}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.itemTitle}>{department.count}</Text>
              </View>
            ))}
          </Card>

          <Card>
            <SectionTitle>Recent Bulk Runs</SectionTitle>
            {data.recentRuns.length ? (
              data.recentRuns.map((run) => (
                <View key={run.id} style={styles.listItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{formatDate(run.createdAt)}</Text>
                    <Text style={styles.metaText}>
                      {run.actorUpn} | total {run.total} | changed {run.changed} | failed {run.failed}
                    </Text>
                  </View>
                  <Badge label={run.dryRun ? "DRY RUN" : "APPLIED"} tone={run.dryRun ? "warning" : "success"} />
                </View>
              ))
            ) : (
              <Text style={styles.metaText}>No recent runs</Text>
            )}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

export function UsersScreen({ navigation }: any) {
  const { apiFetch, moduleAccessLevel } = useAuth();
  const [items, setItems] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">("all");
  const canModifyUsers = moduleAccessLevel.users === "modify";

  const load = useCallback(async (reset = true, cursor?: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ top: "100" });
      if (search.trim()) params.set("search", search.trim());
      if (cursor) params.set("skiptoken", cursor);
      const response = await apiFetch(`/api/users?${params.toString()}`);
      if (!response.ok) throw new Error((await response.text()) || "Failed to load users");
      const json = await response.json();
      const incoming = Array.isArray(json.items) ? (json.items as UserRecord[]) : [];
      const next = json.nextLink ? new URL(json.nextLink).searchParams.get("$skiptoken") : null;
      setItems((current) => (reset ? incoming : [...current, ...incoming]));
      setNextToken(next);
    } catch (error) {
      Alert.alert("Users", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, search]);

  useEffect(() => {
    void load(true);
  }, [load]);

  const filtered = useMemo(() => {
    const term = normalizeText(filter);
    return items.filter((user) => {
      const matchesText =
        !term ||
        normalizeText(user.displayName).includes(term) ||
        normalizeText(user.userPrincipalName).includes(term) ||
        normalizeText(user.jobTitle).includes(term) ||
        normalizeText(user.department).includes(term);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "enabled" ? user.accountEnabled : !user.accountEnabled);
      return matchesText && matchesStatus;
    });
  }, [filter, items, statusFilter]);

  const shareUsers = async () => {
    const csv = [
      ["Name", "UPN", "Title", "Department", "Office", "Status"].join(","),
      ...filtered.map((user) =>
        [
          csvEscape(user.displayName || `${user.givenName ?? ""} ${user.surname ?? ""}`.trim() || "(no name)"),
          csvEscape(user.userPrincipalName),
          csvEscape(user.jobTitle ?? ""),
          csvEscape(user.department ?? ""),
          csvEscape(user.officeLocation ?? ""),
          csvEscape(user.accountEnabled ? "Enabled" : "Disabled"),
        ].join(","),
      ),
    ].join("\n");

    const fileUri = `${FileSystem.cacheDirectory}users.csv`;
    await FileSystem.writeAsStringAsync(fileUri, csv);
    await Sharing.shareAsync(fileUri);
  };

  const syncUsers = async () => {
    setSyncing(true);
    try {
      const response = await apiFetch("/api/users/sync", {
        method: "POST",
      });
      const json = (await response.json().catch(() => null)) as UsersSyncResult | { error?: string } | null;
      if (!response.ok) {
        throw new Error((json && "error" in json && json.error) || "Failed to sync users");
      }

      const result = json as UsersSyncResult;
      await load(true);
      Alert.alert("Users", `Synced ${result.upserted} users to Supabase on ${formatDate(result.syncedAt)}.`);
    } catch (error) {
      Alert.alert("Users", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Screen title="Users" subtitle={canModifyUsers ? "Directory search, filtering, and drill-in editing." : "Directory search and filtering."} right={<AppButton label={loading ? "Refreshing..." : "Refresh"} onPress={() => void load(true)} disabled={loading || syncing} />}>
      <Card>
        <Field label="Directory search">
          <AppInput value={search} onChangeText={setSearch} placeholder="Search display name or exact UPN" />
        </Field>
        <View style={styles.row}>
          <AppButton label={loading ? "Loading..." : "Search"} onPress={() => void load(true)} variant="primary" style={{ flex: 1 }} />
          {canModifyUsers ? (
            <AppButton label={syncing ? "Syncing..." : "Sync Users"} onPress={() => void syncUsers()} variant="success" disabled={loading || syncing} style={{ flex: 1 }} />
          ) : null}
        </View>
        <View style={styles.row}>
          <AppButton label="Share CSV" onPress={() => void shareUsers()} disabled={syncing} style={{ flex: 1 }} variant="default" />
        </View>
        <View style={{ paddingVertical: 6 }}>
        <Field label="Filter loaded results">
          <AppInput value={filter} onChangeText={setFilter} placeholder="Filter by title, department, or name" />
        </Field>
        </View>
        <View style={{ paddingVertical: 6 }}>
        <Field label="Status">
          <Picker selectedValue={statusFilter} style={styles.picker} dropdownIconColor={theme.colors.text} onValueChange={(value) => setStatusFilter(value)}>
            <Picker.Item label="All" value="all" />
            <Picker.Item label="Enabled" value="enabled" />
            <Picker.Item label="Disabled" value="disabled" />
          </Picker>
        </Field>
        </View>
      </Card>

      {filtered.length ? filtered.map((user) => {
        const content = (
          <Card>
            <View style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{user.displayName || user.userPrincipalName}</Text>
                <Text style={styles.metaText}>{user.userPrincipalName}</Text>
                <Text style={styles.metaText}>
                  {displayValue(user.jobTitle, "-")} | {displayValue(user.department, "-")}
                </Text>
              </View>
              <Badge label={user.accountEnabled ? "Enabled" : "Disabled"} tone={user.accountEnabled ? "success" : "danger"} />
            </View>
          </Card>
        );
        return canModifyUsers ? (
          <Pressable key={user.id} onPress={() => navigation.navigate("UserDetail", { id: user.id })}>
            {content}
          </Pressable>
        ) : (
          <View key={user.id}>{content}</View>
        );
      }) : loading ? <LoadingBlock label="Loading users..." /> : <EmptyBlock label="No users match the current filters." />}

      <AppButton label={loading ? "Loading..." : nextToken ? "Load more" : "No more users"} onPress={() => void load(false, nextToken)} disabled={!nextToken || loading} />
    </Screen>
  );
}

export function UserDetailScreen({ route }: any) {
  const { apiFetch, moduleAccessLevel } = useAuth();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [manager, setManager] = useState<{ userPrincipalName?: string; displayName?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const canModifyUsers = moduleAccessLevel.users === "modify";

  const load = useCallback(async () => {
    const response = await apiFetch(`/api/users/${encodeURIComponent(route.params.id)}`);
    if (!response.ok) throw new Error((await response.text()) || "Failed to load user");
    const json = await response.json();
    const nextUser = json.user as UserRecord;
    setUser(nextUser);
    setManager(json.manager ?? null);
    setForm({
      displayName: nextUser.displayName ?? "",
      givenName: nextUser.givenName ?? "",
      surname: nextUser.surname ?? "",
      jobTitle: nextUser.jobTitle ?? "",
      department: nextUser.department ?? "",
      officeLocation: nextUser.officeLocation ?? "",
      mobilePhone: nextUser.mobilePhone ?? "",
      employeeId: nextUser.employeeId ?? "",
      employeeType: nextUser.employeeType ?? "",
      usageLocation: nextUser.usageLocation ?? "",
      managerUPN: json.manager?.userPrincipalName ?? "",
    });
  }, [apiFetch, route.params.id]);

  useEffect(() => {
    if (!canModifyUsers) return;
    void load().catch((error) => Alert.alert("User", error instanceof Error ? error.message : "Unknown error"));
  }, [canModifyUsers, load]);

  if (!canModifyUsers) {
    return (
      <Screen title="Users" subtitle="Modify access is required to open user details.">
        <EmptyBlock label="Your Users access is read-only, so only the user list is available." />
      </Screen>
    );
  }

  const toggleAccount = async () => {
    if (!user) return;
    const response = await apiFetch(`/api/users/${encodeURIComponent(route.params.id)}/account`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountEnabled: !user.accountEnabled }),
    });
    if (!response.ok) {
      Alert.alert("Account", (await response.text()) || "Failed to update account state");
      return;
    }
    await load();
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await apiFetch(`/api/users/${encodeURIComponent(route.params.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error((await response.text()) || "Failed to save user");
      await load();
      Alert.alert("User", "Changes saved");
    } catch (error) {
      Alert.alert("User", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <Screen title="User" subtitle="Loading user details...">
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen title={user.displayName || user.userPrincipalName} subtitle={user.userPrincipalName} right={<Badge label={user.accountEnabled ? "Enabled" : "Disabled"} tone={user.accountEnabled ? "success" : "danger"} />}>
      <Card>
        <View style={styles.row}>
          <AppButton label={user.accountEnabled ? "Disable account" : "Enable account"} onPress={() => void toggleAccount()} variant={user.accountEnabled ? "danger" : "success"} style={{ flex: 1 }} />
          <AppButton label={saving ? "Saving..." : "Save"} onPress={() => void save()} variant="primary" disabled={saving} style={{ flex: 1 }} />
        </View>
      </Card>

      {[
        ["displayName", "Display Name"],
        ["givenName", "Given Name"],
        ["surname", "Surname"],
        ["jobTitle", "Job Title"],
        ["department", "Department"],
        ["officeLocation", "Office Location"],
        ["mobilePhone", "Mobile Phone"],
        ["employeeId", "Employee ID"],
        ["employeeType", "Employee Type"],
        ["usageLocation", "Usage Location"],
        ["managerUPN", "Manager UPN"],
      ].map(([key, label]) => (
        <Card key={key}>
          <Field label={label}>
            <AppInput value={form[key] ?? ""} onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))} />
          </Field>
        </Card>
      ))}

      <Card>
        <SectionTitle>Current Manager</SectionTitle>
        <Text style={styles.metaText}>
          {manager?.displayName ? `${manager.displayName} (${manager.userPrincipalName})` : manager?.userPrincipalName || "No manager assigned"}
        </Text>
      </Card>
    </Screen>
  );
}

export function BulkScreen() {
  const { apiFetch } = useAuth();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [preflight, setPreflight] = useState<any | null>(null);
  const [applyResult, setApplyResult] = useState<any | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [canary, setCanary] = useState("5");
  const [loading, setLoading] = useState(false);

  const selectCsv = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel"],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const content = await FileSystem.readAsStringAsync(asset.uri);
    const parsed = Papa.parse<Record<string, unknown>>(content, { header: true, skipEmptyLines: true });
    setRows(parsed.data);
    setPreflight(null);
    setApplyResult(null);
  };

  const shareTemplate = async () => {
    const response = await apiFetch("/api/template");
    if (!response.ok) {
      Alert.alert("Bulk", (await response.text()) || "Failed to download template");
      return;
    }
    const csv = await response.text();
    const uri = `${FileSystem.cacheDirectory}m365-bulk-template.csv`;
    await FileSystem.writeAsStringAsync(uri, csv);
    await Sharing.shareAsync(uri);
  };

  const runPreflight = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (!response.ok) throw new Error((await response.text()) || "Preflight failed");
      setPreflight(await response.json());
      setApplyResult(null);
    } catch (error) {
      Alert.alert("Bulk", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const runApply = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun,
          canary: Number(canary || "0"),
          items: preflight?.items ?? [],
        }),
      });
      if (!response.ok) throw new Error((await response.text()) || "Apply failed");
      setApplyResult(await response.json());
    } catch (error) {
      Alert.alert("Bulk", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Bulk Updater" subtitle="Upload a CSV, validate it against Graph, then apply it with dry-run and canary controls.">
      <Card>
        <View style={styles.row}>
          <AppButton label="Select CSV" onPress={() => void selectCsv()} variant="primary" style={{ flex: 1 }} />
          <AppButton label="Share template" onPress={() => void shareTemplate()} style={{ flex: 1 }} />
        </View>
        <Text style={[styles.metaText, { marginTop: 12 }]}>Loaded rows: {rows.length}</Text>
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <InlineLabel>Dry run</InlineLabel>
          <Switch value={dryRun} onValueChange={setDryRun} />
        </View>
        <Field label="Canary">
          <AppInput value={canary} onChangeText={setCanary} keyboardType="numeric" />
        </Field>
        <AppButton label={loading ? "Working..." : "Run preflight"} onPress={() => void runPreflight()} disabled={!rows.length || loading} variant="primary" />
      </Card>

      {preflight ? (
        <Card>
          <SectionTitle>Preflight Summary</SectionTitle>
          <Text style={styles.metaText}>
            Rows {preflight.summary.rows} | Will change {preflight.summary.willChange} | Errors {preflight.summary.errors}
          </Text>
          <AppButton label={loading ? "Working..." : "Apply"} onPress={() => void runApply()} disabled={loading} variant="success" style={{ marginTop: 12 }} />
          {(preflight.items ?? []).slice(0, 20).map((item: any, index: number) => (
            <View key={`${item.upn}-${index}`} style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.upn}</Text>
                <Text style={styles.metaText}>
                  {(item.changes ?? []).map((change: any) => change.field).join(", ") || "No changes"}
                </Text>
              </View>
              <Badge label={(item.errors ?? []).length ? "Error" : "Ready"} tone={(item.errors ?? []).length ? "danger" : "success"} />
            </View>
          ))}
        </Card>
      ) : null}

      {applyResult ? (
        <Card>
          <SectionTitle>Apply Result</SectionTitle>
          <Text style={styles.metaText}>
            Changed {applyResult.summary.changed} | Failed {applyResult.summary.failed}
          </Text>
          {(applyResult.results ?? []).slice(0, 20).map((result: any, index: number) => (
            <View key={`${result.upn}-${index}`} style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{result.upn}</Text>
                <Text style={styles.metaText}>
                  {(result.details?.ops ?? []).map((op: any) => op.type).join(", ") || result.details?.error || "No changes"}
                </Text>
              </View>
              <Badge label={result.status} tone={result.status === "error" ? "danger" : "success"} />
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

export function OrgChartScreen() {
  const { apiFetch } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiFetch("/api/orgchart");
        if (!response.ok) throw new Error((await response.text()) || "Failed to load org chart");
        const json = await response.json();
        setItems(Array.isArray(json.items) ? json.items : []);
      } catch (error) {
        Alert.alert("Org Chart", error instanceof Error ? error.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [apiFetch]);

  const roots = useMemo(() => {
    const map = new Map<string, any>();
    items.forEach((item) => map.set(item.id, { ...item, children: [] as any[] }));
    const baseRoots: any[] = [];
    items.forEach((item) => {
      const node = map.get(item.id);
      if (item.managerId && map.has(item.managerId)) map.get(item.managerId).children.push(node);
      else baseRoots.push(node);
    });

    const term = normalizeText(filter);
    if (!term) return baseRoots;

    const includeNode = (node: any): any | null => {
      const children = node.children.map(includeNode).filter(Boolean);
      const matches =
        normalizeText(node.displayName).includes(term) ||
        normalizeText(node.jobTitle).includes(term) ||
        normalizeText(node.department).includes(term);
      return matches || children.length ? { ...node, children } : null;
    };

    return baseRoots.map(includeNode).filter(Boolean);
  }, [filter, items]);

  return (
    <Screen title="Org Chart" subtitle="Hierarchy adapted into expandable mobile cards.">
      <Card>
        <Field label="Filter">
          <AppInput value={filter} onChangeText={setFilter} placeholder="Filter by name, title, or department" />
        </Field>
      </Card>
      {loading ? <LoadingBlock label="Loading org chart..." /> : null}
      {roots.map((root) => (
        <OrgNode key={root.id} node={root} depth={0} />
      ))}
      {!loading && !roots.length ? <EmptyBlock label="No org chart data available." /> : null}
    </Screen>
  );
}

function OrgNode({ node, depth }: { node: any; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  return (
    <View style={{ marginLeft: depth * 12 }}>
      <Pressable onPress={() => setOpen((current) => !current)}>
        <Card>
          <View style={styles.listItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{node.displayName}</Text>
              <Text style={styles.metaText}>
                {displayValue(node.jobTitle, "-")} | {displayValue(node.department, "-")}
              </Text>
              <Text style={styles.metaText}>{node.upn}</Text>
            </View>
            <Badge label={node.children.length ? (open ? "Collapse" : "Expand") : "Leaf"} tone="info" />
          </View>
        </Card>
      </Pressable>
      {open ? node.children.map((child: any) => <OrgNode key={child.id} node={child} depth={depth + 1} />) : null}
    </View>
  );
}

export function HrScreen() {
  const leaveBalances = [
    ["Annual Leave", 14, "success"],
    ["Sick Leave", 6, "warning"],
    ["Personal Leave", 3, "info"],
  ] as const;

  return (
    <Screen title="HR" subtitle="Current HR placeholder data preserved in a mobile layout.">
      <View style={styles.grid}>
        {leaveBalances.map(([label, value, tone]) => (
          <Card key={label} style={{ flex: 1 }}>
            <Text style={styles.metaText}>{label}</Text>
            <Text style={styles.bigNumber}>{value}</Text>
            <Badge label="days left" tone={tone as any} />
          </Card>
        ))}
      </View>

      <Card>
        <SectionTitle>Upcoming Holidays</SectionTitle>
        {[
          ["Spring Holiday", "2026-04-10", "Company-wide"],
          ["Founders Day", "2026-04-21", "Lebanon Office"],
          ["Labor Day", "2026-05-01", "Company-wide"],
        ].map(([name, date, scope]) => (
          <View key={name} style={styles.listItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{name}</Text>
              <Text style={styles.metaText}>{date}</Text>
            </View>
            <Badge label={scope} tone="info" />
          </View>
        ))}
      </Card>
    </Screen>
  );
}

export function AttendanceScreen() {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState("200");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reportId, setReportId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (nextReportId?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: limit || "200" });
      if (nextReportId || reportId) params.set("reportId", nextReportId || reportId);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);

      const response = await apiFetch(`/api/attendance?${params.toString()}`);
      if (!response.ok) throw new Error((await response.text()) || "Failed to load attendance");
      const json = (await response.json()) as AttendanceResponse;
      setData(json);
      setReportId(json.report?.id ?? nextReportId ?? "");
    } catch (error) {
      Alert.alert("Attendance", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, fromDate, limit, reportId, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    if (!search.trim()) return data?.rows ?? [];
    const term = search.toLowerCase();
    return (data?.rows ?? []).filter((row) => (data?.columns ?? []).some((column) => String(row[column] ?? "").toLowerCase().includes(term)));
  }, [data, search]);

  return (
    <Screen title="Attendance" subtitle="Live attendance reports with report selection and date filters.">
      <Card>
        <Field label="Report">
          <Picker selectedValue={reportId} style={styles.picker} dropdownIconColor={theme.colors.text} onValueChange={(value) => { setReportId(value); void load(value); }}>
            {(data?.availableReports ?? []).map((report) => (
              <Picker.Item key={report.id} label={report.name} value={report.id} />
            ))}
          </Picker>
        </Field>
        <Field label="From date">
          <AppInput value={fromDate} onChangeText={setFromDate} placeholder="YYYY-MM-DD" />
        </Field>
        <Field label="To date">
          <AppInput value={toDate} onChangeText={setToDate} placeholder="YYYY-MM-DD" />
        </Field>
        <Field label="Limit">
          <AppInput value={limit} onChangeText={setLimit} keyboardType="numeric" />
        </Field>
        <AppButton label={loading ? "Refreshing..." : "Refresh"} onPress={() => void load()} variant="primary" />
      </Card>

      <Card>
        <Text style={styles.metaText}>Source {data?.source || "Not connected"} | Updated {formatDate(data?.fetchedAt)}</Text>
        <Field label="Search rows">
          <AppInput value={search} onChangeText={setSearch} placeholder="Search attendance rows" />
        </Field>
      </Card>

      {rows.length ? rows.slice(0, 100).map((row, index) => (
        <Card key={index}>
          {(data?.columns ?? []).map((column) => (
            <View key={column} style={styles.rowBetween}>
              <InlineLabel>{column}</InlineLabel>
              <Text style={[styles.metaText, { flex: 1, textAlign: "right", marginLeft: 12 }]}>{String(row[column] ?? "-")}</Text>
            </View>
          ))}
        </Card>
      )) : loading ? <LoadingBlock label="Loading attendance..." /> : <EmptyBlock label="No attendance rows found." />}
    </Screen>
  );
}

export function AssetsScreen({ navigation }: any) {
  const { apiFetch } = useAuth();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [allowedAssetGroups, setAllowedAssetGroups] = useState<string[]>([...assetGroups]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserRecord[]>([]);
  const [form, setForm] = useState<AssetFormState>(() => createAssetForm());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/assets");
      if (!response.ok) throw new Error((await response.text()) || "Failed to load assets");
      const json = await response.json();
      setAssets(Array.isArray(json.items) ? json.items : []);
      const nextGroups = getAssetGroupsFromApi(json.assetGroups);
      setAllowedAssetGroups(nextGroups);
      setForm((current) => ({
        ...current,
        assetGroup: nextGroups.includes(current.assetGroup) ? current.assetGroup : nextGroups[0] ?? assetGroups[0],
      }));
    } catch (error) {
      Alert.alert("Assets", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!formOpen || !userSearch.trim()) {
      setUserResults(selectedUser ? [selectedUser] : []);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await apiFetch(`/api/assets/users?search=${encodeURIComponent(userSearch.trim())}`);
        if (!response.ok) throw new Error((await response.text()) || "Failed to search users");
        const json = await response.json();
        setUserResults(Array.isArray(json.items) ? json.items : []);
      } catch (error) {
        Alert.alert("Assets", error instanceof Error ? error.message : "Unknown error");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [apiFetch, formOpen, selectedUser, userSearch]);

  const filtered = useMemo(() => {
    const term = normalizeText(search);
    return assets.filter((asset) =>
      [
        asset.name,
        asset.asset_tag,
        asset.asset_group,
        asset.asset_type,
        asset.location,
        asset.serial_number,
        asset.manufacturer,
        asset.model,
        asset.assigned_user?.display_name,
        asset.assigned_user?.user_principal_name,
      ].some((value) => normalizeText(value).includes(term)),
    );
  }, [assets, search]);

  const createAsset = async () => {
    try {
      const response = await apiFetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, assignedUser: selectedUser }),
      });
      if (!response.ok) throw new Error((await response.text()) || "Failed to create asset");
      setFormOpen(false);
      setSelectedUser(null);
      setUserSearch("");
      setForm(createAssetForm(allowedAssetGroups[0] ?? assetGroups[0]));
      await load();
    } catch (error) {
      Alert.alert("Assets", error instanceof Error ? error.message : "Unknown error");
    }
  };

  return (
    <Screen title="Assets" subtitle="Inventory search, assignment, and asset creation." right={<AppButton label="New" variant="primary" onPress={() => {
      setForm((current) => ({ ...current, assetGroup: allowedAssetGroups.includes(current.assetGroup) ? current.assetGroup : allowedAssetGroups[0] ?? assetGroups[0] }));
      setFormOpen((current) => !current);
    }} />}>
      <Card>
        <Field label="Search assets">
          <AppInput value={search} onChangeText={setSearch} placeholder="Search tags, names, users, serials..." />
        </Field>
        <AppButton label={loading ? "Refreshing..." : "Refresh"} style={{ marginTop: 12 }} onPress={() => void load()} />
      </Card>

      {formOpen ? (
        <Card>
          <SectionTitle>Create Asset</SectionTitle>
          <Field label="Asset Tag">
            <AppInput value={form.assetTag} onChangeText={(value) => setForm((current) => ({ ...current, assetTag: value }))} />
          </Field>
          <Field label="Name">
            <AppInput value={form.name} onChangeText={(value) => setForm((current) => ({ ...current, name: value }))} />
          </Field>
          <Field label="Group">
            <Picker selectedValue={form.assetGroup} style={styles.picker} dropdownIconColor={theme.colors.text} onValueChange={(value) => setForm((current) => ({ ...current, assetGroup: value }))}>
              {allowedAssetGroups.map((group) => (
                <Picker.Item key={group} label={group} value={group} />
              ))}
            </Picker>
          </Field>
          <Field label="Type">
            <AppInput value={form.assetType} onChangeText={(value) => setForm((current) => ({ ...current, assetType: value }))} />
          </Field>
          <Field label="Status">
            <Picker selectedValue={form.status} style={styles.picker} dropdownIconColor={theme.colors.text} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}>
              {["active", "in-stock", "repair", "retired"].map((status) => (
                <Picker.Item key={status} label={status} value={status} />
              ))}
            </Picker>
          </Field>
          <Field label="Qty">
            <AppInput value={form.quantity} onChangeText={(value) => setForm((current) => ({ ...current, quantity: value }))} keyboardType="numeric" />
          </Field>
          <Field label="Location">
            <AppInput value={form.location} onChangeText={(value) => setForm((current) => ({ ...current, location: value }))} placeholder="Storage room, office, shelf..." />
          </Field>
          <Field label="Serial Number">
            <AppInput value={form.serialNumber} onChangeText={(value) => setForm((current) => ({ ...current, serialNumber: value }))} />
          </Field>
          <Field label="Manufacturer">
            <AppInput value={form.manufacturer} onChangeText={(value) => setForm((current) => ({ ...current, manufacturer: value }))} />
          </Field>
          <Field label="Model">
            <AppInput value={form.model} onChangeText={(value) => setForm((current) => ({ ...current, model: value }))} />
          </Field>
          <Field label="Assign To User">
            <AppInput value={userSearch} onChangeText={setUserSearch} placeholder="Search by name or UPN" />
          </Field>
          {userResults.map((user) => (
            <Pressable key={user.id} onPress={() => { setSelectedUser(user); setUserSearch(user.displayName || user.userPrincipalName); setUserResults([user]); }}>
              <View style={styles.userLookupRow}>
                <Text style={styles.itemTitle}>{user.displayName || user.userPrincipalName}</Text>
                <Text style={styles.metaText}>{user.userPrincipalName}</Text>
              </View>
            </Pressable>
          ))}
          <Text style={styles.metaText}>Selected: {selectedUser ? `${selectedUser.displayName || selectedUser.userPrincipalName}` : "Unassigned"}</Text>
          <Field label="Notes">
            <AppInput value={form.notes} onChangeText={(value) => setForm((current) => ({ ...current, notes: value }))} multiline />
          </Field>
          <AppButton label="Create Asset" onPress={() => void createAsset()} variant="primary" />
        </Card>
      ) : null}

      {filtered.length ? filtered.map((asset) => (
        <Pressable key={asset.id} onPress={() => navigation.navigate("AssetDetail", { id: asset.id })}>
          <Card>
            <View style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{asset.name}</Text>
                <Text style={styles.metaText}>{asset.asset_tag}</Text>
                <Text style={styles.metaText}>
                  {displayValue(asset.asset_type, "-")} | Qty {asset.quantity ?? 1} | {displayValue(asset.location, "No location")}
                </Text>
                <Text style={styles.metaText}>
                  {displayValue(asset.assigned_user?.display_name || asset.assigned_user?.user_principal_name, "Unassigned")}
                </Text>
              </View>
              <Badge label={asset.status} tone="info" />
            </View>
          </Card>
        </Pressable>
      )) : loading ? <LoadingBlock label="Loading assets..." /> : <EmptyBlock label="No assets found." />}
    </Screen>
  );
}

export function AssetDetailScreen({ route, navigation }: any) {
  const { apiFetch } = useAuth();
  const [asset, setAsset] = useState<AssetRecord | null>(null);
  const [form, setForm] = useState<AssetFormState | null>(null);
  const [allowedAssetGroups, setAllowedAssetGroups] = useState<string[]>([...assetGroups]);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserRecord[]>([]);

  const load = useCallback(async () => {
    const response = await apiFetch(`/api/assets/${encodeURIComponent(route.params.id)}`);
    if (!response.ok) throw new Error((await response.text()) || "Failed to load asset");
    const json = await response.json();
    const nextAsset = json.asset as AssetRecord;
    const nextGroups = getAssetGroupsFromApi(json.assetGroups);
    setAllowedAssetGroups(nextGroups);
    setAsset(nextAsset);
    setForm({
      assetTag: nextAsset.asset_tag,
      name: nextAsset.name,
      assetGroup: nextAsset.asset_group && nextGroups.includes(nextAsset.asset_group) ? nextAsset.asset_group : nextGroups[0] ?? assetGroups[0],
      assetType: nextAsset.asset_type,
      status: nextAsset.status,
      quantity: String(nextAsset.quantity ?? 1),
      location: nextAsset.location ?? "",
      serialNumber: nextAsset.serial_number ?? "",
      manufacturer: nextAsset.manufacturer ?? "",
      model: nextAsset.model ?? "",
      notes: nextAsset.notes ?? "",
    });
    const assigned = nextAsset.assigned_user ? {
      id: nextAsset.assigned_user.azure_user_id || nextAsset.assigned_user.id || nextAsset.assigned_user.user_principal_name,
      userPrincipalName: nextAsset.assigned_user.user_principal_name,
      displayName: nextAsset.assigned_user.display_name ?? undefined,
      jobTitle: nextAsset.assigned_user.job_title ?? undefined,
      department: nextAsset.assigned_user.department ?? undefined,
    } : null;
    setSelectedUser(assigned);
    setUserSearch(assigned?.displayName || assigned?.userPrincipalName || "");
  }, [apiFetch, route.params.id]);

  useEffect(() => {
    void load().catch((error) => Alert.alert("Asset", error instanceof Error ? error.message : "Unknown error"));
  }, [load]);

  useEffect(() => {
    if (!userSearch.trim()) {
      setUserResults(selectedUser ? [selectedUser] : []);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await apiFetch(`/api/assets/users?search=${encodeURIComponent(userSearch.trim())}`);
        if (!response.ok) throw new Error((await response.text()) || "Failed to search users");
        const json = await response.json();
        setUserResults(Array.isArray(json.items) ? json.items : []);
      } catch (error) {
        Alert.alert("Asset", error instanceof Error ? error.message : "Unknown error");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [apiFetch, selectedUser, userSearch]);

  const save = async () => {
    const response = await apiFetch(`/api/assets/${encodeURIComponent(route.params.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, assignedUser: selectedUser }),
    });
    if (!response.ok) {
      Alert.alert("Asset", (await response.text()) || "Failed to save asset");
      return;
    }
    await load();
    Alert.alert("Asset", "Changes saved");
  };

  const remove = async () => {
    const response = await apiFetch(`/api/assets/${encodeURIComponent(route.params.id)}`, { method: "DELETE" });
    if (!response.ok) {
      Alert.alert("Asset", (await response.text()) || "Failed to delete asset");
      return;
    }
    navigation.goBack();
  };

  if (!asset || !form) {
    return (
      <Screen title="Asset" subtitle="Loading asset details...">
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen title={asset.name} subtitle={`${asset.asset_tag} | Created ${formatDate(asset.created_at)}`}>
      <Card>
        <View style={styles.row}>
          <AppButton label="Save Changes" onPress={() => void save()} variant="primary" style={{ flex: 1 }} />
          <AppButton label="Delete Asset" onPress={() => void remove()} variant="danger" style={{ flex: 1 }} />
        </View>
      </Card>

      {[
        ["assetTag", "Asset Tag"],
        ["name", "Name"],
        ["assetType", "Type"],
        ["quantity", "Qty"],
        ["location", "Location"],
        ["serialNumber", "Serial Number"],
        ["manufacturer", "Manufacturer"],
        ["model", "Model"],
      ].map(([key, label]) => (
        <Card key={key}>
          <Field label={label}>
            <AppInput value={form[key as keyof AssetFormState] ?? ""} onChangeText={(value) => setForm((current) => current ? { ...current, [key]: value } : current)} />
          </Field>
        </Card>
      ))}

      <Card>
        <Field label="Group">
          <Picker selectedValue={form.assetGroup} style={styles.picker} dropdownIconColor={theme.colors.text} onValueChange={(value) => setForm((current) => current ? { ...current, assetGroup: value } : current)}>
            {allowedAssetGroups.map((group) => (
              <Picker.Item key={group} label={group} value={group} />
            ))}
          </Picker>
        </Field>
      </Card>

      <Card>
        <Field label="Status">
          <Picker selectedValue={form.status} style={styles.picker} dropdownIconColor={theme.colors.text} onValueChange={(value) => setForm((current) => current ? { ...current, status: value } : current)}>
            {["active", "in-stock", "repair", "retired"].map((status) => (
              <Picker.Item key={status} label={status} value={status} />
            ))}
          </Picker>
        </Field>
      </Card>

      <Card>
        <Field label="Assign To User">
          <AppInput value={userSearch} onChangeText={setUserSearch} placeholder="Search by name or UPN" />
        </Field>
        {userResults.map((user) => (
          <Pressable key={user.id} onPress={() => { setSelectedUser(user); setUserSearch(user.displayName || user.userPrincipalName); setUserResults([user]); }}>
            <View style={styles.userLookupRow}>
              <Text style={styles.itemTitle}>{user.displayName || user.userPrincipalName}</Text>
              <Text style={styles.metaText}>{user.userPrincipalName}</Text>
            </View>
          </Pressable>
        ))}
        <Text style={styles.metaText}>Selected: {selectedUser ? selectedUser.displayName || selectedUser.userPrincipalName : "Unassigned"}</Text>
      </Card>

      <Card>
        <Field label="Notes">
          <AppInput value={form.notes ?? ""} onChangeText={(value) => setForm((current) => current ? { ...current, notes: value } : current)} multiline />
        </Field>
      </Card>
    </Screen>
  );
}

type JsonRecord = Record<string, unknown>;
type CrossCheckUser = { value: string; label: string };

function findResponseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const record = value as JsonRecord;
  for (const key of ["users", "data", "rows", "result", "items"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

function normalizeCrossCheckUsers(value: unknown): CrossCheckUser[] {
  return findResponseArray(value).map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      const text = String(item ?? "");
      return text ? { value: text, label: text } : null;
    }
    const row = item as JsonRecord;
    const first = (keys: string[]) => keys.map((key) => row[key]).find((entry) => entry !== null && entry !== undefined && String(entry).trim());
    const id = first(["employeeId", "EmployeeID", "id", "ID", "value", "userId", "UserID"]);
    const label = first(["text", "Text", "label", "Label", "displayName", "name", "fullName", "employeeName", "EmployeeName"]);
    return id ? { value: String(id), label: String(label ?? id) } : null;
  }).filter((item): item is CrossCheckUser => Boolean(item));
}

function responseTables(value: unknown) {
  const arrays: Array<{ title: string; rows: JsonRecord[] }> = [];
  if (Array.isArray(value)) arrays.push({ title: "Results", rows: value.filter((row): row is JsonRecord => Boolean(row) && typeof row === "object" && !Array.isArray(row)) });
  else if (value && typeof value === "object") {
    Object.entries(value as JsonRecord).forEach(([key, rows]) => {
      if (Array.isArray(rows) && rows.every((row) => Boolean(row) && typeof row === "object" && !Array.isArray(row))) {
        arrays.push({ title: key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " "), rows: rows as JsonRecord[] });
      }
    });
  }
  return arrays.slice(0, 2);
}

function comparable(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function rowValue(row: JsonRecord, key: string) {
  const target = comparable(key);
  const match = Object.keys(row).find((candidate) => comparable(candidate) === target);
  return match ? row[match] : undefined;
}

function dateKey(value: unknown) {
  const text = String(value ?? "").trim();
  const iso = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slash) return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function leaveLabel(row: JsonRecord) {
  return Object.entries(row)
    .filter(([key]) => /leave|vacation|absence|timeoff/.test(comparable(key)))
    .map(([, value]) => String(value ?? "").trim())
    .filter((value) => value && !/^(?:-|0|false|none|null|n\/a|no leave|working|present|available)$/i.test(value))
    .join(" - ");
}

function buildDailyComparison(logs: JsonRecord[], punches: JsonRecord[]) {
  const punchCounts = new Map<string, number>();
  punches.forEach((row) => {
    const likely = Object.keys(row).find((key) => /date|time/.test(comparable(key)));
    const date = dateKey(row["Cross-check Date"] ?? (likely ? row[likely] : ""));
    if (date) punchCounts.set(date, (punchCounts.get(date) ?? 0) + 1);
  });
  return logs.map((row) => {
    const date = dateKey(rowValue(row, "Period"));
    const leave = leaveLabel(row);
    const punchesForDay = punchCounts.get(date) ?? 0;
    const parsed = new Date(`${date}T00:00:00`);
    const weekend = parsed.getDay() === 0 || parsed.getDay() === 6;
    const result = leave && punchesForDay
      ? "Abnormal: leave submitted but punches exist"
      : !weekend && !leave && !punchesForDay
        ? "Abnormal: no punches and no leave"
        : weekend && !leave && !punchesForDay ? "Weekend" : leave ? "Leave - no punches" : "Attendance recorded";
    return { Date: date, Day: parsed.toLocaleDateString("en-US", { weekday: "short" }), Leave: leave || "None", Punches: punchesForDay, Result: result };
  }).filter((row) => row.Date).sort((a, b) => a.Date.localeCompare(b.Date));
}

export function CrossCheckScreen() {
  const { apiFetch } = useAuth();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [users, setUsers] = useState<CrossCheckUser[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [comparison, setComparison] = useState<JsonRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetchCrossCheck("/api/cross-check/leave-users", apiFetch);
        if (!response.ok) throw new Error((await response.text()) || "Failed to load leave users");
        const next = normalizeCrossCheckUsers(await response.json());
        setUsers(next);
        setEmployeeId((current) => current || next[0]?.value || "");
      } catch (error) {
        Alert.alert("Data Cross Check", error instanceof Error ? error.message : "Unknown error");
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, [apiFetch]);

  const run = async () => {
    if (!employeeId || !year) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ year, employeeId });
      const response = await fetchCrossCheck(`/api/cross-check/employee-leaves?${params.toString()}`, apiFetch);
      if (!response.ok) throw new Error((await response.text()) || "Failed to load employee leaves");
      const json = await response.json();
      setResult(json);
      const logs = responseTables(json).find((table) => comparable(table.title) === "logs")?.rows ?? [];
      const dates = Array.from(new Set(logs.map((row) => dateKey(rowValue(row, "Period"))).filter(Boolean)));
      const pitstopResponse = await fetchCrossCheck("/api/cross-check/pitstop-data", apiFetch);
      if (!pitstopResponse.ok) throw new Error((await pitstopResponse.text()) || "Failed to load PitStop data");
      const pitstopRows = findResponseArray(await pitstopResponse.json()).filter((row): row is JsonRecord => Boolean(row) && typeof row === "object" && !Array.isArray(row));
      const selectedName = users.find((user) => user.value === employeeId)?.label.replace(/\|\s*Active\b/gi, "").trim().toLowerCase() ?? "";
      const person = pitstopRows.find((row) => {
        const nameKey = Object.keys(row).find((key) => /fullname|name/.test(comparable(key)));
        return nameKey && String(row[nameKey] ?? "").replace(/\|\s*Active\b/gi, "").trim().toLowerCase() === selectedName;
      });
      const badgeKey = person && Object.keys(person).find((key) => /badge|card|pin|employeeid|employeeno|empid|code/.test(comparable(key)));
      const badge = badgeKey && person ? comparable(person[badgeKey]) : "";
      if (!badge) throw new Error("No badge number found for the selected employee.");
      // Keep cross-check requests within the internal API's SQL concurrency limit.
      const attendance: Record<string, unknown>[][] = [];
      for (const date of dates) {
        const attendanceParams = new URLSearchParams({ fromDate: date, toDate: date, limit: "2000" });
        const attendanceResponse = await apiFetch(`/api/attendance?${attendanceParams.toString()}`);
        if (!attendanceResponse.ok) throw new Error((await attendanceResponse.text()) || "Failed to load attendance");
        const attendanceJson = await attendanceResponse.json() as AttendanceResponse;
        attendance.push(attendanceJson.rows.map((row) => ({ ...row, "Cross-check Date": date })));
      }
      const allPunches = attendance.flat();
      const matchedPunches = allPunches.filter((row) => Object.entries(row).some(([key, value]) => /badge|card|pin|employeeid|employeeno|empid|code/.test(comparable(key)) && comparable(value) === badge));
      setComparison(buildDailyComparison(logs, matchedPunches));
    } catch (error) {
      Alert.alert("Data Cross Check", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const tables = useMemo(() => responseTables(result), [result]);
  return (
    <Screen title="Data Cross Check" subtitle="Compare employee leave data from the external leave service.">
      <Card>
        <Field label="Year"><AppInput value={year} onChangeText={setYear} keyboardType="numeric" /></Field>
        <Field label="Employee">
          <Picker selectedValue={employeeId} enabled={!loadingUsers && users.length > 0} style={styles.picker} dropdownIconColor={theme.colors.text} onValueChange={setEmployeeId}>
            {users.map((user) => <Picker.Item key={user.value} label={user.label} value={user.value} />)}
          </Picker>
        </Field>
        <AppButton label={loading ? "Checking..." : "Submit"} onPress={() => void run()} variant="primary" disabled={loading || loadingUsers || !employeeId || !year} />
      </Card>
      {comparison.length ? (
        <View>
          <SectionTitle>Daily Comparison</SectionTitle>
          {comparison.map((row, index) => (
            <Card key={`${row.Date}-${index}`}>
              {Object.entries(row).map(([key, value]) => (
                <View key={key} style={styles.rowBetween}>
                  <InlineLabel>{key}</InlineLabel>
                  <Text style={[styles.metaText, { flex: 1, textAlign: "right", marginLeft: 12 }]}>{String(value)}</Text>
                </View>
              ))}
            </Card>
          ))}
        </View>
      ) : null}
      {tables.map((table) => (
        <View key={table.title}>
          <SectionTitle>{table.title}</SectionTitle>
          {table.rows.map((row, index) => (
            <Card key={`${table.title}-${index}`}>
              {Object.entries(row).map(([key, value]) => (
                <View key={key} style={styles.rowBetween}>
                  <InlineLabel>{key}</InlineLabel>
                  <Text style={[styles.metaText, { flex: 1, textAlign: "right", marginLeft: 12 }]}>{displayValue(value === null || value === undefined ? null : String(value))}</Text>
                </View>
              ))}
            </Card>
          ))}
        </View>
      ))}
      {!tables.length && !loading ? <EmptyBlock label="Submit the form to load cross-check results." /> : null}
    </Screen>
  );
}

export function ItTicketsScreen() {
  const { apiFetch } = useAuth();
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [commentByTicket, setCommentByTicket] = useState<Record<string, string>>({});
  const [commentAttachments, setCommentAttachments] = useState<Record<string, TicketAttachmentInput[]>>({});
  const [form, setForm] = useState({
    title: "",
    category: "",
    priority: "medium" as TicketRecord["priority"],
    description: "",
  });
  const [formAttachments, setFormAttachments] = useState<TicketAttachmentInput[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/it-tickets");
      if (!response.ok) throw new Error((await response.text()) || "Failed to load tickets");
      const json = await response.json();
      setTickets(Array.isArray(json.items) ? json.items : []);
    } catch (error) {
      Alert.alert("IT Tickets", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const addFormImage = async (source: "library" | "camera") => {
    const attachment = await pickTicketImage(source);
    if (attachment) setFormAttachments((current) => [...current, attachment].slice(0, 5));
  };

  const addCommentImage = async (ticketId: string, source: "library" | "camera") => {
    const attachment = await pickTicketImage(source);
    if (attachment) {
      setCommentAttachments((current) => ({
        ...current,
        [ticketId]: [...(current[ticketId] ?? []), attachment].slice(0, 5),
      }));
    }
  };

  const submit = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      Alert.alert("IT Tickets", "Title and description are required.");
      return;
    }
    setSaving(true);
    try {
      const response = await apiFetch("/api/it-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, attachments: formAttachments }),
      });
      if (!response.ok) throw new Error((await response.text()) || "Failed to submit ticket");
      setForm({ title: "", category: "", priority: "medium", description: "" });
      setFormAttachments([]);
      await load();
    } catch (error) {
      Alert.alert("IT Tickets", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const addComment = async (ticketId: string) => {
    const body = commentByTicket[ticketId]?.trim();
    const attachments = commentAttachments[ticketId] ?? [];
    if (!body && !attachments.length) return;
    setSaving(true);
    try {
      const response = await apiFetch(`/api/it-tickets/${encodeURIComponent(ticketId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, attachments }),
      });
      if (!response.ok) throw new Error((await response.text()) || "Failed to add comment");
      setCommentByTicket((current) => ({ ...current, [ticketId]: "" }));
      setCommentAttachments((current) => ({ ...current, [ticketId]: [] }));
      await load();
    } catch (error) {
      Alert.alert("IT Tickets", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="IT Tickets" subtitle="Submit requests and follow replies from IT." right={<AppButton label={loading ? "Refreshing..." : "Refresh"} onPress={() => void load()} disabled={loading || saving} />}>
      <Card>
        <SectionTitle>Submit Ticket</SectionTitle>
        <Field label="Title">
          <AppInput value={form.title} onChangeText={(value) => setForm((current) => ({ ...current, title: value }))} />
        </Field>
        <Field label="Category">
          <AppInput value={form.category} onChangeText={(value) => setForm((current) => ({ ...current, category: value }))} placeholder="Hardware, software, access..." />
        </Field>
        <Field label="Priority">
          <Picker selectedValue={form.priority} style={styles.picker} dropdownIconColor={theme.colors.text} onValueChange={(value) => setForm((current) => ({ ...current, priority: value }))}>
            {ticketPriorities.map((priority) => <Picker.Item key={priority} label={priority} value={priority} />)}
          </Picker>
        </Field>
        <Field label="Description">
          <AppInput value={form.description} onChangeText={(value) => setForm((current) => ({ ...current, description: value }))} multiline />
        </Field>
        <View style={styles.row}>
          <AppButton label="File" onPress={() => void addFormImage("library")} style={{ flex: 1 }} />
          <AppButton label="Camera" onPress={() => void addFormImage("camera")} style={{ flex: 1 }} />
        </View>
        <AttachmentStrip attachments={formAttachments} />
        <AppButton label={saving ? "Saving..." : "Submit Ticket"} onPress={() => void submit()} variant="primary" disabled={saving} />
      </Card>

      {loading ? <LoadingBlock label="Loading tickets..." /> : null}
      {tickets.map((ticket) => (
        <Card key={ticket.id}>
          <View style={styles.listItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{ticket.title}</Text>
              <Text style={styles.metaText}>{ticket.category || "Uncategorized"} | {ticket.priority} | Updated {formatDate(ticket.updated_at)}</Text>
            </View>
            <Badge label={ticket.status} tone={ticketStatusTone(ticket.status)} />
          </View>
          <Text style={[styles.metaText, { marginTop: 10 }]}>{ticket.description}</Text>
          <AttachmentStrip attachments={ticket.attachments} />
          {(ticket.comments ?? []).map((comment) => (
            <View key={comment.id} style={styles.ticketComment}>
              <Text style={styles.metaText}>{comment.author_name || comment.author_upn} | {formatDate(comment.created_at)}</Text>
              <Text style={styles.itemTitle}>{comment.body}</Text>
              <AttachmentStrip attachments={comment.attachments} />
            </View>
          ))}
          <Field label="Follow-up">
            <AppInput value={commentByTicket[ticket.id] ?? ""} onChangeText={(value) => setCommentByTicket((current) => ({ ...current, [ticket.id]: value }))} placeholder="Add a comment" multiline />
          </Field>
          <View style={styles.row}>
            <AppButton label="File" onPress={() => void addCommentImage(ticket.id, "library")} style={{ flex: 1 }} />
            <AppButton label="Camera" onPress={() => void addCommentImage(ticket.id, "camera")} style={{ flex: 1 }} />
            <AppButton label="Send" onPress={() => void addComment(ticket.id)} variant="primary" disabled={saving || (!commentByTicket[ticket.id]?.trim() && !commentAttachments[ticket.id]?.length)} style={{ flex: 1 }} />
          </View>
          <AttachmentStrip attachments={commentAttachments[ticket.id]} />
        </Card>
      ))}
      {!tickets.length && !loading ? <EmptyBlock label="No tickets submitted yet." /> : null}
    </Screen>
  );
}

export function ItTicketsAdminScreen() {
  const { apiFetch } = useAuth();
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "closed" | "all" | "archived">("active");
  const [drafts, setDrafts] = useState<Record<string, {
    status: TicketRecord["status"];
    priority: TicketRecord["priority"];
    assignedToUpn: string;
    visibility: "public" | "internal";
    comment: string;
    attachments: TicketAttachmentInput[];
  }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/it-tickets/admin");
      if (!response.ok) throw new Error((await response.text()) || "Failed to load tickets");
      const json = await response.json();
      const items = Array.isArray(json.items) ? json.items as TicketRecord[] : [];
      setTickets(items);
      setDrafts((current) => {
        const next = { ...current };
        for (const ticket of items) {
          next[ticket.id] ??= {
            status: ticket.status,
            priority: ticket.priority,
            assignedToUpn: ticket.assigned_to_upn ?? "",
            visibility: "public",
            comment: "",
            attachments: [],
          };
        }
        return next;
      });
    } catch (error) {
      Alert.alert("IT Tickets Admin", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDraft = (ticketId: string, values: Partial<(typeof drafts)[string]>) => {
    setDrafts((current) => ({ ...current, [ticketId]: { ...current[ticketId], ...values } }));
  };

  const addAdminImage = async (ticketId: string, source: "library" | "camera") => {
    const attachment = await pickTicketImage(source);
    if (attachment) {
      const current = drafts[ticketId]?.attachments ?? [];
      updateDraft(ticketId, { attachments: [...current, attachment].slice(0, 5) });
    }
  };

  const save = async (ticket: TicketRecord) => {
    const draft = drafts[ticket.id];
    if (!draft) return;
    setSavingId(ticket.id);
    try {
      const response = await apiFetch("/api/it-tickets/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, ...draft }),
      });
      if (!response.ok) throw new Error((await response.text()) || "Failed to save ticket");
      updateDraft(ticket.id, { comment: "", attachments: [] });
      await load();
    } catch (error) {
      Alert.alert("IT Tickets Admin", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSavingId(null);
    }
  };

  const setArchived = async (ticket: TicketRecord, archived: boolean) => {
    setSavingId(ticket.id);
    try {
      const response = await apiFetch("/api/it-tickets/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ticket.id,
          status: ticket.status,
          priority: ticket.priority,
          assignedToUpn: ticket.assigned_to_upn,
          archived,
        }),
      });
      if (!response.ok) throw new Error((await response.text()) || "Failed to update ticket archive");
      await load();
    } catch (error) {
      Alert.alert("IT Tickets Admin", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSavingId(null);
    }
  };

  const filteredTickets = useMemo(() => {
    if (filter === "archived") return tickets.filter((ticket) => Boolean(ticket.archived_at));
    const current = tickets.filter((ticket) => !ticket.archived_at);
    if (filter === "all") return current;
    if (filter === "closed") return current.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed");
    return current.filter((ticket) => ticket.status !== "resolved" && ticket.status !== "closed");
  }, [filter, tickets]);

  return (
    <Screen title="IT Tickets Admin" subtitle="Review tickets, update status, and reply with attachments." right={<AppButton label={loading ? "Refreshing..." : "Refresh"} onPress={() => void load()} disabled={loading} />}>
      <Card>
        <View style={styles.row}>
          {(["active", "closed", "all", "archived"] as const).map((option) => (
            <AppButton key={option} label={option} onPress={() => setFilter(option)} variant={filter === option ? "primary" : "default"} style={{ flex: 1 }} />
          ))}
        </View>
      </Card>
      {loading ? <LoadingBlock label="Loading tickets..." /> : null}
      {filteredTickets.map((ticket) => {
        const draft = drafts[ticket.id] ?? {
          status: ticket.status,
          priority: ticket.priority,
          assignedToUpn: ticket.assigned_to_upn ?? "",
          visibility: "public" as const,
          comment: "",
          attachments: [],
        };
        return (
          <Card key={ticket.id}>
            <View style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{ticket.title}</Text>
                <Text style={styles.metaText}>{ticket.requester_name || ticket.requester_upn} | {formatDate(ticket.created_at)}</Text>
              </View>
              <Badge label={ticket.status} tone={ticketStatusTone(ticket.status)} />
            </View>
            <Text style={[styles.metaText, { marginTop: 10 }]}>{ticket.description}</Text>
            <AttachmentStrip attachments={ticket.attachments} />
            <Field label="Status">
              <Picker selectedValue={draft.status} style={styles.picker} dropdownIconColor={theme.colors.text} onValueChange={(value) => updateDraft(ticket.id, { status: value })}>
                {ticketStatuses.map((status) => <Picker.Item key={status} label={status} value={status} />)}
              </Picker>
            </Field>
            <Field label="Priority">
              <Picker selectedValue={draft.priority} style={styles.picker} dropdownIconColor={theme.colors.text} onValueChange={(value) => updateDraft(ticket.id, { priority: value })}>
                {ticketPriorities.map((priority) => <Picker.Item key={priority} label={priority} value={priority} />)}
              </Picker>
            </Field>
            <Field label="Assigned To UPN">
              <AppInput value={draft.assignedToUpn} onChangeText={(value) => updateDraft(ticket.id, { assignedToUpn: value })} />
            </Field>
            <Field label="Comment Visibility">
              <Picker selectedValue={draft.visibility} style={styles.picker} dropdownIconColor={theme.colors.text} onValueChange={(value) => updateDraft(ticket.id, { visibility: value })}>
                <Picker.Item label="public" value="public" />
                <Picker.Item label="internal" value="internal" />
              </Picker>
            </Field>
            <Field label="Follow-up Comment">
              <AppInput value={draft.comment} onChangeText={(value) => updateDraft(ticket.id, { comment: value })} multiline />
            </Field>
            <View style={styles.row}>
              <AppButton label="File" onPress={() => void addAdminImage(ticket.id, "library")} style={{ flex: 1 }} />
              <AppButton label="Camera" onPress={() => void addAdminImage(ticket.id, "camera")} style={{ flex: 1 }} />
              <AppButton label={savingId === ticket.id ? "Saving..." : "Save"} onPress={() => void save(ticket)} variant="primary" disabled={savingId === ticket.id} style={{ flex: 1 }} />
            </View>
            <AppButton label={ticket.archived_at ? "Restore Ticket" : "Archive Ticket"} onPress={() => void setArchived(ticket, !ticket.archived_at)} disabled={savingId === ticket.id} style={{ marginTop: 10 }} />
            <AttachmentStrip attachments={draft.attachments} />
            {(ticket.comments ?? []).map((comment) => (
              <View key={comment.id} style={styles.ticketComment}>
                <Text style={styles.metaText}>{comment.author_name || comment.author_upn} | {comment.visibility} | {formatDate(comment.created_at)}</Text>
                <Text style={styles.itemTitle}>{comment.body}</Text>
                <AttachmentStrip attachments={comment.attachments} />
              </View>
            ))}
          </Card>
        );
      })}
      {!filteredTickets.length && !loading ? <EmptyBlock label="No tickets in this view." /> : null}
    </Screen>
  );
}

export function UserAccessScreen() {
  const { apiFetch, reloadAccess, session } = useAuth();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [access, setAccess] = useState<Record<AppModuleKey, boolean>>(getDefaultModuleAccess);
  const [accessLevel, setAccessLevel] = useState<Record<AppModuleKey, ModuleAccessLevel>>(getDefaultModuleAccessLevels);
  const [assetGroupAccess, setAssetGroupAccess] = useState<string[]>([...assetGroups]);
  const [allEmployees, setAllEmployees] = useState(false);
  const [bulkChanges, setBulkChanges] = useState<Partial<Record<AppModuleKey, ModuleAccessLevel>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (allEmployees) {
      setUsers([]);
      return;
    }
    if (!search.trim()) {
      setUsers(selectedUser ? [selectedUser] : []);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ top: "50", search: search.trim() });
        const response = await apiFetch(`/api/user-access/users?${params.toString()}`);
        if (!response.ok) throw new Error((await response.text()) || "Failed to search users");
        const json = await response.json();
        setUsers(Array.isArray(json.items) ? json.items : []);
      } catch (error) {
        Alert.alert("User Access", error instanceof Error ? error.message : "Unknown error");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [allEmployees, apiFetch, search, selectedUser]);

  const loadAccess = async (user: UserRecord) => {
    const response = await apiFetch(`/api/user-access?userPrincipalName=${encodeURIComponent(user.userPrincipalName)}`);
    if (!response.ok) {
      Alert.alert("User Access", (await response.text()) || "Failed to load access");
      return;
    }
    const json = await response.json();
    const missingModules = getMissingModuleKeys(json.access);
    if (missingModules.includes("it-tickets") || missingModules.includes("it-tickets-admin")) {
      Alert.alert(
        "User Access",
        "The backend did not return the IT ticketing access keys. Deploy the updated web backend before enabling these modules from mobile.",
      );
    }
    setAccess(normalizeModuleAccess(json.access));
    setAccessLevel(normalizeModuleAccessLevels(json.accessLevel, json.access));
    setAssetGroupAccess(getAssetGroupsFromApi(json.assetGroups));
  };

  const save = async () => {
    if (!selectedUser && !allEmployees) return;
    const bulkAssetsEnabled = allEmployees && bulkChanges.assets && bulkChanges.assets !== "none";
    if ((allEmployees ? bulkAssetsEnabled : access.assets) && assetGroupAccess.length === 0) {
      Alert.alert("User Access", "Select at least one asset group.");
      return;
    }
    setSaving(true);
    const response = await apiFetch("/api/user-access", {
      method: allEmployees ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(allEmployees
        ? { changes: bulkChanges, assetGroups: assetGroupAccess }
        : {
          userPrincipalName: selectedUser!.userPrincipalName,
          displayName: selectedUser!.displayName,
          access,
          accessLevel,
          assetGroups: assetGroupAccess,
        }),
    });
    if (!response.ok) {
      Alert.alert("User Access", (await response.text()) || "Failed to save access");
      setSaving(false);
      return;
    }
    const json = await response.json();
    if (allEmployees) {
      setBulkChanges({});
      setSaving(false);
      Alert.alert("User Access", `Updated ${json.updatedModules ?? 0} modules for ${json.updatedUsers ?? 0} employees`);
      return;
    }
    const missingModules = getMissingModuleKeys(json.access);
    if (missingModules.includes("it-tickets") || missingModules.includes("it-tickets-admin")) {
      Alert.alert(
        "User Access",
        "Access was saved by the backend, but the backend did not return the IT ticketing access keys. Deploy the updated web backend before enabling these modules from mobile.",
      );
      setSaving(false);
      return;
    }
    setAccess(normalizeModuleAccess(json.access));
    setAccessLevel(normalizeModuleAccessLevels(json.accessLevel, json.access));
    setAssetGroupAccess(getAssetGroupsFromApi(json.assetGroups));
    if (session?.upn.trim().toLowerCase() === selectedUser!.userPrincipalName.trim().toLowerCase()) {
      await reloadAccess();
    }
    setSaving(false);
    Alert.alert("User Access", "User access saved");
  };

  return (
    <Screen title="User Access" subtitle="Search a user and update the module matrix from mobile.">
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.itemTitle}>Manage all employees</Text>
          <Switch value={allEmployees} onValueChange={(value) => { setAllEmployees(value); setBulkChanges({}); }} />
        </View>
        <Field label="Search users">
          <AppInput value={search} onChangeText={setSearch} placeholder="Search by name or exact UPN" editable={!allEmployees} />
        </Field>
        {users.map((user) => (
          <Pressable
            key={user.id}
            onPress={() => {
              setSelectedUser(user);
              setSearch(user.displayName || user.userPrincipalName);
              void loadAccess(user);
            }}
          >
            <View style={styles.userLookupRow}>
              <Text style={styles.itemTitle}>{user.displayName || user.userPrincipalName}</Text>
              <Text style={styles.metaText}>{user.userPrincipalName}</Text>
            </View>
          </Pressable>
        ))}
      </Card>

      {selectedUser || allEmployees ? (
        <Card>
          <SectionTitle>{allEmployees ? "All active employees" : selectedUser!.displayName || selectedUser!.userPrincipalName}</SectionTitle>
          {!allEmployees ? (
            <View style={styles.row}>
              {(["read", "modify", "none"] as ModuleAccessLevel[]).map((level) => (
                <AppButton key={level} label={level === "none" ? "Clear all" : `${level} all`} onPress={() => {
                  setAccess(Object.fromEntries(appModules.map((module) => [module.key, level !== "none"])) as Record<AppModuleKey, boolean>);
                  setAccessLevel(Object.fromEntries(appModules.map((module) => [module.key, level])) as Record<AppModuleKey, ModuleAccessLevel>);
                  setAssetGroupAccess(level === "none" ? [] : [...assetGroups]);
                }} style={{ flex: 1 }} />
              ))}
            </View>
          ) : <Text style={styles.metaText}>Only selected modules change; all others keep their current access.</Text>}
          {appModules.map((module) => (
            <View key={module.key}>
              <View style={styles.rowBetween}>
                <Text style={styles.itemTitle}>{module.label}</Text>
                {allEmployees ? (
                  <Picker selectedValue={bulkChanges[module.key] ?? "unchanged"} style={[styles.picker, { width: 150 }]} dropdownIconColor={theme.colors.text} onValueChange={(value) => {
                    setBulkChanges((current) => {
                      const next = { ...current };
                      if (value === "unchanged") delete next[module.key];
                      else next[module.key] = value as ModuleAccessLevel;
                      return next;
                    });
                    if (module.key === "assets" && value !== "none" && value !== "unchanged") setAssetGroupAccess([...assetGroups]);
                  }}>
                    <Picker.Item label="No change" value="unchanged" />
                    <Picker.Item label="None" value="none" />
                    <Picker.Item label="Read" value="read" />
                    <Picker.Item label="Modify" value="modify" />
                  </Picker>
                ) : <AccessLevelPicker
                  value={accessLevel[module.key]}
                  onChange={(value) => {
                    setAccessLevel((current) => ({ ...current, [module.key]: value }));
                    setAccess((current) => ({ ...current, [module.key]: value !== "none" }));
                    if (module.key === "assets") {
                      setAssetGroupAccess(value !== "none" ? [...assetGroups] : []);
                    }
                  }}
                />}
              </View>
              {module.key === "assets" && (allEmployees ? bulkChanges.assets && bulkChanges.assets !== "none" : access.assets) ? (
                <View style={styles.accessGroupBox}>
                  <Text style={styles.metaText}>Asset groups</Text>
                  {assetGroups.map((group) => (
                    <View key={group} style={styles.rowBetween}>
                      <Text style={styles.metaText}>{group}</Text>
                      <Switch
                        value={assetGroupAccess.includes(group)}
                        onValueChange={(value) => {
                          setAssetGroupAccess((current) => {
                            if (value) return current.includes(group) ? current : [...current, group];
                            return current.filter((item) => item !== group);
                          });
                        }}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
          {(allEmployees ? bulkChanges.assets && bulkChanges.assets !== "none" : access.assets) && !assetGroupAccess.length ? (
            <Text style={[styles.metaText, { marginTop: 8 }]}>Select at least one asset group.</Text>
          ) : null}
          <AppButton label={saving ? "Saving..." : allEmployees ? "Apply to all employees" : "Save Access"} onPress={() => void save()} variant="primary" disabled={saving || (allEmployees && !Object.keys(bulkChanges).length) || Boolean((allEmployees ? bulkChanges.assets && bulkChanges.assets !== "none" : access.assets) && !assetGroupAccess.length)} style={{ marginTop: 12 }} />
        </Card>
      ) : null}
    </Screen>
  );
}

export function SettingsScreen() {
  const { apiFetch } = useAuth();
  const [settings, setSettings] = useState<{ connected: boolean; reports: { id: string; name: string }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/api/settings/mssql");
      if (!response.ok) throw new Error((await response.text()) || "Could not check attendance connection.");
      setSettings((await response.json()).settings);
    } catch (error) {
      setSettings(null);
      setError(error instanceof Error ? error.message : "Could not check attendance connection.");
    } finally { setLoading(false); }
  }, [apiFetch]);
  useEffect(() => { void load(); }, [load]);

  return (
    <Screen title="Settings" subtitle="Attendance connection and available reports.">
      <Card>
        <SectionTitle>Attendance service</SectionTitle>
        <Text style={styles.itemTitle}>{loading ? "Checking connection..." : settings?.connected ? "Connected" : "Not connected"}</Text>
        {error ? <Text accessibilityRole="alert" style={styles.metaText}>{error}</Text> : null}
        <Text style={styles.metaText}>IT manages database access and report definitions on the internal attendance server. Contact IT to request changes.</Text>
        <AppButton label={loading ? "Checking..." : "Check connection"} onPress={() => void load()} disabled={loading} variant="primary" />
      </Card>
      <Card>
        <SectionTitle>Available reports</SectionTitle>
        {settings?.reports.map((report) => <Text key={report.id} style={styles.itemTitle}>{report.name}</Text>)}
        {!settings?.reports.length ? <Text style={styles.metaText}>Connect to the attendance service to load reports.</Text> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loginLogo: { maxWidth: 300, height: 160, alignSelf: "center", marginBottom: 6 },
  heroText: { color: "rgba(255,255,255,0.78)", lineHeight: 22 },
  titleText: { color: theme.colors.text, fontSize: 30, fontWeight: "700", marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  row: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 6 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  itemTitle: { color: theme.colors.text, fontSize: 16, fontWeight: "600" },
  metaText: { color: "rgba(255,255,255,0.66)", lineHeight: 20 },
  listItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  accessGroupBox: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.14)", gap: 8, marginTop: 10, paddingTop: 10 },
  accessLevelPicker: { flexDirection: "row", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", borderRadius: 8, overflow: "hidden" },
  accessLevelOption: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.05)" },
  accessLevelOptionActive: { backgroundColor: "rgba(14,3,219,0.45)" },
  accessLevelText: { color: "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: "600" },
  accessLevelTextActive: { color: theme.colors.text },
  bigNumber: { color: theme.colors.text, fontSize: 34, fontWeight: "700", marginVertical: 8 },
  departmentRow: { gap: 10, marginTop: 12 },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999, backgroundColor: "rgba(14,3,219,0.8)" },
  picker: { color: theme.colors.text, backgroundColor: theme.colors.glassStrong },
  userLookupRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.12)", paddingVertical: 10 },
  attachmentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingVertical: 8 },
  attachmentItem: { width: 104, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: theme.colors.glassStrong },
  attachmentImage: { width: 104, height: 78 },
  attachmentName: { color: "rgba(255,255,255,0.72)", fontSize: 11, paddingHorizontal: 6, paddingVertical: 5 },
  ticketComment: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.12)", gap: 6, marginTop: 12, paddingTop: 12 },
});
