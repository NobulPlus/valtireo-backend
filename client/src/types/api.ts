/**
 * Shared API types.
 *
 * These mirror the Laravel API Resources and Service response shapes in
 * server/app/Http/Resources and server/app/Services, read directly from the
 * backend source during the frontend handoff. Keep these in sync if the
 * backend response shapes change during integration (see the handoff guide,
 * section 17: "FE and BE lock endpoint contracts before visual polish").
 */

export type Nullable<T> = T | null;

/** Laravel-style paginator envelope used by most list endpoints. */
export interface Paginated<T> {
  data: T[];
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
    path?: string;
  };
}

/** Laravel validation error envelope (422 responses). */
export interface ValidationErrorResponse {
  message: string;
  errors: Record<string, string[]>;
}

export interface LookupRef {
  id: number;
  code: string | null;
  name: string;
}

export interface CurrentUser {
  id: number;
  organization_id: number | null;
  name: string;
  email: string;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: number;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  sector: string | null;
  status: string;
  city: string | null;
  state: string | null;
  country: string | null;
}

export interface WorkspaceSettings {
  organization_id: number;
  workspace_name: string;
  workspace_code: string;
  identity: {
    logo_url: string | null;
    favicon_url: string | null;
    login_background_url: string | null;
    welcome_message: string;
    support_email: string | null;
  };
  theme: {
    mode: 'light' | 'dark';
    primary_color: string;
    accent_color: string;
    sidebar_color: string;
    button_color: string;
    font_family: string;
    radius: string;
    density: string;
  };
  localization: {
    timezone: string;
    date_format: string;
    time_format: string;
    currency: string;
    country: string;
  };
  employee_experience: {
    show_org_chart: boolean;
    allow_profile_corrections: boolean;
    allow_employee_directory: boolean;
    dashboard_widgets: string[];
    required_profile_fields: string[];
    onboarding_checklist: string[];
  };
}

export type ModuleAccessLevel = 'none' | 'view' | 'manage' | 'self';
export type ModuleVisibility = 'locked' | 'enabled' | 'hidden';

export interface EntitledModule {
  key: string;
  name: string;
  description: string | null;
  category: string | null;
  subscription_status: string;
  is_subscribed: boolean;
  can_access: boolean;
  access: ModuleAccessLevel;
  visibility: ModuleVisibility;
  sort_order: number;
  settings: Record<string, unknown>;
  organization_id: number;
}

/** The full session/bootstrap payload returned by login and /auth/me. */
export interface SessionPayload {
  user: CurrentUser;
  organization: Organization | null;
  workspace: WorkspaceSettings | null;
  roles: string[];
  permissions: string[];
  modules: EntitledModule[];
}

export interface LoginResponse extends SessionPayload {
  token: string;
  token_type: 'Bearer';
}

export interface SetupChecklistItem {
  key: string;
  section?: string;
  label: string;
  description?: string;
  completed: boolean;
  required?: boolean;
  priority?: number;
  status?: 'complete' | 'required' | 'recommended' | string;
  action?: {
    label: string;
    url: string;
  };
  meta?: Record<string, unknown>;
  href?: string;
}

export interface SetupChecklist {
  organization: {
    id: number;
    name: string;
    code: string;
    status: string;
  };
  status: string;
  summary: {
    required_completed: number;
    required_total: number;
    required_percentage: number;
    recommended_completed: number;
    recommended_total: number;
    recommended_percentage: number;
    total_completed: number;
    total_items: number;
  };
  modules: string[];
  sections: Array<{
    key: string;
    label: string;
    completed: number;
    total: number;
    items: SetupChecklistItem[];
  }>;
  next_actions: SetupChecklistItem[];
}

/* ---------------------------------------------------------------------- */
/* Employees                                                               */
/* ---------------------------------------------------------------------- */

export type EmployeeStatus =
  | 'draft'
  | 'invited'
  | 'onboarding'
  | 'active'
  | 'probation'
  | 'confirmed'
  | 'suspended'
  | 'exited';

export type ProfileCompletionStatus = 'pending' | 'submitted' | 'approved' | 'changes_requested';

export interface EmployeeInvitationSummary {
  id: number;
  email: string;
  status: string;
  expires_at: string | null;
  accepted_at: string | null;
  created_at?: string;
}

export interface EmployeeProfileSummary {
  id: number;
  employee_id?: number;
  date_of_birth?: string | null;
  gender?: string | null;
  personal_email?: string | null;
  residential_address?: string | null;
  next_of_kin_name?: string | null;
  next_of_kin_phone?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  passport_photo_path?: string | null;
  passport_photo_url?: string | null;
  completion_status: ProfileCompletionStatus;
  created_at?: string;
  updated_at?: string;
}

export interface Employee {
  id: number;
  organization_id: number;
  user_id: number | null;
  employee_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  full_name: string;
  work_email: string;
  phone: string | null;
  department_id: number | null;
  unit_id: number | null;
  designation_id: number | null;
  grade_level_id: number | null;
  employment_type_id: number | null;
  organization_location_id: number | null;
  reporting_manager_id: number | null;
  start_date: string | null;
  status: EmployeeStatus;
  department?: LookupRef | null;
  unit?: LookupRef | null;
  designation?: LookupRef | null;
  grade_level?: LookupRef | null;
  employment_type?: LookupRef | null;
  location?: LookupRef | null;
  profile?: EmployeeProfileSummary | null;
  user?: { id: number; name: string; email: string; roles?: string[] } | null;
  invitations?: EmployeeInvitationSummary[];
  emergency_contacts?: EmergencyContact[];
  dependents?: Dependent[];
  documents?: EmployeeDocument[];
  custom_fields?: unknown[];
  status_history?: EmployeeStatusHistoryEntry[];
  reporting_history?: EmployeeReportingHistoryEntry[];
  activities?: ProfileActivity[];
  invited_at: string | null;
  onboarding_completed_at: string | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmergencyContact {
  id: number;
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  address: string | null;
  is_primary: boolean;
}

export interface Dependent {
  id: number;
  name: string;
  relationship: string;
  date_of_birth: string | null;
  is_beneficiary: boolean;
}

export interface EmployeeDocument {
  id: number;
  title: string;
  status: string;
  expires_at: string | null;
  document_type?: LookupRef | null;
}

export interface EmployeeStatusHistoryEntry {
  id: number;
  previous_status?: string | null;
  new_status: string;
  effective_date: string;
  reason: string | null;
  note: string | null;
  changed_by?: { id: number; name: string } | null;
  created_at: string;
}

export interface EmployeeReportingHistoryEntry {
  id: number;
  previous_manager?: { id: number; full_name: string } | null;
  new_manager?: { id: number; full_name: string } | null;
  effective_date: string;
  changed_by?: { id: number; name: string } | null;
  created_at: string;
}

export interface ProfileActivity {
  id: number;
  type: string;
  title: string;
  description: string | null;
  actor?: { id: number; name: string } | null;
  created_at: string;
}

export interface CreateEmployeePayload {
  employee_number: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  work_email: string;
  phone?: string | null;
  department_id: number;
  unit_id?: number | null;
  designation_id: number;
  grade_level_id?: number | null;
  employment_type_id: number;
  organization_location_id: number;
  reporting_manager_id?: number | null;
  start_date?: string | null;
  send_invitation?: boolean;
}

export interface CreateEmployeeResponse {
  employee: Employee;
  invitation: {
    id: number;
    email: string;
    status: string;
    expires_at: string | null;
    token: string;
  } | null;
}

/* ---------------------------------------------------------------------- */
/* Setup lookups                                                          */
/* ---------------------------------------------------------------------- */

export interface DepartmentLookup {
  id: number;
  parent_id: number | null;
  code: string | null;
  name: string;
  description: string | null;
}

export interface UnitLookup {
  id: number;
  organization_id: number;
  department_id: number;
  code: string | null;
  name: string;
  description: string | null;
  department?: { id: number; code: string | null; name: string };
}

export interface DesignationLookup {
  id: number;
  code: string | null;
  name: string;
  description: string | null;
}

export interface GradeLevelLookup {
  id: number;
  code: string | null;
  name: string;
  rank: number;
  description: string | null;
}

export interface EmploymentTypeLookup {
  id: number;
  code: string | null;
  name: string;
  description: string | null;
}

export interface LocationLookup {
  id: number;
  code: string | null;
  name: string;
  type: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  is_primary: boolean;
}

export interface AllSetupLookups {
  departments: DepartmentLookup[];
  units: UnitLookup[];
  designations: DesignationLookup[];
  grade_levels: GradeLevelLookup[];
  employment_types: EmploymentTypeLookup[];
  locations: LocationLookup[];
}

/* ---------------------------------------------------------------------- */
/* Dashboards                                                             */
/* ---------------------------------------------------------------------- */

export interface EmployeeCountBreakdown {
  total: number;
  active: number;
  draft: number;
  invited: number;
  onboarding: number;
  suspended: number;
  exited: number;
}

export interface LookupCount {
  id: number;
  code: string | null;
  name: string;
  total: number;
}

export interface StatusCount {
  status: string;
  total: number;
}

export interface OnboardingTrendEntry {
  key: string;
  label: string;
  created: number;
  invited: number;
  submitted: number;
  activated: number;
  completion_rate: number;
}

export interface OnboardingTrend {
  grain: 'month' | 'day';
  year: number;
  month: number | null;
  label: string;
  date_from: string;
  date_to: string;
  available_years: number[];
  available_months: Array<{ value: number; label: string }>;
  entries: OnboardingTrendEntry[];
}

export interface EmployeeSummary {
  id: number;
  employee_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  work_email: string;
  department: LookupRef | null;
  location: LookupRef | null;
  phone?: string | null;
  status?: string;
  start_date?: string | null;
  invited_at?: string | null;
  onboarding_completed_at?: string | null;
  activated_at?: string | null;
}

export interface OrganizationDashboard {
  filters: Record<string, unknown>;
  employees: EmployeeCountBreakdown;
  onboarding: {
    pending_profiles: number;
    submitted_profiles: number;
    approved_profiles: number;
    pending_invitations: number;
    accepted_invitations: number;
    expired_invitations: number;
  };
  structure: {
    departments: number;
    units: number;
    locations: number;
    designations: number;
    grade_levels: number;
    employment_types: number;
  };
  modules: {
    available: number;
    active: number;
    locked: number;
  };
  breakdowns: {
    by_department: LookupCount[];
    by_location: LookupCount[];
    by_employment_type: LookupCount[];
    by_designation: LookupCount[];
    by_status: StatusCount[];
  };
  trends: {
    onboarding: OnboardingTrend;
  };
  recent: {
    employees: EmployeeSummary[];
    invitations: Array<{
      id: number;
      email: string;
      status: string;
      expires_at: string | null;
      accepted_at: string | null;
      employee: EmployeeSummary | null;
    }>;
  };
  setup_completion: {
    completed: number;
    total: number;
    percentage: number;
    items: Record<string, boolean>;
  };
}

export interface ManagerDashboard {
  scope: Record<string, unknown>;
  filters: Record<string, unknown>;
  employees: EmployeeCountBreakdown;
  team_health: {
    profiles_pending: number;
    profiles_submitted: number;
    profiles_approved: number;
    incomplete_profiles: number;
  };
  composition: {
    by_designation: LookupCount[];
    by_employment_type: LookupCount[];
    by_location: LookupCount[];
    by_status: StatusCount[];
  };
  recent: {
    new_joiners: EmployeeSummary[];
    profile_updates: Array<{
      id: number;
      completion_status: string;
      updated_at: string;
      employee: EmployeeSummary | null;
    }>;
  };
  people: {
    members: EmployeeSummary[];
    direct_reports: EmployeeSummary[];
  };
  leave: {
    available: boolean;
    pending_requests: number;
    approved_requests: number;
    rejected_requests: number;
    days_pending: number;
    days_approved: number;
  };
  attendance: {
    available: boolean;
    present: number;
    late: number;
    absent: number;
    corrections_pending: number;
    duration_minutes: number;
  };
}

export interface MyDashboard {
  employee: EmployeeSummary | null;
  organization: { id: number; name: string; code: string; status: string } | null;
  work: {
    department: LookupRef | null;
    unit: LookupRef | null;
    designation: LookupRef | null;
    grade_level: LookupRef | null;
    employment_type: LookupRef | null;
    location: LookupRef | null;
    reporting_manager: EmployeeSummary | null;
  } | null;
  profile: {
    id: number;
    completion_status: ProfileCompletionStatus;
    passport_photo_path?: string | null;
    passport_photo_url?: string | null;
    updated_at: string;
  } | null;
  pending_actions: Array<{ key: string; label: string }>;
  leave: {
    pending_requests: number;
    approved_requests: number;
    balances: Array<{
      leave_type: LookupRef;
      days_allocated: number;
      days_used: number;
      days_pending: number;
      days_available: number;
    }>;
  } | null;
  attendance: {
    recent_records: unknown[];
    corrections_pending: number;
  } | null;
  modules: EntitledModule[];
}

/* ---------------------------------------------------------------------- */
/* Platform admin                                                          */
/* ---------------------------------------------------------------------- */

export interface PlatformOrganizationSummary {
  id: number;
  name: string;
  code: string;
  status: string;
  country: string | null;
  users_count: number;
  employees_count: number;
  modules_count: number;
  created_at: string;
}

export interface PlatformDashboard {
  filters: {
    date_from: string | null;
    date_to: string | null;
    status: string | null;
    search: string | null;
  };
  summary: {
    organizations_total: number;
    organizations_active: number;
    organizations_invited: number;
    organizations_setup: number;
    organizations_suspended: number;
    users_total: number;
    employees_total: number;
    pending_invitations: number;
    pending_documents: number;
    pending_leave_requests: number;
  };
  organizations_by_status: Array<{ status: string; total: number }>;
  module_adoption: Array<{
    key: string;
    name: string;
    category: string | null;
    active_organizations: number;
  }>;
  recent_organizations: PlatformOrganizationSummary[];
  attention: {
    setup_incomplete: number;
    without_modules: number;
    without_admins: number;
  };
  attention_details: {
    setup_incomplete: PlatformOrganizationSummary[];
    without_modules: PlatformOrganizationSummary[];
    without_admins: PlatformOrganizationSummary[];
  };
}

export interface PlatformOrganizationDetail {
  organization: PlatformOrganizationSummary & {
    email: string | null;
    phone: string | null;
    website: string | null;
    sector: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    updated_at: string;
  };
  workspace: WorkspaceSettings;
  metrics: {
    users: number;
    employees: number;
    active_employees: number;
    pending_invitations: number;
    departments: number;
    locations: number;
    document_requirements: number;
    pending_documents: number;
    leave_requests_pending: number;
    attendance_records: number;
  };
  modules: Array<{
    id: number;
    key: string | null;
    name: string | null;
    category: string | null;
    status: string;
    starts_at: string | null;
    expires_at: string | null;
  }>;
  admins: Array<{
    id: number;
    name: string;
    email: string;
    created_at: string;
  }>;
  locations: Array<{
    id: number;
    code: string | null;
    name: string;
    type: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    is_primary: boolean;
    is_active: boolean;
  }>;
}
