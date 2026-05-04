export const appModules = [
  { key: "dashboard", label: "Dashboard" },
  { key: "users", label: "Users" },
  { key: "bulk", label: "Bulk" },
  { key: "orgchart", label: "Org Chart" },
  { key: "hr", label: "HR" },
  { key: "attendance", label: "Attendance" },
  { key: "assets", label: "Assets Management" },
  { key: "it-tickets", label: "IT Tickets" },
  { key: "it-tickets-admin", label: "IT Tickets Admin" },
  { key: "user-access", label: "User Access" },
  { key: "settings", label: "Settings" },
] as const;

export type AppModuleKey = (typeof appModules)[number]["key"];
export type ModuleAccessLevel = "none" | "read" | "modify";

export function getDefaultModuleAccess(): Record<AppModuleKey, boolean> {
  return Object.fromEntries(appModules.map((module) => [module.key, false])) as Record<AppModuleKey, boolean>;
}

export function getDefaultModuleAccessLevels(): Record<AppModuleKey, ModuleAccessLevel> {
  return Object.fromEntries(appModules.map((module) => [module.key, "none"])) as Record<AppModuleKey, ModuleAccessLevel>;
}

export function normalizeModuleAccess(access?: Partial<Record<AppModuleKey, boolean>> | null): Record<AppModuleKey, boolean> {
  const defaults = getDefaultModuleAccess();
  if (!access) return defaults;

  return Object.fromEntries(
    appModules.map((module) => [module.key, Boolean(access[module.key])]),
  ) as Record<AppModuleKey, boolean>;
}

export function normalizeModuleAccessLevels(
  accessLevel?: Partial<Record<AppModuleKey, ModuleAccessLevel>> | null,
  access?: Partial<Record<AppModuleKey, boolean>> | null,
): Record<AppModuleKey, ModuleAccessLevel> {
  return Object.fromEntries(
    appModules.map((module) => {
      const level = accessLevel?.[module.key];
      if (level === "read" || level === "modify") return [module.key, level];
      return [module.key, access?.[module.key] ? "modify" : "none"];
    }),
  ) as Record<AppModuleKey, ModuleAccessLevel>;
}

export function getMissingModuleKeys(access?: Partial<Record<AppModuleKey, boolean>> | null) {
  if (!access) return appModules.map((module) => module.key);
  return appModules
    .map((module) => module.key)
    .filter((moduleKey) => !(moduleKey in access));
}

export type UserRecord = {
  id: string;
  userPrincipalName: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
  employeeId?: string;
  employeeType?: string;
  usageLocation?: string;
  accountEnabled?: boolean;
};

export type UsersSyncResult = {
  fetched: number;
  upserted: number;
  pages: number;
  syncedAt: string;
};

export type AssetRecord = {
  id: string;
  asset_tag: string;
  name: string;
  asset_group?: string | null;
  asset_type: string;
  status: string;
  quantity?: number | null;
  location?: string | null;
  serial_number?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  notes?: string | null;
  created_at: string;
  assigned_user?: {
    azure_user_id?: string | null;
    id?: string;
    user_principal_name: string;
    display_name?: string | null;
    given_name?: string | null;
    surname?: string | null;
    department?: string | null;
    job_title?: string | null;
    office_location?: string | null;
    mobile_phone?: string | null;
    employee_id?: string | null;
    employee_type?: string | null;
    usage_location?: string | null;
    account_enabled?: boolean | null;
    last_synced_at?: string | null;
  } | null;
};

export type Metrics = {
  totals: { employees: number; active: number; disabled: number; guests: number };
  departments: { name: string; count: number; active: number; disabled: number }[];
  generatedAt: string;
  recentRuns: {
    id: string;
    actorUpn: string;
    createdAt: string;
    dryRun: boolean;
    total: number;
    changed: number;
    failed: number;
  }[];
};

export type AttendanceResponse = {
  rows: Record<string, unknown>[];
  columns: string[];
  fetchedAt: string;
  limit: number;
  queryUsed?: string;
  source?: string;
  report?: { id: string; name: string };
  availableReports?: { id: string; name: string }[];
};

export type TicketAttachmentInput = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
};

export type TicketAttachment = {
  id: string;
  ticket_id: string;
  comment_id?: string | null;
  file_name: string;
  mime_type: string;
  data_url: string;
  created_at: string;
};

export type TicketComment = {
  id: string;
  ticket_id: string;
  author_upn: string;
  author_name?: string | null;
  visibility: "public" | "internal";
  body: string;
  created_at: string;
  attachments?: TicketAttachment[];
};

export type TicketRecord = {
  id: string;
  title: string;
  description: string;
  category?: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in-progress" | "waiting-user" | "resolved" | "closed";
  requester_upn: string;
  requester_name?: string | null;
  assigned_to_upn?: string | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  comments?: TicketComment[];
  attachments?: TicketAttachment[];
};

export type AssetFormState = {
  assetTag: string;
  name: string;
  assetGroup: string;
  assetType: string;
  status: string;
  quantity: string;
  location: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  notes: string;
};
