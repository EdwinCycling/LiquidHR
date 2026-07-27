# Supporting Tables

<cite>
**Referenced Files in This Document**
- [20260718121308_add_settings_modules_work_patterns_holidays.sql](file://apps/hr-suite/supabase/migrations/20260718121308_add_settings_modules_work_patterns_holidays.sql)
- [20260718122138_harden_settings_rosters_holidays.sql](file://apps/hr-suite/supabase/migrations/20260718122138_harden_settings_rosters_holidays.sql)
- [20260718122614_enforce_optional_module_guards.sql](file://apps/hr-suite/supabase/migrations/20260718122614_enforce_optional_module_guards.sql)
- [20260718122751_expose_module_state_to_tenant_users.sql](file://apps/hr-suite/supabase/migrations/20260718122751_expose_module_state_to_tenant_users.sql)
- [20260718123742_add_holiday_snapshot_import.sql](file://apps/hr-suite/supabase/migrations/20260718123742_add_holiday_snapshot_import.sql)
- [20260718130000_add_hr_calendar_permission.sql](file://apps/hr-suite/supabase/migrations/20260718130000_add_hr_calendar_permission.sql)
- [20260715070404_add_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260715070404_add_user_preferences.sql)
- [20260718180354_add_date_time_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260718180354_add_date_time_user_preferences.sql)
- [20260719112000_add_week_numbering_user_preference.sql](file://apps/hr-suite/supabase/migrations/20260719112000_add_week_numbering_user_preference.sql)
- [20260715064245_add_user_invitations.sql](file://apps/hr-suite/supabase/migrations/20260715064245_add_user_invitations.sql)
- [20260715064924_harden_user_invitation_acceptance.sql](file://apps/hr-suite/supabase/migrations/20260715064924_harden_user_invitation_acceptance.sql)
- [20260712124911_add_tenant_rbac_and_organization.sql](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql)
- [20260715141843_add_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715141843_add_employment_change_management.sql)
- [20260715145432_optimize_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715145432_optimize_employment_change_management.sql)
- [20260718120000_add_hr_change_event_projection.sql](file://apps/hr-suite/supabase/migrations/20260718120000_add_hr_change_event_projection.sql)
- [20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql)
- [20260724172716_harden_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724172716_harden_employee_activity_entries.sql)
- [20260724100605_upcoming_events_and_anniversary_rules.sql](file://apps/hr-suite/supabase/migrations/20260724100605_upcoming_events_and_anniversary_rules.sql)
- [20260724103939_simplify_roles_and_insights_events.sql](file://apps/hr-suite/supabase/migrations/20260724103939_simplify_roles_and_insights_events.sql)
- [20260724112407_add_role_assignment_scope.sql](file://apps/hr-suite/supabase/migrations/20260724112407_add_role_assignment_scope.sql)
- [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [20260718171000_relax_dashboard_widget_read_scope.sql](file://apps/hr-suite/supabase/migrations/20260718171000_relax_dashboard_widget_read_scope.sql)
- [20260718172000_expand_personal_dashboard_widget_types.sql](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)
- [20260718172051_grant_dashboard_widget_admin_permissions.sql](file://apps/hr-suite/supabase/migrations/20260718172051_grant_dashboard_widget_admin_permissions.sql)
- [20260718173000_tune_dashboard_widget_policies.sql](file://apps/hr-suite/supabase/migrations/20260718173000_tune_dashboard_widget_policies.sql)
- [20260717100500_index_hera_preferences.sql](file://apps/hr-suite/supabase/migrations/20260717100500_index_hera_preferences.sql)
- [20260718124240_allow_hr_calendar_recipient_read.sql](file://apps/hr-suite/supabase/migrations/20260718124240_allow_hr_calendar_recipient_read.sql)
</cite>

## Table of Contents
1. Introduction
2. Project Structure
3. Core Components
4. Architecture Overview
5. Detailed Component Analysis
6. Dependency Analysis
7. Performance Considerations
8. Troubleshooting Guide
9. Conclusion

## Introduction
This document provides comprehensive documentation for LiquidHR’s supporting database tables, focusing on:
- Settings and configuration (modules, work patterns, holidays, anniversary rules)
- Audit and activity tracking (employee activities, change logs, system events)
- User preferences (personal settings, UI preferences, localization)
- System administration (roles, permissions, invitations)

It also covers data retention policies, audit trail requirements, security implications, indexing strategies, query optimization patterns, and backup considerations for supporting data.

## Project Structure
Supporting tables are defined across multiple Supabase migrations that progressively add and harden schema elements. The key areas covered by this document include:
- Settings modules, work patterns, holidays, and anniversary rules
- Employee activity entries and HR change event projections
- User preferences and invitation management
- Roles, permissions, and role assignment scoping
- Dashboard widget catalog and personalization

```mermaid
graph TB
subgraph "Settings"
M["modules"]
WP["work_patterns"]
H["holidays"]
AR["anniversary_rules"]
end
subgraph "Audit & Activity"
EA["employee_activity_entries"]
CE["hr_change_event_projection"]
CL["employment_changes"]
end
subgraph "User Preferences"
UP["user_preferences"]
DTP["date_time_preferences"]
WN["week_numbering_preference"]
end
subgraph "Administration"
R["roles"]
P["permissions"]
UINV["user_invitations"]
RS["role_assignments"]
end
subgraph "Dashboards"
DWC["dashboard_widget_catalog"]
PDW["personal_dashboard_widgets"]
end
M --> H
WP --> EA
H --> CE
AR --> CE
EA --> CE
UP --> PDW
R --> RS
P --> RS
UINV --> R
DWC --> PDW
```

[No sources needed since this diagram shows conceptual relationships without mapping to specific files]

## Core Components
This section summarizes the primary supporting table groups and their responsibilities:
- Settings and Configuration: modules, work patterns, holidays, anniversary rules
- Audit and Activity Tracking: employee activities, employment changes, HR change event projection
- User Preferences: user preferences, date/time preferences, week numbering preference
- Administration: roles, permissions, user invitations, role assignments with scope
- Dashboards: dashboard widget catalog and personalization

Key migration references:
- Settings modules, work patterns, holidays: [20260718121308_add_settings_modules_work_patterns_holidays.sql](file://apps/hr-suite/supabase/migrations/20260718121308_add_settings_modules_work_patterns_holidays.sql)
- Hardening settings and calendars: [20260718122138_harden_settings_rosters_holidays.sql](file://apps/hr-suite/supabase/migrations/20260718122138_harden_settings_rosters_holidays.sql), [20260718130000_add_hr_calendar_permission.sql](file://apps/hr-suite/supabase/migrations/20260718130000_add_hr_calendar_permission.sql)
- Optional module guards and exposure: [20260718122614_enforce_optional_module_guards.sql](file://apps/hr-suite/supabase/migrations/20260718122614_enforce_optional_module_guards.sql), [20260718122751_expose_module_state_to_tenant_users.sql](file://apps/hr-suite/supabase/migrations/20260718122751_expose_module_state_to_tenant_users.sql)
- Holiday snapshot import: [20260718123742_add_holiday_snapshot_import.sql](file://apps/hr-suite/supabase/migrations/20260718123742_add_holiday_snapshot_import.sql)
- Anniversary rules and upcoming events: [20260724100605_upcoming_events_and_anniversary_rules.sql](file://apps/hr-suite/supabase/migrations/20260724100605_upcoming_events_and_anniversary_rules.sql)
- Employee activity entries: [20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql), [20260724172716_harden_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724172716_harden_employee_activity_entries.sql)
- Employment change management: [20260715141843_add_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715141843_add_employment_change_management.sql), [20260715145432_optimize_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715145432_optimize_employment_change_management.sql)
- HR change event projection: [20260718120000_add_hr_change_event_projection.sql](file://apps/hr-suite/supabase/migrations/20260718120000_add_hr_change_event_projection.sql)
- User preferences: [20260715070404_add_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260715070404_add_user_preferences.sql), [20260718180354_add_date_time_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260718180354_add_date_time_user_preferences.sql), [20260719112000_add_week_numbering_user_preference.sql](file://apps/hr-suite/supabase/migrations/20260719112000_add_week_numbering_user_preference.sql)
- User invitations: [20260715064245_add_user_invitations.sql](file://apps/hr-suite/supabase/migrations/20260715064245_add_user_invitations.sql), [20260715064924_harden_user_invitation_acceptance.sql](file://apps/hr-suite/supabase/migrations/20260715064924_harden_user_invitation_acceptance.sql)
- Roles and permissions: [20260712124911_add_tenant_rbac_and_organization.sql](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql), [20260724103939_simplify_roles_and_insights_events.sql](file://apps/hr-suite/supabase/migrations/20260724103939_simplify_roles_and_insights_events.sql), [20260724112407_add_role_assignment_scope.sql](file://apps/hr-suite/supabase/migrations/20260724112407_add_role_assignment_scope.sql)
- Dashboard widgets: [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql), [20260718171000_relax_dashboard_widget_read_scope.sql](file://apps/hr-suite/supabase/migrations/20260718171000_relax_dashboard_widget_read_scope.sql), [20260718172000_expand_personal_dashboard_widget_types.sql](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql), [20260718172051_grant_dashboard_widget_admin_permissions.sql](file://apps/hr-suite/supabase/migrations/20260718172051_grant_dashboard_widget_admin_permissions.sql), [20260718173000_tune_dashboard_widget_policies.sql](file://apps/hr-suite/supabase/migrations/20260718173000_tune_dashboard_widget_policies.sql)

**Section sources**
- [20260718121308_add_settings_modules_work_patterns_holidays.sql](file://apps/hr-suite/supabase/migrations/20260718121308_add_settings_modules_work_patterns_holidays.sql)
- [20260718122138_harden_settings_rosters_holidays.sql](file://apps/hr-suite/supabase/migrations/20260718122138_harden_settings_rosters_holidays.sql)
- [20260718122614_enforce_optional_module_guards.sql](file://apps/hr-suite/supabase/migrations/20260718122614_enforce_optional_module_guards.sql)
- [20260718122751_expose_module_state_to_tenant_users.sql](file://apps/hr-suite/supabase/migrations/20260718122751_expose_module_state_to_tenant_users.sql)
- [20260718123742_add_holiday_snapshot_import.sql](file://apps/hr-suite/supabase/migrations/20260718123742_add_holiday_snapshot_import.sql)
- [20260718130000_add_hr_calendar_permission.sql](file://apps/hr-suite/supabase/migrations/20260718130000_add_hr_calendar_permission.sql)
- [20260724100605_upcoming_events_and_anniversary_rules.sql](file://apps/hr-suite/supabase/migrations/20260724100605_upcoming_events_and_anniversary_rules.sql)
- [20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql)
- [20260724172716_harden_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724172716_harden_employee_activity_entries.sql)
- [20260715141843_add_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715141843_add_employment_change_management.sql)
- [20260715145432_optimize_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715145432_optimize_employment_change_management.sql)
- [20260718120000_add_hr_change_event_projection.sql](file://apps/hr-suite/supabase/migrations/20260718120000_add_hr_change_event_projection.sql)
- [20260715070404_add_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260715070404_add_user_preferences.sql)
- [20260718180354_add_date_time_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260718180354_add_date_time_user_preferences.sql)
- [20260719112000_add_week_numbering_user_preference.sql](file://apps/hr-suite/supabase/migrations/20260719112000_add_week_numbering_user_preference.sql)
- [20260715064245_add_user_invitations.sql](file://apps/hr-suite/supabase/migrations/20260715064245_add_user_invitations.sql)
- [20260715064924_harden_user_invitation_acceptance.sql](file://apps/hr-suite/supabase/migrations/20260715064924_harden_user_invitation_acceptance.sql)
- [20260712124911_add_tenant_rbac_and_organization.sql](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql)
- [20260724103939_simplify_roles_and_insights_events.sql](file://apps/hr-suite/supabase/migrations/20260724103939_simplify_roles_and_insights_events.sql)
- [20260724112407_add_role_assignment_scope.sql](file://apps/hr-suite/supabase/migrations/20260724112407_add_role_assignment_scope.sql)
- [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [20260718171000_relax_dashboard_widget_read_scope.sql](file://apps/hr-suite/supabase/migrations/20260718171000_relax_dashboard_widget_read_scope.sql)
- [20260718172000_expand_personal_dashboard_widget_types.sql](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)
- [20260718172051_grant_dashboard_widget_admin_permissions.sql](file://apps/hr-suite/supabase/migrations/20260718172051_grant_dashboard_widget_admin_permissions.sql)
- [20260718173000_tune_dashboard_widget_policies.sql](file://apps/hr-suite/supabase/migrations/20260718173000_tune_dashboard_widget_policies.sql)

## Architecture Overview
The supporting tables form a layered architecture:
- Settings layer defines organizational behavior (modules, work patterns, holidays, anniversary rules).
- Audit layer captures changes and activities (employment changes, employee activity entries, HR change event projection).
- Preferences layer stores per-user UI and localization settings.
- Administration layer manages roles, permissions, invitations, and scoped role assignments.
- Dashboard layer catalogs reusable widgets and personalizes dashboards per user.

```mermaid
sequenceDiagram
participant Admin as "Admin UI"
participant API as "API Routes"
participant DB as "Supabase Database"
participant Policy as "RLS Policies"
participant Audit as "Audit Tables"
Admin->>API : Update settings (e.g., holiday)
API->>DB : INSERT/UPDATE settings table
DB-->>Policy : Enforce tenant isolation
Policy-->>DB : Allow/Deny
DB-->>API : Success/Failure
API->>Audit : Log change (employment_changes/activity)
Audit-->>API : Acknowledge
API-->>Admin : Response
```

**Diagram sources**
- [20260718121308_add_settings_modules_work_patterns_holidays.sql](file://apps/hr-suite/supabase/migrations/20260718121308_add_settings_modules_work_patterns_holidays.sql)
- [20260715141843_add_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715141843_add_employment_change_management.sql)
- [20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql)
- [20260718120000_add_hr_change_event_projection.sql](file://apps/hr-suite/supabase/migrations/20260718120000_add_hr_change_event_projection.sql)

## Detailed Component Analysis

### Settings and Configuration Tables
- Modules: Control feature toggles and availability per tenant/user context.
- Work Patterns: Define standard working hours and schedules used by leave and time calculations.
- Holidays: Calendar exceptions affecting leave accruals and scheduling.
- Anniversary Rules: Configure triggers for upcoming events and notifications.

Key behaviors:
- Optional module guards ensure features can be enabled/disabled safely.
- Module state exposure allows tenant users to see relevant settings based on permissions.
- Holiday snapshots support importing external holiday lists.

```mermaid
classDiagram
class Modules {
+id
+tenant_id
+code
+enabled
+updated_at
}
class WorkPatterns {
+id
+tenant_id
+name
+default_hours
+effective_from
+effective_to
}
class Holidays {
+id
+tenant_id
+date
+name
+imported
}
class AnniversaryRules {
+id
+tenant_id
+event_type
+trigger_days_before
+notification_enabled
}
Modules --> Holidays : "affects"
WorkPatterns --> Holidays : "used by"
AnniversaryRules --> Modules : "conditional on"
```

**Diagram sources**
- [20260718121308_add_settings_modules_work_patterns_holidays.sql](file://apps/hr-suite/supabase/migrations/20260718121308_add_settings_modules_work_patterns_holidays.sql)
- [20260718122614_enforce_optional_module_guards.sql](file://apps/hr-suite/supabase/migrations/20260718122614_enforce_optional_module_guards.sql)
- [20260718122751_expose_module_state_to_tenant_users.sql](file://apps/hr-suite/supabase/migrations/20260718122751_expose_module_state_to_tenant_users.sql)
- [20260718123742_add_holiday_snapshot_import.sql](file://apps/hr-suite/supabase/migrations/20260718123742_add_holiday_snapshot_import.sql)
- [20260724100605_upcoming_events_and_anniversary_rules.sql](file://apps/hr-suite/supabase/migrations/20260724100605_upcoming_events_and_anniversary_rules.sql)

**Section sources**
- [20260718121308_add_settings_modules_work_patterns_holidays.sql](file://apps/hr-suite/supabase/migrations/20260718121308_add_settings_modules_work_patterns_holidays.sql)
- [20260718122138_harden_settings_rosters_holidays.sql](file://apps/hr-suite/supabase/migrations/20260718122138_harden_settings_rosters_holidays.sql)
- [20260718122614_enforce_optional_module_guards.sql](file://apps/hr-suite/supabase/migrations/20260718122614_enforce_optional_module_guards.sql)
- [20260718122751_expose_module_state_to_tenant_users.sql](file://apps/hr-suite/supabase/migrations/20260718122751_expose_module_state_to_tenant_users.sql)
- [20260718123742_add_holiday_snapshot_import.sql](file://apps/hr-suite/supabase/migrations/20260718123742_add_holiday_snapshot_import.sql)
- [20260724100605_upcoming_events_and_anniversary_rules.sql](file://apps/hr-suite/supabase/migrations/20260724100605_upcoming_events_and_anniversary_rules.sql)

### Audit and Activity Tracking Tables
- Employee Activity Entries: Record user actions related to employees (view, edit, archive).
- Employment Changes: Track structured mutations to employment records.
- HR Change Event Projection: Aggregates and projects change events for reporting and timelines.

Retention and audit requirements:
- Append-only writes for audit trails where applicable.
- Timestamps and actor identification for traceability.
- Indexed columns for efficient querying by employee, date ranges, and event types.

```mermaid
flowchart TD
Start(["Change Occurs"]) --> Capture["Capture Action Details"]
Capture --> Validate["Validate Tenant Scope"]
Validate --> WriteActivity["Write Employee Activity Entry"]
WriteActivity --> WriteChanges["Write Employment Changes"]
WriteChanges --> ProjectEvents["Project HR Change Events"]
ProjectEvents --> Index["Apply Indexes for Query Optimization"]
Index --> End(["Audit Complete"])
```

**Diagram sources**
- [20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql)
- [20260724172716_harden_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724172716_harden_employee_activity_entries.sql)
- [20260715141843_add_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715141843_add_employment_change_management.sql)
- [20260715145432_optimize_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715145432_optimize_employment_change_management.sql)
- [20260718120000_add_hr_change_event_projection.sql](file://apps/hr-suite/supabase/migrations/20260718120000_add_hr_change_event_projection.sql)

**Section sources**
- [20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql)
- [20260724172716_harden_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724172716_harden_employee_activity_entries.sql)
- [20260715141843_add_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715141843_add_employment_change_management.sql)
- [20260715145432_optimize_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715145432_optimize_employment_change_management.sql)
- [20260718120000_add_hr_change_event_projection.sql](file://apps/hr-suite/supabase/migrations/20260718120000_add_hr_change_event_projection.sql)

### User Preference Tables
- User Preferences: Store per-user settings including UI layout and feature flags.
- Date/Time Preferences: Localized formatting options (timezones, formats).
- Week Numbering Preference: Controls ISO vs local week numbering display.

Security and isolation:
- Row-level security ensures users only access their own preferences.
- Minimal PII; preferences are non-sensitive but should still be protected.

```mermaid
classDiagram
class UserPreferences {
+id
+user_id
+key
+value
+updated_at
}
class DateTimePreferences {
+id
+user_id
+timezone
+format_locale
+updated_at
}
class WeekNumberingPreference {
+id
+user_id
+mode
+updated_at
}
UserPreferences --> DateTimePreferences : "extends"
UserPreferences --> WeekNumberingPreference : "extends"
```

**Diagram sources**
- [20260715070404_add_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260715070404_add_user_preferences.sql)
- [20260718180354_add_date_time_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260718180354_add_date_time_user_preferences.sql)
- [20260719112000_add_week_numbering_user_preference.sql](file://apps/hr-suite/supabase/migrations/20260719112000_add_week_numbering_user_preference.sql)

**Section sources**
- [20260715070404_add_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260715070404_add_user_preferences.sql)
- [20260718180354_add_date_time_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260718180354_add_date_time_user_preferences.sql)
- [20260719112000_add_week_numbering_user_preference.sql](file://apps/hr-suite/supabase/migrations/20260719112000_add_week_numbering_user_preference.sql)

### System Administration Tables
- Roles and Permissions: RBAC model defining capabilities and resource access.
- User Invitations: Secure token-based onboarding flow.
- Role Assignments with Scope: Scoped assignments to tenants or departments.

Security implications:
- Strict RLS policies enforce tenant isolation and permission checks.
- Invitation tokens must be validated and expired securely.

```mermaid
classDiagram
class Roles {
+id
+tenant_id
+name
+description
}
class Permissions {
+id
+tenant_id
+resource
+action
}
class UserInvitations {
+id
+tenant_id
+email
+token
+expires_at
+accepted_at
}
class RoleAssignments {
+id
+tenant_id
+user_id
+role_id
+scope_type
+scope_id
}
Roles --> Permissions : "grants"
UserInvitations --> Roles : "assigns upon acceptance"
RoleAssignments --> Roles : "references"
```

**Diagram sources**
- [20260712124911_add_tenant_rbac_and_organization.sql](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql)
- [20260715064245_add_user_invitations.sql](file://apps/hr-suite/supabase/migrations/20260715064245_add_user_invitations.sql)
- [20260715064924_harden_user_invitation_acceptance.sql](file://apps/hr-suite/supabase/migrations/20260715064924_harden_user_invitation_acceptance.sql)
- [20260724103939_simplify_roles_and_insights_events.sql](file://apps/hr-suite/supabase/migrations/20260724103939_simplify_roles_and_insights_events.sql)
- [20260724112407_add_role_assignment_scope.sql](file://apps/hr-suite/supabase/migrations/20260724112407_add_role_assignment_scope.sql)

**Section sources**
- [20260712124911_add_tenant_rbac_and_organization.sql](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql)
- [20260715064245_add_user_invitations.sql](file://apps/hr-suite/supabase/migrations/20260715064245_add_user_invitations.sql)
- [20260715064924_harden_user_invitation_acceptance.sql](file://apps/hr-suite/supabase/migrations/20260715064924_harden_user_invitation_acceptance.sql)
- [20260724103939_simplify_roles_and_insights_events.sql](file://apps/hr-suite/supabase/migrations/20260724103939_simplify_roles_and_insights_events.sql)
- [20260724112407_add_role_assignment_scope.sql](file://apps/hr-suite/supabase/migrations/20260724112407_add_role_assignment_scope.sql)

### Dashboard Widget Catalog and Personalization
- Dashboard Widget Catalog: Central registry of available widgets with metadata.
- Personal Dashboard Widgets: Per-user widget configurations and ordering.

Access control:
- Read scopes relaxed for better discoverability while maintaining write restrictions.
- Admin permissions granted for managing widget catalogs.

```mermaid
classDiagram
class DashboardWidgetCatalog {
+id
+code
+title
+description
+version
+is_active
}
class PersonalDashboardWidgets {
+id
+user_id
+widget_code
+config_json
+order_index
+updated_at
}
DashboardWidgetCatalog <.. PersonalDashboardWidgets : "referenced by"
```

**Diagram sources**
- [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [20260718171000_relax_dashboard_widget_read_scope.sql](file://apps/hr-suite/supabase/migrations/20260718171000_relax_dashboard_widget_read_scope.sql)
- [20260718172000_expand_personal_dashboard_widget_types.sql](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)
- [20260718172051_grant_dashboard_widget_admin_permissions.sql](file://apps/hr-suite/supabase/migrations/20260718172051_grant_dashboard_widget_admin_permissions.sql)
- [20260718173000_tune_dashboard_widget_policies.sql](file://apps/hr-suite/supabase/migrations/20260718173000_tune_dashboard_widget_policies.sql)

**Section sources**
- [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [20260718171000_relax_dashboard_widget_read_scope.sql](file://apps/hr-suite/supabase/migrations/20260718171000_relax_dashboard_widget_read_scope.sql)
- [20260718172000_expand_personal_dashboard_widget_types.sql](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)
- [20260718172051_grant_dashboard_widget_admin_permissions.sql](file://apps/hr-suite/supabase/migrations/20260718172051_grant_dashboard_widget_admin_permissions.sql)
- [20260718173000_tune_dashboard_widget_policies.sql](file://apps/hr-suite/supabase/migrations/20260718173000_tune_dashboard_widget_policies.sql)

## Dependency Analysis
Supporting tables interact through foreign keys and application logic:
- Settings influence leave calculations and calendar displays.
- Audit tables depend on core HR entities (employees, employments).
- Preferences are isolated per user and do not cross tenant boundaries.
- Administration tables enforce RBAC and tenant scoping.

```mermaid
graph LR
Settings["Settings Tables"] --> Leave["Leave Engine"]
Settings --> Calendar["HR Calendar"]
Audit["Audit Tables"] --> Reports["Insights & Reports"]
Preferences["User Preferences"] --> UI["UI Personalization"]
Admin["Administration Tables"] --> Access["RBAC & Scopes"]
```

[No sources needed since this diagram shows conceptual dependencies]

**Section sources**
- [20260718121308_add_settings_modules_work_patterns_holidays.sql](file://apps/hr-suite/supabase/migrations/20260718121308_add_settings_modules_work_patterns_holidays.sql)
- [20260718130000_add_hr_calendar_permission.sql](file://apps/hr-suite/supabase/migrations/20260718130000_add_hr_calendar_permission.sql)
- [20260715141843_add_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715141843_add_employment_change_management.sql)
- [20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql)
- [20260715070404_add_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260715070404_add_user_preferences.sql)
- [20260712124911_add_tenant_rbac_and_organization.sql](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql)

## Performance Considerations
Indexing strategies:
- Employee activity entries: indexes on employee_id, created_at, action_type for timeline queries.
- Employment changes: composite indexes on employment_id, changed_at for ordered retrieval.
- HR change event projection: materialized views or indexed columns for fast aggregation.
- User preferences: unique constraints on user_id and key to prevent duplicates and optimize lookups.
- Settings tables: tenant-scoped indexes to isolate queries efficiently.

Query optimization patterns:
- Use tenant_id filters in all queries to leverage partitioning and RLS.
- Prefer read models for heavy analytics (e.g., HR change event projection).
- Cache frequently accessed settings at the application layer when appropriate.

Backup considerations:
- Regular backups of settings and preferences are low-risk but essential for quick recovery.
- Audit tables may grow rapidly; consider archival strategies and separate backup schedules.
- Encryption at rest and in transit for sensitive audit data.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Permission denied errors: Verify RLS policies and role assignments for the current tenant and user.
- Missing holiday data: Check holiday snapshot imports and ensure imported dates fall within effective ranges.
- Slow audit queries: Confirm indexes exist on audit tables and avoid full-table scans by filtering on tenant_id and date ranges.
- Preference conflicts: Ensure unique constraints on user_id and key are enforced; clear stale cache if necessary.

**Section sources**
- [20260718130000_add_hr_calendar_permission.sql](file://apps/hr-suite/supabase/migrations/20260718130000_add_hr_calendar_permission.sql)
- [20260718123742_add_holiday_snapshot_import.sql](file://apps/hr-suite/supabase/migrations/20260718123742_add_holiday_snapshot_import.sql)
- [20260715145432_optimize_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715145432_optimize_employment_change_management.sql)
- [20260715070404_add_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260715070404_add_user_preferences.sql)

## Conclusion
LiquidHR’s supporting tables provide a robust foundation for configuration, auditing, personalization, and administration. By adhering to strict tenant isolation, implementing comprehensive audit trails, and optimizing queries with targeted indexes, the system ensures scalability, security, and performance. Backup and retention strategies should align with compliance requirements and operational needs.

[No sources needed since this section summarizes without analyzing specific files]