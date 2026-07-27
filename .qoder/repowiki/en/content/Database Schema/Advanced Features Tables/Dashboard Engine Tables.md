# Dashboard Engine Tables

<cite>
**Referenced Files in This Document**
- [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [20260718171000_relax_dashboard_widget_read_scope.sql](file://apps/hr-suite/supabase/migrations/20260718171000_relax_dashboard_widget_read_scope.sql)
- [20260718172000_expand_personal_dashboard_widget_types.sql](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)
- [20260718172051_grant_dashboard_widget_admin_permissions.sql](file://apps/hr-suite/supabase/migrations/20260718172051_grant_dashboard_widget_admin_permissions.sql)
- [20260718173000_tune_dashboard_widget_policies.sql](file://apps/hr-suite/supabase/migrations/20260718173000_tune_dashboard_widget_policies.sql)
- [20260718120000_add_hr_change_event_projection.sql](file://apps/hr-suite/supabase/migrations/20260718120000_add_hr_change_event_projection.sql)
- [20260718121308_add_settings_modules_work_patterns_holidays.sql](file://apps/hr-suite/supabase/migrations/20260718121308_add_settings_modules_work_patterns_holidays.sql)
- [20260718122138_harden_settings_rosters_holidays.sql](file://apps/hr-suite/supabase/migrations/20260718122138_harden_settings_rosters_holidays.sql)
- [20260718122614_enforce_optional_module_guards.sql](file://apps/hr-suite/supabase/migrations/20260718122614_enforce_optional_module_guards.sql)
- [20260718122751_expose_module_state_to_tenant_users.sql](file://apps/hr-suite/supabase/migrations/20260718122751_expose_module_state_to_tenant_users.sql)
- [20260718123742_add_holiday_snapshot_import.sql](file://apps/hr-suite/supabase/migrations/20260718123742_add_holiday_snapshot_import.sql)
- [20260718124240_allow_hr_calendar_recipient_read.sql](file://apps/hr-suite/supabase/migrations/20260718124240_allow_hr_calendar_recipient_read.sql)
- [20260718130000_add_hr_calendar_permission.sql](file://apps/hr-suite/supabase/migrations/20260718130000_add_hr_calendar_permission.sql)
- [20260718131000_harden_hr_master_data_document_policies.sql](file://apps/hr-suite/supabase/migrations/20260718131000_harden_hr_master_data_document_policies.sql)
- [20260718132000_split_reminder_target_write_policy.sql](file://apps/hr-suite/supabase/migrations/20260718132000_split_reminder_target_write_policy.sql)
- [20260718150000_add_employee_archive_and_avatar_state.sql](file://apps/hr-suite/supabase/migrations/20260718150000_add_employee_archive_and_avatar_state.sql)
- [20260718170949_harden_organization_authorization.sql](file://apps/hr-suite/supabase/migrations/20260718170949_harden_organization_authorization.sql)
- [20260718171241_link_employees_from_auth_trigger.sql](file://apps/hr-suite/supabase/migrations/20260718171241_link_employees_from_auth_trigger.sql)
- [20260718174305_add_multitenancy_administrations.sql](file://apps/hr-suite/supabase/migrations/20260718174305_add_multitenancy_administrations.sql)
- [20260718175659_seed_multitenancy_demo.sql](file://apps/hr-suite/supabase/migrations/20260718175659_seed_multitenancy_demo.sql)
- [20260718180142_enforce_administration_management_scope.sql](file://apps/hr-suite/supabase/migrations/20260718180142_enforce_administration_management_scope.sql)
- [20260718180309_index_employee_organization_scope_foreign_keys.sql](file://apps/hr-suite/supabase/migrations/20260718180309_index_employee_organization_scope_foreign_keys.sql)
- [20260718170000_add_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_user_preferences.sql)
- [20260718180354_add_date_time_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260718180354_add_date_time_user_preferences.sql)
- [20260718191500_add_leave_request_booking_engine.sql](file://apps/hr-suite/supabase/migrations/20260718191500_add_leave_request_booking_engine.sql)
- [20260718192000_add_leave_ledger_operations.sql](file://apps/hr-suite/supabase/migrations/20260718192000_add_leave_ledger_operations.sql)
- [20260718192100_seed_leave_demo_year_controls.sql](file://apps/hr-suite/supabase/migrations/20260718192100_seed_leave_demo_year_controls.sql)
- [20260718192500_skip_holidays_in_leave_requests.sql](file://apps/hr-suite/supabase/migrations/20260718192500_skip_holidays_in_leave_requests.sql)
- [20260718193000_optimize_employee_overview.sql](file://apps/hr-suite/supabase/migrations/20260718193000_optimize_employee_overview.sql)
- [20260718194000_add_week_numbering_user_preference.sql](file://apps/hr-suite/supabase/migrations/20260718194000_add_week_numbering_user_preference.sql)
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [dashboard-workspace.tsx](file://apps/hr-suite/components/dashboard/dashboard-workspace.tsx)
- [dashboard-widget-stream.tsx](file://apps/hr-suite/components/dashboard/dashboard-widget-stream.tsx)
- [widget-renderer.tsx](file://apps/hr-suite/components/dashboard/widget-renderer.tsx)
- [employee-dashboard-layout.tsx](file://apps/hr-suite/components/employees/employee-dashboard-layout.tsx)
- [employee-dashboard.tsx](file://apps/hr-suite/components/employees/employee-dashboard.tsx)
- [update-user-preferences.ts](file://apps/hr-suite/app/actions/update-user-preferences.ts)
- [route.ts (dashboards)](file://apps/hr-suite/app/api/dashboards/route.ts)
- [route.ts (dashboards/[dashboardId])](file://apps/hr-suite/app/api/dashboards/[dashboardId]/route.ts)
- [route.ts (settings/dashboard-widgets)](file://apps/hr-suite/app/api/settings/dashboard-widgets/route.ts)
- [route.ts (preferences/employee-dashboard)](file://apps/hr-suite/app/api/preferences/employee-dashboard/route.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document provides a comprehensive data model and runtime architecture for LiquidHR’s dashboard engine. It focuses on:
- Widget catalog system for reusable dashboard components
- Personal dashboard layouts and configurations
- User-specific widget preferences
- Widget type system, layout serialization, and real-time update mechanisms
- Relationships between widgets, dashboards, and user preferences
- Security policies for widget access, admin permissions, and tenant isolation
- Performance optimizations for widget rendering and data streaming

The documentation is grounded in the repository’s database migrations, API routes, and frontend components that implement the dashboard engine.

## Project Structure
The dashboard engine spans multiple layers:
- Database schema and security policies are defined in Supabase migrations under apps/hr-suite/supabase/migrations.
- API endpoints for dashboards, settings, and preferences live under apps/hr-suite/app/api.
- Frontend components for workspace orchestration, widget rendering, and streaming updates are under apps/hr-suite/components/dashboard and related feature folders.

```mermaid
graph TB
subgraph "Database Layer"
M1["Widget Catalog Migration"]
M2["Personal Dashboards Migration"]
M3["User Preferences Migration"]
M4["Security Policies & RBAC"]
M5["Change Event Projection"]
end
subgraph "API Layer"
A1["Dashboards API"]
A2["Settings/Dashboard Widgets API"]
A3["Preferences API"]
end
subgraph "Frontend Layer"
F1["Dashboard Workspace Model"]
F2["Widget Renderer"]
F3["Widget Stream (Real-time)"]
F4["Employee Dashboard Layout"]
end
M1 --> A1
M2 --> A1
M3 --> A3
M4 --> A1
M4 --> A2
M4 --> A3
M5 --> F3
A1 --> F1
A2 --> F1
A3 --> F1
F1 --> F2
F1 --> F3
F4 --> F1
```

**Diagram sources**
- [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [20260718171000_relax_dashboard_widget_read_scope.sql](file://apps/hr-suite/supabase/migrations/20260718171000_relax_dashboard_widget_read_scope.sql)
- [20260718172000_expand_personal_dashboard_widget_types.sql](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)
- [20260718172051_grant_dashboard_widget_admin_permissions.sql](file://apps/hr-suite/supabase/migrations/20260718172051_grant_dashboard_widget_admin_permissions.sql)
- [20260718173000_tune_dashboard_widget_policies.sql](file://apps/hr-suite/supabase/migrations/20260718173000_tune_dashboard_widget_policies.sql)
- [20260718120000_add_hr_change_event_projection.sql](file://apps/hr-suite/supabase/migrations/20260718120000_add_hr_change_event_projection.sql)
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [dashboard-workspace.tsx](file://apps/hr-suite/components/dashboard/dashboard-workspace.tsx)
- [dashboard-widget-stream.tsx](file://apps/hr-suite/components/dashboard/dashboard-widget-stream.tsx)
- [widget-renderer.tsx](file://apps/hr-suite/components/dashboard/widget-renderer.tsx)
- [employee-dashboard-layout.tsx](file://apps/hr-suite/components/employees/employee-dashboard-layout.tsx)
- [route.ts (dashboards)](file://apps/hr-suite/app/api/dashboards/route.ts)
- [route.ts (settings/dashboard-widgets)](file://apps/hr-suite/app/api/settings/dashboard-widgets/route.ts)
- [route.ts (preferences/employee-dashboard)](file://apps/hr-suite/app/api/preferences/employee-dashboard/route.ts)

**Section sources**
- [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [20260718171000_relax_dashboard_widget_read_scope.sql](file://apps/hr-suite/supabase/migrations/20260718171000_relax_dashboard_widget_read_scope.sql)
- [20260718172000_expand_personal_dashboard_widget_types.sql](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)
- [20260718172051_grant_dashboard_widget_admin_permissions.sql](file://apps/hr-suite/supabase/migrations/20260718172051_grant_dashboard_widget_admin_permissions.sql)
- [20260718173000_tune_dashboard_widget_policies.sql](file://apps/hr-suite/supabase/migrations/20260718173000_tune_dashboard_widget_policies.sql)
- [20260718120000_add_hr_change_event_projection.sql](file://apps/hr-suite/supabase/migrations/20260718120000_add_hr_change_event_projection.sql)
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [dashboard-workspace.tsx](file://apps/hr-suite/components/dashboard/dashboard-workspace.tsx)
- [dashboard-widget-stream.tsx](file://apps/hr-suite/components/dashboard/dashboard-widget-stream.tsx)
- [widget-renderer.tsx](file://apps/hr-suite/components/dashboard/widget-renderer.tsx)
- [employee-dashboard-layout.tsx](file://apps/hr-suite/components/employees/employee-dashboard-layout.tsx)
- [route.ts (dashboards)](file://apps/hr-suite/app/api/dashboards/route.ts)
- [route.ts (settings/dashboard-widgets)](file://apps/hr-suite/app/api/settings/dashboard-widgets/route.ts)
- [route.ts (preferences/employee-dashboard)](file://apps/hr-suite/app/api/preferences/employee-dashboard/route.ts)

## Core Components
- Widget Catalog: Defines reusable widget types, metadata, and configuration schemas used across dashboards.
- Personal Dashboards: Stores per-user dashboard layouts, including widget placement, sizing, and visibility.
- User Preferences: Captures user-specific widget behavior and display preferences (e.g., date/time formats, week numbering).
- Real-time Updates: Change event projection feeds live updates to widgets without full page reloads.
- Security Policies: Row-level security and role-based access control ensure tenant isolation and admin-only operations.

Key responsibilities:
- Widget catalog serves as the source of truth for available widgets and their schemas.
- Personal dashboards serialize layout state into a structured format consumed by the frontend workspace.
- User preferences are scoped to tenants and users, enabling personalized experiences while maintaining isolation.
- Real-time updates leverage change events to refresh widget data efficiently.

**Section sources**
- [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [20260718172000_expand_personal_dashboard_widget_types.sql](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)
- [20260718170000_add_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_user_preferences.sql)
- [20260718120000_add_hr_change_event_projection.sql](file://apps/hr-suite/supabase/migrations/20260718120000_add_hr_change_event_projection.sql)
- [20260718173000_tune_dashboard_widget_policies.sql](file://apps/hr-suite/supabase/migrations/20260718173000_tune_dashboard_widget_policies.sql)

## Architecture Overview
The dashboard engine integrates database models, API endpoints, and frontend components to deliver a dynamic, secure, and performant experience.

```mermaid
sequenceDiagram
participant UI as "Dashboard UI"
participant WS as "Workspace Model"
participant API as "Dashboards API"
participant DB as "Supabase DB"
participant Stream as "Widget Stream"
UI->>WS : Load dashboard
WS->>API : GET /api/dashboards/ : id
API->>DB : Fetch layout + widget config
DB-->>API : JSON layout + widget metadata
API-->>WS : Response payload
WS->>Stream : Subscribe to changes
Stream-->>WS : Real-time updates
WS->>UI : Render widgets with updated data
```

**Diagram sources**
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [dashboard-widget-stream.tsx](file://apps/hr-suite/components/dashboard/dashboard-widget-stream.tsx)
- [route.ts (dashboards)](file://apps/hr-suite/app/api/dashboards/route.ts)
- [route.ts (dashboards/[dashboardId])](file://apps/hr-suite/app/api/dashboards/[dashboardId]/route.ts)

## Detailed Component Analysis

### Widget Catalog System
The widget catalog defines reusable components with metadata and configuration schemas. It supports:
- Widget type enumeration and versioning
- Schema validation for widget configuration
- Tenant-scoped availability and visibility rules

```mermaid
classDiagram
class WidgetCatalog {
+string id
+string type
+string title
+string description
+jsonb config_schema
+boolean enabled
+string tenant_id
+version number
}
class WidgetInstance {
+string id
+string dashboard_id
+string widget_type
+jsonb config
+number order
+boolean visible
}
class PersonalDashboard {
+string id
+string user_id
+string tenant_id
+jsonb layout
+timestamp updated_at
}
WidgetCatalog <|-- WidgetInstance : "instantiated by"
PersonalDashboard o--> WidgetInstance : "contains"
```

**Diagram sources**
- [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [20260718172000_expand_personal_dashboard_widget_types.sql](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)

**Section sources**
- [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [20260718172000_expand_personal_dashboard_widget_types.sql](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)

### Personal Dashboard Layouts and Configurations
Personal dashboards store serialized layout structures that define widget placement, sizing, and visibility per user. The layout is typically represented as a JSON structure containing:
- Grid or flex-based positioning
- Widget instance references
- Per-widget configuration overrides

```mermaid
flowchart TD
Start(["Load Personal Dashboard"]) --> FetchLayout["Fetch Layout JSON"]
FetchLayout --> ValidateSchema{"Valid Layout?"}
ValidateSchema --> |No| Error["Handle Invalid Layout"]
ValidateSchema --> |Yes| ParseWidgets["Parse Widget Instances"]
ParseWidgets --> ResolveConfig["Resolve Widget Config from Catalog"]
ResolveConfig --> Render["Render Widgets"]
Render --> End(["Dashboard Ready"])
```

**Diagram sources**
- [employee-dashboard-layout.tsx](file://apps/hr-suite/components/employees/employee-dashboard-layout.tsx)
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)

**Section sources**
- [employee-dashboard-layout.tsx](file://apps/hr-suite/components/employees/employee-dashboard-layout.tsx)
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)

### User-Specific Widget Preferences
User preferences capture individualized settings such as date/time formats, week numbering, and widget-specific toggles. These preferences are scoped to tenants and users to ensure isolation and personalization.

```mermaid
classDiagram
class UserPreference {
+string id
+string user_id
+string tenant_id
+string key
+jsonb value
+timestamp updated_at
}
class DateTimePreference {
+string id
+string user_id
+string tenant_id
+string timezone
+string date_format
+string time_format
}
class WeekNumberingPreference {
+string id
+string user_id
+string tenant_id
+string week_start_day
+string iso_week
}
UserPreference <|-- DateTimePreference : "extends"
UserPreference <|-- WeekNumberingPreference : "extends"
```

**Diagram sources**
- [20260718170000_add_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_user_preferences.sql)
- [20260718180354_add_date_time_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260718180354_add_date_time_user_preferences.sql)
- [20260718194000_add_week_numbering_user_preference.sql](file://apps/hr-suite/supabase/migrations/20260718194000_add_week_numbering_user_preference.sql)

**Section sources**
- [20260718170000_add_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_user_preferences.sql)
- [20260718180354_add_date_time_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260718180354_add_date_time_user_preferences.sql)
- [20260718194000_add_week_numbering_user_preference.sql](file://apps/hr-suite/supabase/migrations/20260718194000_add_week_numbering_user_preference.sql)

### Widget Type System
The widget type system enables extensibility by defining new widget categories and behaviors. Types are validated against schemas stored in the catalog, ensuring consistent configuration across instances.

```mermaid
flowchart TD
DefineType["Define New Widget Type"] --> Schema["Attach JSON Schema"]
Schema --> Validate["Validate Instance Config"]
Validate --> Register["Register in Catalog"]
Register --> Deploy["Deploy to Tenants"]
Deploy --> Use["Use in Dashboards"]
```

**Diagram sources**
- [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [20260718172000_expand_personal_dashboard_widget_types.sql](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)

**Section sources**
- [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [20260718172000_expand_personal_dashboard_widget_types.sql](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)

### Layout Serialization
Layout serialization converts visual dashboard arrangements into structured JSON for persistence and rehydration. The process includes:
- Capturing widget positions and sizes
- Serializing per-widget configuration overrides
- Validating against schema constraints

```mermaid
sequenceDiagram
participant Editor as "Dashboard Editor"
participant Model as "Workspace Model"
participant API as "Dashboards API"
participant DB as "Supabase DB"
Editor->>Model : Update layout
Model->>Model : Serialize layout JSON
Model->>API : PATCH /api/dashboards/ : id/layout
API->>DB : Save layout
DB-->>API : Success
API-->>Model : Persisted layout
Model-->>Editor : Confirm update
```

**Diagram sources**
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [route.ts (dashboards/[dashboardId])](file://apps/hr-suite/app/api/dashboards/[dashboardId]/route.ts)

**Section sources**
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [route.ts (dashboards/[dashboardId])](file://apps/hr-suite/app/api/dashboards/[dashboardId]/route.ts)

### Real-Time Update Mechanisms
Real-time updates are driven by change event projections that push incremental updates to widgets without full page reloads. This ensures responsive dashboards with minimal bandwidth usage.

```mermaid
sequenceDiagram
participant Source as "Data Source"
participant Proj as "Change Event Projection"
participant Stream as "Widget Stream"
participant UI as "Widget Renderer"
Source->>Proj : Emit change event
Proj->>Stream : Publish event
Stream->>UI : Push update
UI->>UI : Re-render affected widgets
```

**Diagram sources**
- [20260718120000_add_hr_change_event_projection.sql](file://apps/hr-suite/supabase/migrations/20260718120000_add_hr_change_event_projection.sql)
- [dashboard-widget-stream.tsx](file://apps/hr-suite/components/dashboard/dashboard-widget-stream.tsx)
- [widget-renderer.tsx](file://apps/hr-suite/components/dashboard/widget-renderer.tsx)

**Section sources**
- [20260718120000_add_hr_change_event_projection.sql](file://apps/hr-suite/supabase/migrations/20260718120000_add_hr_change_event_projection.sql)
- [dashboard-widget-stream.tsx](file://apps/hr-suite/components/dashboard/dashboard-widget-stream.tsx)
- [widget-renderer.tsx](file://apps/hr-suite/components/dashboard/widget-renderer.tsx)

### Relationship Between Widgets, Dashboards, and User Preferences
Widgets are instantiated within dashboards and can be customized via user preferences. The relationships ensure:
- Widgets belong to specific dashboards
- Dashboards are owned by users within tenants
- Preferences override default widget behavior per user

```mermaid
erDiagram
WIDGET_CATALOG {
uuid id PK
string type
jsonb config_schema
boolean enabled
string tenant_id
}
PERSONAL_DASHBOARD {
uuid id PK
uuid user_id FK
uuid tenant_id FK
jsonb layout
}
WIDGET_INSTANCE {
uuid id PK
uuid dashboard_id FK
string widget_type
jsonb config
int order
boolean visible
}
USER_PREFERENCE {
uuid id PK
uuid user_id FK
uuid tenant_id FK
string key
jsonb value
}
WIDGET_CATALOG ||--o{ WIDGET_INSTANCE : "instantiates"
PERSONAL_DASHBOARD ||--o{ WIDGET_INSTANCE : "contains"
USER_PREFERENCE ||--|| PERSONAL_DASHBOARD : "influences"
```

**Diagram sources**
- [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [20260718172000_expand_personal_dashboard_widget_types.sql](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)
- [20260718170000_add_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_user_preferences.sql)

**Section sources**
- [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [20260718172000_expand_personal_dashboard_widget_types.sql](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)
- [20260718170000_add_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_user_preferences.sql)

### Security Policies for Widget Access, Admin Permissions, and Tenant Isolation
Security is enforced through row-level policies and role-based access control:
- Widget catalog reads are relaxed for broader access while writes remain restricted
- Admin permissions allow management of widget catalogs and dashboard settings
- Tenant isolation ensures data separation across organizations

```mermaid
flowchart TD
Request["Access Request"] --> CheckTenant["Verify Tenant Scope"]
CheckTenant --> CheckRole{"Admin Role?"}
CheckRole --> |Yes| AllowWrite["Allow Write Operations"]
CheckRole --> |No| AllowRead["Allow Read Operations"]
AllowWrite --> Audit["Audit Log"]
AllowRead --> Return["Return Data"]
Audit --> Return
```

**Diagram sources**
- [20260718171000_relax_dashboard_widget_read_scope.sql](file://apps/hr-suite/supabase/migrations/20260718171000_relax_dashboard_widget_read_scope.sql)
- [20260718172051_grant_dashboard_widget_admin_permissions.sql](file://apps/hr-suite/supabase/migrations/20260718172051_grant_dashboard_widget_admin_permissions.sql)
- [20260718173000_tune_dashboard_widget_policies.sql](file://apps/hr-suite/supabase/migrations/20260718173000_tune_dashboard_widget_policies.sql)

**Section sources**
- [20260718171000_relax_dashboard_widget_read_scope.sql](file://apps/hr-suite/supabase/migrations/20260718171000_relax_dashboard_widget_read_scope.sql)
- [20260718172051_grant_dashboard_widget_admin_permissions.sql](file://apps/hr-suite/supabase/migrations/20260718172051_grant_dashboard_widget_admin_permissions.sql)
- [20260718173000_tune_dashboard_widget_policies.sql](file://apps/hr-suite/supabase/migrations/20260718173000_tune_dashboard_widget_policies.sql)

## Dependency Analysis
The dashboard engine dependencies span database migrations, API routes, and frontend components. Key relationships include:
- Widget catalog migrations enable API endpoints for widget management
- Personal dashboard migrations support layout persistence via API routes
- User preference migrations integrate with preference APIs
- Change event projections feed real-time updates to the frontend stream

```mermaid
graph TB
M1["Widget Catalog Migration"] --> A1["Settings/Dashboard Widgets API"]
M2["Personal Dashboards Migration"] --> A2["Dashboards API"]
M3["User Preferences Migration"] --> A3["Preferences API"]
M4["Change Event Projection"] --> F1["Widget Stream"]
A1 --> F2["Widget Renderer"]
A2 --> F3["Workspace Model"]
A3 --> F4["User Preference Resolver"]
```

**Diagram sources**
- [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [20260718172000_expand_personal_dashboard_widget_types.sql](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)
- [20260718170000_add_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_user_preferences.sql)
- [20260718120000_add_hr_change_event_projection.sql](file://apps/hr-suite/supabase/migrations/20260718120000_add_hr_change_event_projection.sql)
- [route.ts (settings/dashboard-widgets)](file://apps/hr-suite/app/api/settings/dashboard-widgets/route.ts)
- [route.ts (dashboards)](file://apps/hr-suite/app/api/dashboards/route.ts)
- [route.ts (preferences/employee-dashboard)](file://apps/hr-suite/app/api/preferences/employee-dashboard/route.ts)
- [dashboard-widget-stream.tsx](file://apps/hr-suite/components/dashboard/dashboard-widget-stream.tsx)
- [widget-renderer.tsx](file://apps/hr-suite/components/dashboard/widget-renderer.tsx)
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)

**Section sources**
- [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [20260718172000_expand_personal_dashboard_widget_types.sql](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)
- [20260718170000_add_user_preferences.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_user_preferences.sql)
- [20260718120000_add_hr_change_event_projection.sql](file://apps/hr-suite/supabase/migrations/20260718120000_add_hr_change_event_projection.sql)
- [route.ts (settings/dashboard-widgets)](file://apps/hr-suite/app/api/settings/dashboard-widgets/route.ts)
- [route.ts (dashboards)](file://apps/hr-suite/app/api/dashboards/route.ts)
- [route.ts (preferences/employee-dashboard)](file://apps/hr-suite/app/api/preferences/employee-dashboard/route.ts)
- [dashboard-widget-stream.tsx](file://apps/hr-suite/components/dashboard/dashboard-widget-stream.tsx)
- [widget-renderer.tsx](file://apps/hr-suite/components/dashboard/widget-renderer.tsx)
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)

## Performance Considerations
- Widget rendering optimization: Lazy loading and skeleton placeholders improve perceived performance.
- Data streaming efficiency: Incremental updates reduce bandwidth and avoid full re-renders.
- Caching strategies: Cache widget configurations and frequently accessed data at the API layer.
- Indexing: Database indexes on foreign keys and tenant scopes enhance query performance.
- Concurrency control: Optimistic updates with rollback handling prevent UI inconsistencies.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Widget not rendering: Verify widget type exists in catalog and configuration schema matches.
- Layout corruption: Validate layout JSON against schema constraints before saving.
- Permission errors: Check tenant scope and admin roles for write operations.
- Real-time updates not appearing: Ensure change event projection is active and stream subscription is established.

**Section sources**
- [20260718170000_add_dashboard_widget_catalog.sql](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [20260718173000_tune_dashboard_widget_policies.sql](file://apps/hr-suite/supabase/migrations/20260718173000_tune_dashboard_widget_policies.sql)
- [20260718120000_add_hr_change_event_projection.sql](file://apps/hr-suite/supabase/migrations/20260718120000_add_hr_change_event_projection.sql)

## Conclusion
LiquidHR’s dashboard engine provides a robust, scalable foundation for building personalized, real-time dashboards. The widget catalog system enables reusable components, while personal dashboards and user preferences offer customization at scale. Security policies ensure tenant isolation and proper access control, and performance optimizations deliver a smooth user experience.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices
- Example widget definition schemas: Refer to migration files for schema definitions.
- Layout structures: Inspect frontend components for serialization patterns.
- Preference configurations: Review user preference migrations for supported keys and values.

[No sources needed since this section provides general guidance]