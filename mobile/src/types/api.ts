/**
 * Self-service-relevant slice of the web client's type surface
 * (client/src/types/api.ts), ported deliberately — not shared via a
 * workspace package, see the mobile build plan for why. Keep these in sync
 * manually if the corresponding backend response shapes change.
 */

export type Nullable<T> = T | null;

export interface Paginated<T> {
  data: T[];
  links: { first: string | null; last: string | null; prev: string | null; next: string | null };
  meta: { current_page: number; from: number | null; last_page: number; per_page: number; to: number | null; total: number; path?: string };
}

/** Raw LengthAwarePaginator::toArray() shape — the payroll controllers paginate without a Resource class. */
export interface LaravelPage<T> {
  data: T[];
  current_page: number;
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}

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
  localization: { timezone: string; date_format: string; time_format: string; currency: string; country: string };
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
  is_platform_admin: boolean;
  modules: EntitledModule[];
  has_manager_scope: boolean;
}

export interface LoginResponse extends SessionPayload {
  token: string;
  token_type: 'Bearer';
}

export type EmployeeStatus = 'draft' | 'invited' | 'onboarding' | 'active' | 'suspended' | 'exited';
export type ConfirmationStatus = 'not_applicable' | 'probation' | 'confirmed';
export type ProfileCompletionStatus = 'pending' | 'submitted' | 'approved' | 'changes_requested';
export type DocumentSignatureMethod = 'none' | 'acknowledge' | 'signed_copy';

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

export interface ProfileActivity {
  id: number;
  type: string;
  title: string;
  description: string | null;
  actor?: { id: number; name: string } | null;
  created_at: string;
}

/** Response shape of GET /employee-profile/overview. */
export interface EmployeeProfileOverview {
  employee: Employee;
  profile: EmployeeProfileSummary | null;
  emergency_contacts: EmergencyContact[];
  dependents: Dependent[];
  documents: EmployeeDocument[];
  custom_fields: unknown[];
  status_history: EmployeeStatusHistoryEntry[];
  reporting_history: unknown[];
  activities: ProfileActivity[];
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
  department?: LookupRef | null;
  unit?: LookupRef | null;
  cluster?: LookupRef | null;
  designation?: LookupRef | null;
  grade_level?: LookupRef | null;
  employment_type?: LookupRef | null;
  location?: LookupRef | null;
  profile?: EmployeeProfileSummary | null;
  invited_at: string | null;
  onboarding_completed_at: string | null;
  activated_at: string | null;
  probation_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveType {
  id: number;
  name: string;
  code: string;
  is_paid?: boolean;
  requires_attachment?: boolean;
  restricted_to_gender?: 'male' | 'female' | null;
}

export interface LeavePeriod {
  id: number;
  organization_id: number;
  name: string;
  starts_on: string;
  ends_on: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeaveHoliday {
  id: number;
  organization_id: number;
  organization_location_id: number | null;
  name: string;
  date: string;
  is_recurring: boolean;
  is_active: boolean;
  location: LookupRef | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: number;
  employee_id: number;
  handover_to_employee_id: number | null;
  leave_type_id: number;
  starts_on: string;
  ends_on: string;
  total_days: number;
  status: string;
  reason: string | null;
  handover_note: string | null;
  evidence_file_name: string | null;
  evidence_mime_type: string | null;
  evidence_file_size: number | null;
  evidence_download_url: string | null;
  handover_file_name: string | null;
  handover_mime_type: string | null;
  handover_file_size: number | null;
  handover_download_url: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  leave_type?: LookupRef | null;
  employee?: EmployeeSummary | null;
  handover_to?: EmployeeSummary | null;
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

export interface ManagerDashboardScope {
  type: 'department' | 'cluster' | 'direct_reports';
  department?: LookupRef;
  cluster?: LookupRef;
  source: string;
}

/**
 * A deliberate SUBSET of what `GET /dashboard/manager` actually returns
 * (server/app/Services/DashboardService.php:90-174, verified directly) — the full
 * response also includes `composition`, `recent.new_joiners`, `recent.profile_updates`,
 * and `people.members`/`people.direct_reports`, each carrying individual employee
 * names/details. Those are intentionally NOT typed here: Phase B's "Team at a glance"
 * card is a read-only aggregate summary, never a roster, so there is no code path that
 * could accidentally render an individual employee's details from this type — enforced
 * by the type itself, not just by what the screen happens to render.
 *
 * `leave`/`attendance` here are READ AS-IS from the endpoint: `pending_requests` and
 * `corrections_pending` are current-state counts (safe to show at any time), but
 * `present`/`late`/`absent`/`days_pending`/`days_approved` are all-time cumulative — the
 * backend methods computing them take no date range at all — so this type still
 * declares them (for completeness/future use) even though the Phase B UI deliberately
 * does not display them, to avoid presenting an all-time total as if it meant "today."
 */
export interface ManagerDashboard {
  scope: ManagerDashboardScope;
  employees: {
    total: number;
    active: number;
    draft: number;
    invited: number;
    onboarding: number;
    suspended: number;
    exited: number;
  };
  team_health: {
    profiles_pending: number;
    profiles_submitted: number;
    profiles_approved: number;
    incomplete_profiles: number;
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
  pending_actions: { key: string; label: string }[];
  leave: {
    pending_requests: number;
    approved_requests: number;
    balances: { leave_type: LookupRef; days_allocated: number; days_used: number; days_pending: number; days_available: number }[];
    handover_assignments: {
      id: number;
      status: string;
      starts_on: string | null;
      ends_on: string | null;
      total_days: number;
      handover_note: string | null;
      handover_file_name: string | null;
      handover_download_url: string | null;
      employee: EmployeeSummary;
      leave_type: LookupRef | null;
    }[];
  } | null;
  attendance: {
    trend: { label: string; value: number; status: string }[];
    range: { date_from: string; date_to: string };
    corrections_pending: number;
    this_month: { present: number; late: number; absent: number; total_hours: number };
  } | null;
  document_compliance: {
    requirement: { id: number; name: string; document_type: string };
    state: 'missing' | 'expired' | 'expiring_soon' | 'pending_acknowledgment' | 'awaiting_signature' | 'rejected' | 'changes_requested';
    expires_at: string | null;
    document_id: number | null;
  }[];
  next_holiday: { name: string; date: string; days_away: number } | null;
  tenure: { years_of_service: number; next_anniversary: string; days_until_anniversary: number } | null;
}

export type PayFrequency = 'weekly' | 'biweekly' | 'monthly';
export type PayrollComponentType = 'earning' | 'deduction' | 'employer_contribution';
export type PayrollRunStatus = 'draft' | 'calculated' | 'pending_approval' | 'approved' | 'rejected' | 'finalized' | 'voided';
export type PayrollRunItemStatus = 'calculated' | 'exception';

export interface PayGroup {
  id: number;
  name: string;
  frequency: PayFrequency;
}

export interface EmployeeCompensation {
  id: number;
  organization_id: number;
  employee_id: number;
  pay_group_id: number | null;
  base_salary: string;
  currency: string;
  pay_frequency: PayFrequency;
  recurring_components: { component_id: number; value: number | null }[] | null;
  effective_from: string;
  effective_to: string | null;
  status: 'active' | 'scheduled' | 'superseded';
  pay_group?: PayGroup | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeBankAccount {
  id: number;
  bank_name: string;
  bank_code: string | null;
  account_name: string;
  account_number_last_four: string;
  is_primary: boolean;
  verification_status: string;
  verified_at?: string | null;
}

export interface EmployeeStatutoryProfile {
  id: number;
  employee_id: number;
  paye_enabled: boolean;
  tax_state: string | null;
  tax_id_last_four: string | null;
  pension_enabled: boolean;
  pfa_name: string | null;
  rsa_pin_last_four: string | null;
  nhf_enabled: boolean;
  nhf_number_last_four: string | null;
  reliefs: { name: string; annual_amount: number }[] | null;
  exemptions: unknown[] | null;
}

export interface MyCompensationResponse {
  compensations: EmployeeCompensation[];
  bank_accounts: EmployeeBankAccount[];
  statutory_profile: EmployeeStatutoryProfile;
}

export interface PayrollRunItemLine {
  id: number;
  payroll_run_item_id: number;
  payroll_component_id: number | null;
  component_code: string;
  component_name: string;
  type: PayrollComponentType;
  quantity: string | null;
  rate: string | null;
  amount: string;
  is_taxable: boolean;
  is_statutory: boolean;
}

export interface PayrollRunItem {
  id: number;
  organization_id: number;
  payroll_run_id: number;
  employee_id: number;
  employee_number: string;
  employee_name: string;
  employment_snapshot: { department: string | null; designation: string | null; grade_level: string | null; employment_type: string | null; location: string | null } | null;
  bank_snapshot: { bank_name: string; bank_code: string | null; account_name: string; account_number_last_four: string; verification_status: string } | null;
  period_days: number;
  payable_days: number;
  base_pay: string;
  gross_pay: string;
  total_deductions: string;
  net_pay: string;
  employer_contributions: string;
  status: PayrollRunItemStatus;
  exceptions: { code: string; message: string }[] | null;
  lines?: PayrollRunItemLine[];
  payroll_run?: { id: number; name: string; reference: string; period_start: string; period_end: string; payment_date: string; currency: string; published_at: string | null } | null;
}

export interface TicketResolver {
  id: number;
  name: string;
  email: string;
  department: { id: number; name: string } | null;
}

export interface TicketCategory {
  id: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
}

export interface TicketComment {
  id: number;
  ticket_id: number;
  user: { id: number; name: string; email: string } | null;
  comment: string;
  visibility: string;
  attachment_file_name: string | null;
  attachment_mime_type: string | null;
  attachment_download_url: string | null;
  created_at: string;
}

export interface Ticket {
  id: number;
  employee_id: number;
  category: { id: number; name: string; code: string } | null;
  department: { id: number; name: string; code: string | null } | null;
  subject: string;
  description: string;
  status: string;
  priority: string;
  attachment_file_name: string | null;
  attachment_mime_type: string | null;
  attachment_download_url: string | null;
  submitted_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  assigned_to: { id: number; name: string; email: string } | null;
  comments?: TicketComment[];
  created_at: string;
  updated_at: string;
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
  scope: { department_id: number | null; viewer_department_id: number | null };
}

export interface CompanyEvent {
  id: number;
  title: string;
  description: string | null;
  starts_on: string;
  ends_on: string;
  scope: 'department' | 'organization';
  department: { id: number; code: string | null; name: string } | null;
}

export interface Asset {
  id: number;
  name: string;
  asset_tag: string;
  serial_number: string | null;
  category: { id: number; name: string; code: string } | null;
  status: string;
  condition: string | null;
  assigned_at: string | null;
  location: { id: number; code: string | null; name: string } | null;
  warranty_expires_at: string | null;
  notes: string | null;
}

export interface LifestylePreferences {
  appreciation_notifications: boolean;
  share_birthday: boolean;
  share_anniversary: boolean;
  receive_appreciation: boolean;
  allow_shared_appreciation: boolean;
}

export interface LifestyleFeatures {
  milestones_enabled: boolean;
  appreciation_enabled: boolean;
}

export interface LifestylePreferencesResponse {
  preferences: LifestylePreferences;
  features: LifestyleFeatures;
}

export interface Milestone {
  employee: { id: number; name: string };
  type: 'birthday' | 'anniversary';
  date: string;
  years_of_service?: number;
}

export interface AppreciationRecipient {
  id: number;
  name: string;
  allow_shared_appreciation: boolean;
}

export interface Appreciation {
  id: number;
  sender: { id: number; name: string };
  recipient: { id: number; name: string };
  message: string;
  visibility: 'private' | 'shared';
  created_at: string;
}

export interface NotificationEntry {
  id: string;
  type: string;
  category: string | null;
  event: string | null;
  severity: 'info' | 'success' | 'warning' | 'danger' | string;
  title: string | null;
  message: string | null;
  action_label: string | null;
  action_url: string | null;
  entity_type: string | null;
  entity_id: number | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}
