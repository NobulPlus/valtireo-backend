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
  photo_url: string | null;
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
    short_name: string | null;
    welcome_message: string;
    support_email: string | null;
  };
  theme: {
    mode: 'light' | 'dark' | 'system';
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
  /** Platform-console authority — independent of organization/role entirely. */
  is_platform_admin: boolean;
  modules: EntitledModule[];
  has_manager_scope: boolean;
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
  | 'suspended'
  | 'exited';

/** Whether an active employee has cleared probation — independent of employment status. */
export type ConfirmationStatus = 'not_applicable' | 'probation' | 'confirmed';

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
  cluster_id: number | null;
  designation_id: number | null;
  grade_level_id: number | null;
  employment_type_id: number | null;
  organization_location_id: number | null;
  reporting_manager_id: number | null;
  start_date: string | null;
  status: EmployeeStatus;
  confirmation_status: ConfirmationStatus;
  pending_role_id?: number | null;
  department?: LookupRef | null;
  unit?: LookupRef | null;
  cluster?: LookupRef | null;
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
  probation_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmergencyContact {
  id: number;
  name: string;
  relationship: string | null;
  phone: string;
  alternate_phone?: string | null;
  email: string | null;
  address: string | null;
  is_primary: boolean;
}

export interface Dependent {
  id: number;
  name: string;
  relationship: string;
  date_of_birth: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  is_beneficiary: boolean;
}

export type DocumentSignatureMethod = 'none' | 'acknowledge' | 'signed_copy';

export interface EmployeeDocument {
  id: number;
  title: string;
  status: string;
  expires_at: string | null;
  issued_at?: string | null;
  notes?: string | null;
  file_name?: string;
  download_url?: string;
  view_url?: string;
  mime_type?: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  acknowledged_at?: string | null;
  replaces_document_id?: number | null;
  document_type?: (LookupRef & { requires_expiry_date?: boolean; signature_method?: DocumentSignatureMethod }) | null;
}

export interface EmployeeStatusHistoryEntry {
  id: number;
  previous_status?: string | null;
  new_status: string;
  previous_confirmation_status?: string | null;
  new_confirmation_status?: string | null;
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

export type EmployeeCustomFieldType = 'text' | 'textarea' | 'number' | 'date' | 'boolean' | 'select' | 'multi_select';

export interface EmployeeCustomFieldDefinition {
  id: number;
  name: string;
  key: string;
  type: EmployeeCustomFieldType;
  options: string[] | null;
  is_required: boolean;
  visible_to_employee: boolean;
  editable_by_employee: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface EmployeeCustomFieldValue {
  id: number;
  employee_id: number;
  employee_custom_field_id: number;
  field: EmployeeCustomFieldDefinition;
  value: string | number | boolean | string[] | null;
  updated_by?: { id: number; name: string; email: string } | null;
  created_at: string;
  updated_at: string;
}

/** Response shape of GET /employee-profile/overview (and the HR-side /employees/:id/profile-overview). */
export interface EmployeeProfileOverview {
  employee: Employee;
  profile: EmployeeProfileSummary | null;
  emergency_contacts: EmergencyContact[];
  dependents: Dependent[];
  documents: EmployeeDocument[];
  custom_fields: EmployeeCustomFieldValue[];
  status_history: EmployeeStatusHistoryEntry[];
  reporting_history: EmployeeReportingHistoryEntry[];
  activities: ProfileActivity[];
}

export interface LeaveType {
  id: number;
  name: string;
  code: string;
  is_paid?: boolean;
  requires_attachment?: boolean;
}

export interface LeaveRequest {
  id: number;
  employee_id: number;
  leave_type_id: number;
  starts_on: string;
  ends_on: string;
  total_days: number;
  status: string;
  reason: string | null;
  evidence_file_name: string | null;
  evidence_mime_type: string | null;
  evidence_file_size: number | null;
  evidence_download_url: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  leave_type?: LookupRef | null;
  created_at: string;
  updated_at: string;
}

export interface TicketCategory {
  id: number;
  organization_id: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  response_sla_hours: number | null;
  resolution_sla_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: number;
  organization_id: number;
  name: string;
  asset_tag: string;
  category: string;
  status: string;
  assigned_to: { id: number; employee_number: string; full_name: string } | null;
  assigned_at: string | null;
  notes: string | null;
  tickets?: Array<{ id: number; subject: string; status: string; submitted_at: string | null }>;
  created_at: string;
  updated_at: string;
}

export interface TicketComment {
  id: number;
  ticket_id: number;
  user: { id: number; name: string; email: string } | null;
  comment: string;
  visibility: string;
  attachment_file_name: string | null;
  attachment_mime_type: string | null;
  attachment_file_size: number | null;
  attachment_download_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketActivity {
  id: number;
  event: string;
  previous_status: string | null;
  new_status: string | null;
  visibility: string;
  note: string | null;
  metadata: Record<string, unknown> | null;
  actor: { id: number; name: string; email: string } | null;
  created_at: string;
}

export interface TicketWatcher {
  id: number;
  user: { id: number; name: string; email: string } | null;
  created_at: string;
}

export interface Ticket {
  id: number;
  employee_id: number;
  requested_by_id: number | null;
  employee?: { id: number; employee_number: string; full_name: string; work_email: string };
  category: { id: number; name: string; code: string } | null;
  asset: { id: number; name: string; asset_tag: string } | null;
  department: { id: number; name: string; code: string | null } | null;
  subject: string;
  description: string;
  status: string;
  priority: string;
  escalation_level: number;
  escalated_at: string | null;
  sla_due_at: string | null;
  attachment_file_name: string | null;
  attachment_mime_type: string | null;
  attachment_file_size: number | null;
  attachment_download_url: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  first_responded_at: string | null;
  resolved_at: string | null;
  on_hold_at: string | null;
  hold_reason: string | null;
  closed_at: string | null;
  satisfaction_rating: number | null;
  satisfaction_comment: string | null;
  assigned_to: { id: number; name: string; email: string } | null;
  comments?: TicketComment[];
  activities?: TicketActivity[];
  watchers?: TicketWatcher[];
  approval_requests?: ApprovalRequest[];
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: number;
  employee_id: number;
  attendance_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  duration_minutes: number | null;
  source: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceCorrectionRequest {
  id: number;
  attendance_record_id: number;
  original_check_in_at: string | null;
  original_check_out_at: string | null;
  requested_check_in_at: string | null;
  requested_check_out_at: string | null;
  status: string;
  reason: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalDecision {
  id: number;
  actor?: { id: number; name: string; email: string } | null;
  action: string;
  previous_status: string | null;
  next_status: string;
  note: string | null;
  created_at: string;
}

export interface ApprovalRequest {
  id: number;
  requester?: { id: number; name: string; email: string } | null;
  subject_employee?: { id: number; employee_number: string; full_name: string; work_email: string } | null;
  approvable_type: string;
  approvable_id: number;
  module: string;
  action: string;
  title: string;
  status: string;
  current_step_order: number | null;
  submitted_at: string | null;
  completed_at: string | null;
  decisions?: ApprovalDecision[];
  document?: { id: number; title: string; file_name: string; mime_type: string | null; download_url: string; view_url: string } | null;
  leave_request?: {
    id: number;
    evidence_file_name: string | null;
    evidence_mime_type: string | null;
    evidence_file_size: number | null;
    evidence_download_url: string | null;
  } | null;
  ticket?: {
    id: number;
    category: { id: number; name: string; code: string } | null;
    subject: string;
    description: string;
    attachment_file_name: string | null;
    attachment_mime_type: string | null;
    attachment_download_url: string | null;
  } | null;
  created_at: string;
  updated_at: string;
}

export type ApproverType = 'permission' | 'role' | 'direct_manager' | 'department_head';

export interface ApprovalWorkflowStep {
  id: number;
  approval_workflow_id: number;
  step_order: number;
  name: string;
  approver_type: ApproverType;
  approver_role_id: number | null;
  approver_role: { id: number; name: string } | null;
  approver_permission: string | null;
  note_required: boolean;
  is_active: boolean;
}

export interface ApprovalWorkflow {
  id: number;
  organization_id: number;
  module: string;
  action: string;
  name: string;
  description: string | null;
  is_active: boolean;
  require_note_on_reject: boolean;
  require_note_on_request_changes: boolean;
  auto_approve_when_no_steps: boolean;
  steps: ApprovalWorkflowStep[];
  created_at: string;
  updated_at: string;
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
  cluster_id?: number | null;
  designation_id: number;
  grade_level_id?: number | null;
  employment_type_id: number;
  organization_location_id: number;
  reporting_manager_id?: number | null;
  start_date?: string | null;
  pending_role_id?: number | null;
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

export interface AssignableRoleOption {
  value: string;
  label: string;
}

export interface ClusterLookup {
  id: number;
  organization_id: number;
  department_id: number;
  code: string | null;
  name: string;
  description: string | null;
  department?: { id: number; code: string | null; name: string };
  locations?: Array<{ id: number; code: string | null; name: string }>;
}

export interface AllSetupLookups {
  departments: DepartmentLookup[];
  units: UnitLookup[];
  designations: DesignationLookup[];
  grade_levels: GradeLevelLookup[];
  employment_types: EmploymentTypeLookup[];
  locations: LocationLookup[];
  clusters: ClusterLookup[];
  assignable_roles: AssignableRoleOption[];
}

/* ---------------------------------------------------------------------- */
/* Roles & permissions                                                    */
/* ---------------------------------------------------------------------- */

export interface Role {
  id: number;
  /** Internal bootstrapping identifier for the seeded starter roles (e.g. "organization_admin") — never shown as-is in the UI, never meaningful for authorization. Null for any custom role an organization creates. */
  key: string | null;
  name: string;
  description: string | null;
  permissions: string[];
  user_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: number;
  /** Immutable code key (e.g. "employees.view_department") — never editable from this page. */
  name: string;
  label: string | null;
  description: string | null;
  group: string | null;
}

/* ---------------------------------------------------------------------- */
/* Audit & activity                                                       */
/* ---------------------------------------------------------------------- */

/** Pagination envelope shared by the audit-logs/activity-feed endpoints — same shape as `Paginated<T>['meta']`, minus the link URLs those endpoints don't return. */
export interface SimplePage<T> {
  data: T[];
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
  };
}

export interface AuditLogEntry {
  id: number;
  event: string;
  auditable_type: string;
  auditable_class: string;
  auditable_id: number;
  user: { id: number; name: string; email: string } | null;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  url: string | null;
  ip_address: string | null;
  user_agent: string | null;
  tags: string | null;
  created_at: string;
}

export interface ActivityFeedEntry {
  id: number;
  event: string;
  title: string;
  description: string | null;
  employee: {
    id: number;
    employee_number: string;
    full_name: string;
    department: { id: number; name: string; code: string | null } | null;
  };
  actor: { id: number; name: string; email: string } | null;
  subject_type: string | null;
  subject_class: string | null;
  subject_id: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
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
  is_primary?: boolean;
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
  label: string;
  date_from: string;
  date_to: string;
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

export interface OrgChartNode {
  id: number;
  full_name: string;
  employee_number: string;
  work_email: string;
  department: LookupRef | null;
  designation: string | null;
  reporting_manager_id: number | null;
  role_name: string | null;
  has_login: boolean;
  is_department_head: boolean;
}

export interface EmployeeDirectoryEntry {
  id: number;
  full_name: string;
  employee_number: string;
  work_email: string;
  phone: string | null;
  department: LookupRef | null;
  unit: LookupRef | null;
  designation: string | null;
  location: string | null;
}

export interface EmployeeDirectoryResponse extends Paginated<EmployeeDirectoryEntry> {
  scope: {
    department_id: number | null;
    viewer_department_id: number | null;
  };
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
  approvals: {
    pending: number;
    needs_attention: number;
  };
  service_desk: {
    open: number;
    unassigned: number;
    sla_breached: number;
  };
  leave: {
    pending: number;
    upcoming: number;
  };
  attendance: {
    present: number;
    late: number;
    absent: number;
  };
  documents: {
    missing: number;
    expiring_soon: number;
    expired: number;
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

export interface ManagerDashboardScope {
  type: 'department' | 'direct_reports';
  department?: LookupRef;
  source: string;
}

export interface ManagerDashboard {
  scope: ManagerDashboardScope;
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
    trend: Array<{ label: string; value: number; status: string }>;
    range: { date_from: string; date_to: string };
    corrections_pending: number;
    this_month: {
      present: number;
      late: number;
      absent: number;
      total_hours: number;
    };
  } | null;
  document_compliance: Array<{
    requirement: { id: number; name: string; document_type: string };
    state: 'missing' | 'expired' | 'expiring_soon' | 'pending_acknowledgment' | 'awaiting_signature' | 'rejected' | 'changes_requested';
    expires_at: string | null;
    document_id: number | null;
  }>;
  next_holiday: { name: string; date: string; days_away: number } | null;
  tenure: {
    years_of_service: number;
    next_anniversary: string;
    days_until_anniversary: number;
  } | null;
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

export interface PlatformModuleCatalogEntry {
  id: number;
  key: string;
  name: string;
  description: string | null;
  category: string | null;
}

export interface ProvisionOrganizationPayload {
  organization: {
    name: string;
    code: string;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    sector?: string | null;
    country: string;
    state?: string | null;
    city?: string | null;
    address?: string | null;
  };
  admin: {
    name: string;
    email: string;
  };
  modules: string[];
}

export interface ProvisionOrganizationResponse {
  organization: Organization;
  main_location: {
    id: number;
    code: string | null;
    name: string;
    type: string | null;
    is_primary: boolean;
  };
  admin: CurrentUser;
  modules: Array<{ id: number; key: string; name: string; category: string | null }>;
  workspace: WorkspaceSettings;
  invitation: {
    email: string;
    temporary_password: string;
    login_hint: string;
    delivery_status: string;
  };
  created_by: { id: number; name: string; email: string };
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
    description: string | null;
    category: string | null;
    status: 'active' | 'trial' | 'suspended' | 'locked';
    starts_at: string | null;
    expires_at: string | null;
    subscription_id: number | null;
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
