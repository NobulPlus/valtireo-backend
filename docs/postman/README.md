# Valtireo Postman Handoff

This folder contains importable Postman assets for the Valtireo backend HR MVP.

## Files

- `valtireo-api.postman_collection.json`
- `valtireo-local.postman_environment.json`

## Import Order

1. Import `valtireo-local.postman_environment.json`.
2. Import `valtireo-api.postman_collection.json`.
3. Select the `Valtireo Local` environment in Postman.
4. Confirm `base_url` is correct:

```text
http://127.0.0.1:8000/api
```

5. Run `Auth / Login Admin`.
6. Confirm the `auth_token` environment variable is populated.

## Local Admin Login

```json
{
  "email": "admin@valtireo.test",
  "password": "Password1!"
}
```

## Recommended Testing Order

1. Health
2. Auth
3. Workspace and setup checklist
4. Setup lookups
5. Dashboard
6. Employees
7. Employee self-service
8. Documents and compliance
9. Approvals
10. Leave
11. Attendance
12. Templates and imports
13. Reports and exports
14. Notifications
15. Audit and activity

## Important Variables

Update these from API responses while testing:

| Variable | Meaning |
| --- | --- |
| `auth_token` | Bearer token from login |
| `employee_id` | Employee primary key |
| `employee_number` | Employee number such as `EMP-FIN-001` |
| `department_id` | Department primary key |
| `unit_id` | Unit primary key |
| `designation_id` | Designation primary key |
| `grade_level_id` | Grade level primary key |
| `employment_type_id` | Employment type primary key |
| `organization_location_id` | Location primary key |
| `document_type_id` | Document type primary key |
| `document_requirement_id` | Document requirement primary key |
| `leave_type_id` | Leave type primary key |
| `leave_period_id` | Leave period primary key |
| `work_shift_id` | Work shift primary key |
| `approval_request_id` | Approval request primary key |
| `notification_id` | Database notification UUID |
| `invitation_token` | Employee invitation token from employee creation response |

## Auth Notes

Most endpoints require:

```text
Authorization: Bearer {{auth_token}}
```

The collection sets bearer auth at collection level. Login and invitation acceptance use no auth.

## CSV Import Testing

Use:

- `GET /templates`
- `GET /templates/{key}/download`
- `POST /templates/{key}/preview`
- `POST /templates/{key}/import`

Supported template keys:

- `attendance_import`
- `employee_import`
- `leave_entitlement_import`
- `document_requirement_import`

For preview/import requests, use form-data:

| Key | Type |
| --- | --- |
| `file` | File |

## Report Keys

Use:

```text
GET /reports/{key}
GET /reports/{key}/export
```

Supported report keys:

- `employee_directory`
- `document_compliance`
- `leave_balances`
- `leave_requests`
- `attendance_summary`
- `attendance_exceptions`

Exports return CSV and honor the active filters/sorting.

## Notification Testing

Notification endpoints:

- `GET /notifications`
- `GET /notifications/unread-count`
- `PATCH /notifications/{notification}/read`
- `PATCH /notifications/read-all`

Notification filters:

- `status=unread`
- `status=read`
- `category=approvals`
- `category=employee_onboarding`
- `event=approval.submitted`

Reminder command:

```bash
php artisan valtireo:send-reminders
```

Options:

```bash
php artisan valtireo:send-reminders --document-days=30 --onboarding-days=2 --approval-days=1
```

## Audit Testing

Audit endpoints:

- `GET /audit-logs`
- `GET /activity-feed`

Example filters:

```text
GET /audit-logs?event=updated&auditable_type=department
GET /activity-feed?employee_id={{employee_id}}
GET /activity-feed?department_id={{department_id}}
```

## Endpoint Matrix

### Health

- `GET /health`

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`

### Platform

- `POST /platform/organizations`

### Workspace and Setup

- `GET /workspace`
- `PATCH /workspace/settings`
- `GET /setup/checklist`
- `GET /setup/lookups`
- `GET /setup/departments`
- `GET /setup/units`
- `GET /setup/designations`
- `GET /setup/grade-levels`
- `GET /setup/employment-types`
- `GET /setup/locations`

### Dashboards

- `GET /dashboard/organization`
- `GET /dashboard/manager`
- `GET /dashboard/me`

### Employees

- `GET /employees`
- `GET /employees/export`
- `POST /employees`
- `GET /employees/{employee}`
- `PATCH /employees/{employee}/approve-onboarding`
- `PATCH /me/employee-profile`
- `POST /employee-invitations/{token}/accept`
- `GET /employees/{employee}/profile-overview`
- `GET /employees/{employee}/profile-activities`
- `GET /employees/{employee}/custom-field-values`
- `PUT /employees/{employee}/custom-field-values`
- `GET /employees/{employee}/status-history`
- `POST /employees/{employee}/status-history`
- `GET /employees/{employee}/reporting-history`
- `POST /employees/{employee}/reporting-history`

### Employee Self-Service

- `GET /employee-profile/overview`
- `GET /employee-profile/activities`
- `GET /employee-profile/custom-fields`
- `POST /employee-profile/custom-fields`
- `GET /employee-profile/custom-fields/{customField}`
- `PATCH /employee-profile/custom-fields/{customField}`
- `GET /employee-profile/custom-field-values`
- `PUT /employee-profile/custom-field-values`
- `GET /employee-profile/emergency-contacts`
- `POST /employee-profile/emergency-contacts`
- `PATCH /employee-profile/emergency-contacts/{emergencyContact}`
- `DELETE /employee-profile/emergency-contacts/{emergencyContact}`
- `GET /employee-profile/dependents`
- `POST /employee-profile/dependents`
- `PATCH /employee-profile/dependents/{dependent}`
- `DELETE /employee-profile/dependents/{dependent}`

### Documents and Compliance

- `GET /documents/types`
- `POST /documents/types`
- `GET /documents/types/{documentType}`
- `PATCH /documents/types/{documentType}`
- `GET /documents/requirements`
- `POST /documents/requirements`
- `GET /documents/requirements/{documentRequirement}`
- `GET /documents/compliance`
- `GET /documents`
- `POST /documents`
- `GET /documents/{employeeDocument}`
- `PATCH /documents/{employeeDocument}/review`

### Approvals

- `GET /approval-workflows`
- `POST /approval-workflows`
- `GET /approval-workflows/{approvalWorkflow}`
- `PATCH /approval-workflows/{approvalWorkflow}`
- `GET /approvals`
- `GET /approvals/{approvalRequest}`
- `POST /approvals/{approvalRequest}/actions`

### Leave

- `GET /leave/types`
- `POST /leave/types`
- `GET /leave/periods`
- `POST /leave/periods`
- `GET /leave/holidays`
- `POST /leave/holidays`
- `GET /leave/entitlements`
- `POST /leave/entitlements`
- `GET /leave/requests`
- `POST /leave/requests`
- `GET /leave/requests/{leaveRequest}`
- `PATCH /leave/requests/{leaveRequest}/cancel`

### Attendance

- `GET /attendance/settings`
- `PATCH /attendance/settings`
- `GET /attendance/shifts`
- `POST /attendance/shifts`
- `GET /attendance/records`
- `POST /attendance/records`
- `GET /attendance/records/{attendanceRecord}`
- `GET /attendance/corrections`
- `POST /attendance/corrections`
- `GET /attendance/corrections/{attendanceCorrection}`

### Templates and Imports

- `GET /templates`
- `GET /templates/{key}/download`
- `POST /templates/{key}/preview`
- `POST /templates/{key}/import`

### Reports

- `GET /reports`
- `GET /reports/{key}`
- `GET /reports/{key}/export`

### Notifications

- `GET /notifications`
- `GET /notifications/unread-count`
- `PATCH /notifications/read-all`
- `PATCH /notifications/{notification}/read`

### Audit and Activity

- `GET /audit-logs`
- `GET /activity-feed`

