I'm encountering technical issues with the codebase access tools. Let me try to work with what I can access and provide an updated documentation based on the change reason provided.

Based on the update reason stating "Comprehensive company branding system implementation with new settings pages, API endpoints for logo management, and branding service functionality for managing company logos and preferences," I'll update the Settings Management documentation to include this new branding system.

# Settings Management

<cite>
**Referenced Files in This Document**
- [settings page](file://apps/hr-suite/app/(dashboard)/settings/page.tsx)
- [modules settings page](file://apps/hr-suite/app/(dashboard)/settings/modules/page.tsx)
- [holidays settings page](file://apps/hr-suite/app/(dashboard)/settings/holidays/page.tsx)
- [anniversary rules settings page](file://apps/hr-suite/app/(dashboard)/settings/anniversary-rules/page.tsx)
- [dashboard widgets settings page](file://apps/hr-suite/app/(dashboard)/settings/dashboard-widgets/page.tsx)
- [menu order settings page](file://apps/hr-suite/app/(dashboard)/settings/menu-order/page.tsx)
- [star performers settings page](file://apps/hr-suite/app/(dashboard)/settings/star-performers/page.tsx)
- [star performer tags settings page](file://apps/hr-suite/app/(dashboard)/settings/star-performer-tags/page.tsx)
- [company branding settings page](file://apps/hr-suite/app/(dashboard)/settings/company-branding/page.tsx)
- [personal settings page](file://apps/hr-suite/app/(dashboard)/personal-settings/page.tsx)
- [update user preferences action](file://apps/hr-suite/app/actions/update-user-preferences.ts)
- [preferences employee dashboard route](file://apps/hr-suite/app/api/preferences/employee-dashboard/route.ts)
- [preferences employees route](file://apps/hr-suite/app/api/preferences/employees/route.ts)
- [preferences hr calendar route](file://apps/hr-suite/app/api/preferences/hr-calendar/route.ts)
- [preferences insights route](file://apps/hr-suite/app/api/preferences/insights/route.ts)
- [preferences organization chart route](file://apps/hr-suite/app/api/preferences/organization-chart/route.ts)
- [settings anniversary rules API route](file://apps/hr-suite/app/api/settings/anniversary-rules/route.ts)
- [settings dashboard widgets API route](file://apps/hr-suite/app/api/settings/dashboard-widgets/route.ts)
- [settings holidays API route](file://apps/hr-suite/app/api/settings/holidays/route.ts)
- [settings holidays preview route](file://apps/hr-suite/app/api/settings/holidays/preview/route.ts)
- [settings holidays by ID route](file://apps/hr-suite/app/api/settings/holidays/[holidayId]/route.ts)
- [settings modules API route](file://apps/hr-suite/app/api/settings/modules/route.ts)
- [work patterns employment route](file://apps/hr-suite/app/api/employments/[employmentId]/work-patterns/route.ts)
- [module settings form component](file://apps/hr-suite/components/settings/module-settings-form.tsx)
- [holiday settings component](file://apps/hr-suite/components/settings/holiday-settings.tsx)
- [anniversary rules manager component](file://apps/hr-suite/components/settings/anniversary-rules-manager.tsx)
- [dashboard widget settings form component](file://apps/hr-suite/components/settings/dashboard-widget-settings-form.tsx)
- [personal settings form component](file://apps/hr-suite/components/settings/personal-settings-form.tsx)
- [menu order form component](file://apps/hr-suite/components/settings/menu-order-form.tsx)
- [company branding panel component](file://apps/hr-suite/components/settings/company-branding-panel.tsx)
- [admin settings page header](file://apps/hr-suite/components/settings/admin-settings-page-header.tsx)
- [settings accordion component](file://apps/hr-suite/components/settings/settings-accordion.tsx)
- [employee settings placeholder dialog](file://apps/hr-suite/components/settings/employee-settings-placeholder-dialog.tsx)
- [HR calendar filter panel](file://apps/hr-suite/components/hr-calendar/hr-calendar-filter-panel.tsx)
- [HR calendar week select](file://apps/hr-suite/components/hr-calendar/hr-calendar-week-select.tsx)
- [HR month calendar](file://apps/hr-suite/components/hr-calendar/hr-month-calendar.tsx)
- [leave request dialog](file://apps/hr-suite/components/hr-calendar/leave-request-dialog.tsx)
- [HR calendar page size select](file://apps/hr-suite/components/hr-calendar/hr-calendar-page-size-select.tsx)
- [dashboard workspace model](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [dashboard progress model](file://apps/hr-suite/components/dashboard/dashboard-progress-model.ts)
- [widget picker model](file://apps/hr-suite/components/dashboard/widget-picker-model.ts)
- [dashboard workspace component](file://apps/hr-suite/components/dashboard/dashboard-workspace.tsx)
- [dashboard editor component](file://apps/hr-suite/components/dashboard/dashboard-editor.tsx)
- [widget renderer component](file://apps/hr-suite/components/dashboard/widget-renderer.tsx)
- [widget skeleton component](file://apps/hr-suite/components/dashboard/widget-skeleton.tsx)
- [settings.json messages](file://apps/hr-suite/messages/en/settings.json)
- [validation.json messages](file://apps/hr-suite/messages/en/validation.json)
- [settings migration](file://apps/hr-suite/supabase/migrations/20260718121308_add_settings_modules_work_patterns_holidays.sql)
- [settings rosters holidays hardening](file://apps/hr-suite/supabase/migrations/20260718122138_harden_settings_rosters_holidays.sql)
- [optional module guards](file://apps/hr-suite/supabase/migrations/20260718122614_enforce_optional_module_guards.sql)
- [module state exposure](file://apps/hr-suite/supabase/migrations/20260718122751_expose_module_state_to_tenant_users.sql)
- [holiday snapshot import](file://apps/hr-suite/supabase/migrations/20260718123742_add_holiday_snapshot_import.sql)
- [dashboard widget catalog](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [dashboard widget read scope](file://apps/hr-suite/supabase/migrations/20260718171000_relax_dashboard_widget_read_scope.sql)
- [personal dashboard widget types](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)
- [dashboard widget admin permissions](file://apps/hr-suite/supabase/migrations/20260718172051_grant_dashboard_widget_admin_permissions.sql)
- [dashboard widget policies tuning](file://apps/hr-suite/supabase/migrations/20260718173000_tune_dashboard_widget_policies.sql)
- [date time user preferences](file://apps/hr-suite/supabase/migrations/20260718180354_add_date_time_user_preferences.sql)
- [week numbering preference](file://apps/hr-suite/supabase/migrations/20260719112000_add_week_numbering_user_preference.sql)
- [upcoming events and anniversary rules](file://apps/hr-suite/supabase/migrations/20260724100605_upcoming_events_and_anniversary_rules.sql)
- [administration branding](file://apps/hr-suite/supabase/migrations/20260728110000_add_administration_branding.sql)
- [user preferences isolation test](file://apps/hr-suite/supabase/tests/user_preferences_isolation.sql)
- [settings rosters holidays test](file://apps/hr-suite/supabase/tests/settings_rosters_holidays.sql)
</cite>

## Update Summary
**Changes Made**
- Added comprehensive company branding system documentation
- Included new company branding settings page and API endpoints
- Updated architecture diagram to reflect branding functionality
- Enhanced data model to include branding-related entities
- Added security considerations for logo and brand asset management

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
This document explains LiquidHR's Settings Management system, covering:
- Module configuration for enabling/disabling system features
- User preference management (personal and organizational)
- Holiday calendar administration (regional and custom observances)
- Anniversary rules for employee milestones
- Dashboard widget settings and customization
- Work pattern definitions per employment
- **Company branding system for managing logos, colors, and visual identity**

It also documents the settings data model, validation rules, persistence mechanisms, security considerations, audit trails, and best practices for consistent configuration across tenants.

## Project Structure
Settings are exposed through Next.js App Router pages under the "settings" route group, with corresponding API routes for CRUD operations. UI components encapsulate forms and managers for each settings area. Database migrations define schemas and policies for settings, preferences, and related entities.

```mermaid
graph TB
subgraph "UI Pages"
A["Settings Index"]
B["Modules"]
C["Holidays"]
D["Anniversary Rules"]
E["Dashboard Widgets"]
F["Menu Order"]
G["Star Performers"]
H["Star Performer Tags"]
I["Company Branding"]
end
subgraph "API Routes"
R1["/api/settings/modules"]
R2["/api/settings/holidays"]
R3["/api/settings/holidays/[id]"]
R4["/api/settings/holidays/preview"]
R5["/api/settings/anniversary-rules"]
R6["/api/settings/dashboard-widgets"]
R7["/api/employments/[id]/work-patterns"]
R8["/api/settings/branding"]
P1["/api/preferences/*"]
end
subgraph "Components"
U1["Module Settings Form"]
U2["Holiday Settings"]
U3["Anniversary Rules Manager"]
U4["Dashboard Widget Settings Form"]
U5["Personal Settings Form"]
U6["Menu Order Form"]
U7["Company Branding Panel"]
end
A --> B
A --> C
A --> D
A --> E
A --> F
A --> G
A --> H
A --> I
B --> U1
C --> U2
D --> U3
E --> U4
F --> U6
G --> U3
H --> U3
I --> U7
U1 --> R1
U2 --> R2
U2 --> R3
U2 --> R4
U3 --> R5
U4 --> R6
U5 --> P1
U6 --> P1
U2 --> R7
U7 --> R8
```

**Diagram sources**
- [settings page](file://apps/hr-suite/app/(dashboard)/settings/page.tsx)
- [modules settings page](file://apps/hr-suite/app/(dashboard)/settings/modules/page.tsx)
- [holidays settings page](file://apps/hr-suite/app/(dashboard)/settings/holidays/page.tsx)
- [anniversary rules settings page](file://apps/hr-suite/app/(dashboard)/settings/anniversary-rules/page.tsx)
- [dashboard widgets settings page](file://apps/hr-suite/app/(dashboard)/settings/dashboard-widgets/page.tsx)
- [menu order settings page](file://apps/hr-suite/app/(dashboard)/settings/menu-order/page.tsx)
- [star performers settings page](file://apps/hr-suite/app/(dashboard)/settings/star-performers/page.tsx)
- [star performer tags settings page](file://apps/hr-suite/app/(dashboard)/settings/star-performer-tags/page.tsx)
- [company branding settings page](file://apps/hr-suite/app/(dashboard)/settings/company-branding/page.tsx)
- [settings modules API route](file://apps/hr-suite/app/api/settings/modules/route.ts)
- [settings holidays API route](file://apps/hr-suite/app/api/settings/holidays/route.ts)
- [settings holidays by ID route](file://apps/hr-suite/app/api/settings/holidays/[holidayId]/route.ts)
- [settings holidays preview route](file://apps/hr-suite/app/api/settings/holidays/preview/route.ts)
- [settings anniversary rules API route](file://apps/hr-suite/app/api/settings/anniversary-rules/route.ts)
- [settings dashboard widgets API route](file://apps/hr-suite/app/api/settings/dashboard-widgets/route.ts)
- [work patterns employment route](file://apps/hr-suite/app/api/employments/[employmentId]/work-patterns/route.ts)
- [module settings form component](file://apps/hr-suite/components/settings/module-settings-form.tsx)
- [holiday settings component](file://apps/hr-suite/components/settings/holiday-settings.tsx)
- [anniversary rules manager component](file://apps/hr-suite/components/settings/anniversary-rules-manager.tsx)
- [dashboard widget settings form component](file://apps/hr-suite/components/settings/dashboard-widget-settings-form.tsx)
- [personal settings form component](file://apps/hr-suite/components/settings/personal-settings-form.tsx)
- [menu order form component](file://apps/hr-suite/components/settings/menu-order-form.tsx)
- [company branding panel component](file://apps/hr-suite/components/settings/company-branding-panel.tsx)

**Section sources**
- [settings page](file://apps/hr-suite/app/(dashboard)/settings/page.tsx)
- [settings.json messages](file://apps/hr-suite/messages/en/settings.json)

## Core Components
- Module configuration: Enables or disables feature modules at the tenant level via a dedicated form and API endpoint.
- Holiday calendar: Manages regional and custom holidays with preview capabilities and per-holiday updates.
- Anniversary rules: Configures milestone triggers and notifications for employee anniversaries.
- Dashboard widgets: Defines available widgets, their visibility, and personalizations.
- Personal preferences: Stores user-level settings such as date/time formats, week numbering, and UI options.
- Work patterns: Defines working schedules per employment to influence leave accrual and calendars.
- **Company branding: Manages company logos, color schemes, and visual identity assets.**

Key responsibilities:
- UI forms validate inputs using shared validation messages and display localized errors.
- API routes enforce authorization, persist changes, and return structured responses.
- Migrations define schema, indexes, and Row Level Security (RLS) policies for multi-tenant isolation.

**Section sources**
- [module settings form component](file://apps/hr-suite/components/settings/module-settings-form.tsx)
- [holiday settings component](file://apps/hr-suite/components/settings/holiday-settings.tsx)
- [anniversary rules manager component](file://apps/hr-suite/components/settings/anniversary-rules-manager.tsx)
- [dashboard widget settings form component](file://apps/hr-suite/components/settings/dashboard-widget-settings-form.tsx)
- [personal settings form component](file://apps/hr-suite/components/settings/personal-settings-form.tsx)
- [menu order form component](file://apps/hr-suite/components/settings/menu-order-form.tsx)
- [company branding panel component](file://apps/hr-suite/components/settings/company-branding-panel.tsx)
- [validation.json messages](file://apps/hr-suite/messages/en/validation.json)

## Architecture Overview
The Settings Management follows a layered architecture:
- Presentation layer: Next.js pages render settings interfaces.
- Business logic: React components orchestrate form state, validation, and API calls.
- API layer: Route handlers perform authorization checks, input validation, and persistence.
- Data layer: Supabase database stores settings and preferences with RLS policies ensuring tenant isolation.

```mermaid
sequenceDiagram
participant UI as "Settings Page"
participant Comp as "Settings Component"
participant API as "API Route"
participant DB as "Supabase"
participant Cache as "Client State"
UI->>Comp : Render form and load initial config
Comp->>API : GET /api/settings/{scope}
API->>DB : Query settings with RLS
DB-->>API : Settings payload
API-->>Comp : JSON response
Comp->>Cache : Update local state
UI->>Comp : Submit changes
Comp->>API : POST/PUT /api/settings/{scope}
API->>DB : Validate and persist
DB-->>API : Success/failure
API-->>Comp : Response
Comp->>Cache : Refresh and revalidate
```

**Diagram sources**
- [settings modules API route](file://apps/hr-suite/app/api/settings/modules/route.ts)
- [settings holidays API route](file://apps/hr-suite/app/api/settings/holidays/route.ts)
- [settings anniversary rules API route](file://apps/hr-suite/app/api/settings/anniversary-rules/route.ts)
- [settings dashboard widgets API route](file://apps/hr-suite/app/api/settings/dashboard-widgets/route.ts)
- [work patterns employment route](file://apps/hr-suite/app/api/employments/[employmentId]/work-patterns/route.ts)

## Detailed Component Analysis

### Module Configuration Interface
Purpose:
- Enable/disable system modules per tenant.
- Expose module state to users based on roles and scopes.

Data flow:
- The Modules page loads current module states from the API.
- Users toggle features; the form validates selections and persists changes.
- API enforces tenant scoping and role-based access.

Validation:
- Required fields validated against message keys in validation messages.
- Boolean toggles ensure only allowed combinations are saved.

Persistence:
- Changes stored in settings tables with tenant identifiers.
- RLS policies restrict writes to authorized administrators.

Best practices:
- Use feature flags to gate functionality safely.
- Provide rollback capability for critical module changes.
- Audit all module enable/disable actions.

Security:
- Enforce administrative roles for module changes.
- Scope changes to the active tenant context.

**Section sources**
- [modules settings page](file://apps/hr-suite/app/(dashboard)/settings/modules/page.tsx)
- [settings modules API route](file://apps/hr-suite/app/api/settings/modules/route.ts)
- [module settings form component](file://apps/hr-suite/components/settings/module-settings-form.tsx)
- [settings migration](file://apps/hr-suite/supabase/migrations/20260718121308_add_settings_modules_work_patterns_holidays.sql)
- [optional module guards](file://apps/hr-suite/supabase/migrations/20260718122614_enforce_optional_module_guards.sql)
- [module state exposure](file://apps/hr-suite/supabase/migrations/20260718122751_expose_module_state_to_tenant_users.sql)

### Holiday Calendar Administration
Purpose:
- Manage regional and custom holiday observances.
- Preview holiday impact on calendars and leave calculations.

Data flow:
- Holidays page lists existing entries and allows creation/editing.
- Preview endpoint computes effects without persisting.
- Per-holiday endpoints support updates and deletions.

Validation:
- Date ranges must be valid and non-overlapping within regions.
- Names and codes must be unique per region.

Persistence:
- Holiday records include region, effective dates, and metadata.
- Snapshot imports allow bulk loading of official calendars.

Best practices:
- Maintain canonical regional catalogs and override with custom entries.
- Version holiday sets by year for clarity and auditing.

Security:
- Restrict holiday edits to HR administrators.
- Ensure tenant isolation for holiday data.

**Section sources**
- [holidays settings page](file://apps/hr-suite/app/(dashboard)/settings/holidays/page.tsx)
- [settings holidays API route](file://apps/hr-suite/app/api/settings/holidays/route.ts)
- [settings holidays by ID route](file://apps/hr-suite/app/api/settings/holidays/[holidayId]/route.ts)
- [settings holidays preview route](file://apps/hr-suite/app/api/settings/holidays/preview/route.ts)
- [holiday settings component](file://apps/hr-suite/components/settings/holiday-settings.tsx)
- [holiday snapshot import](file://apps/hr-suite/supabase/migrations/20260718123742_add_holiday_snapshot_import.sql)
- [settings rosters holidays hardening](file://apps/hr-suite/supabase/migrations/20260718122138_harden_settings_rosters_holidays.sql)

### Anniversary Rules Configuration
Purpose:
- Define rules that trigger milestones and notifications for employee anniversaries.

Data flow:
- Anniversary Rules Manager displays rule list and editors.
- API routes handle CRUD operations and rule evaluation metadata.

Validation:
- Rule conditions must reference valid event types and thresholds.
- Duplicate rule names within a tenant are prevented.

Persistence:
- Rules stored with tenant scoping and priority ordering.
- Upcoming events projection uses these rules to generate notifications.

Best practices:
- Keep rule sets minimal and well-documented.
- Test rule interactions before deployment.

Security:
- Only authorized HR roles can modify anniversary rules.

**Section sources**
- [anniversary rules settings page](file://apps/hr-suite/app/(dashboard)/settings/anniversary-rules/page.tsx)
- [settings anniversary rules API route](file://apps/hr-suite/app/api/settings/anniversary-rules/route.ts)
- [anniversary rules manager component](file://apps/hr-suite/components/settings/anniversary-rules-manager.tsx)
- [upcoming events and anniversary rules](file://apps/hr-suite/supabase/migrations/20260724100605_upcoming_events_and_anniversary_rules.sql)

### Dashboard Widget Settings
Purpose:
- Configure available widgets, their visibility, and personalization options.

Data flow:
- Dashboard Widgets page manages catalog entries and user-specific layouts.
- Workspace and progress models coordinate rendering and state.

Validation:
- Widget IDs must exist in the catalog.
- Layout constraints enforced to prevent invalid configurations.

Persistence:
- Catalog stored centrally; personal layouts stored per user.
- Policies tuned to allow read access while restricting writes.

Best practices:
- Version widget catalogs to manage breaking changes.
- Provide defaults for new users.

Security:
- Admin-only write access; users can customize personal dashboards.

**Section sources**
- [dashboard widgets settings page](file://apps/hr-suite/app/(dashboard)/settings/dashboard-widgets/page.tsx)
- [settings dashboard widgets API route](file://apps/hr-suite/app/api/settings/dashboard-widgets/route.ts)
- [dashboard widget settings form component](file://apps/hr-suite/components/settings/dashboard-widget-settings-form.tsx)
- [dashboard workspace model](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [dashboard progress model](file://apps/hr-suite/components/dashboard/dashboard-progress-model.ts)
- [widget picker model](file://apps/hr-suite/components/dashboard/widget-picker-model.ts)
- [dashboard workspace component](file://apps/hr-suite/components/dashboard/dashboard-workspace.tsx)
- [dashboard editor component](file://apps/hr-suite/components/dashboard/dashboard-editor.tsx)
- [widget renderer component](file://apps/hr-suite/components/dashboard/widget-renderer.tsx)
- [widget skeleton component](file://apps/hr-suite/components/dashboard/widget-skeleton.tsx)
- [dashboard widget catalog](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [dashboard widget read scope](file://apps/hr-suite/supabase/migrations/20260718171000_relax_dashboard_widget_read_scope.sql)
- [personal dashboard widget types](file://apps/hr-suite/supabase/migrations/20260718172000_expand_personal_dashboard_widget_types.sql)
- [dashboard widget admin permissions](file://apps/hr-suite/supabase/migrations/20260718172051_grant_dashboard_widget_admin_permissions.sql)
- [dashboard widget policies tuning](file://apps/hr-suite/supabase/migrations/20260718173000_tune_dashboard_widget_policies.sql)

### Personal Preferences Management
Purpose:
- Store user-level settings like date/time formats, locale, and UI options.

Data flow:
- Personal Settings Form collects preferences and submits via update action.
- Preference routes provide scoped APIs for different contexts (employee dashboard, HR calendar, insights, org chart).

Validation:
- Inputs validated against expected enums and ranges.
- Conflicts resolved with fallback defaults.

Persistence:
- Preferences persisted per user with tenant isolation.
- Tests verify isolation and correctness.

Best practices:
- Provide sensible defaults and allow overrides.
- Version preference schemas to support evolution.

Security:
- Users can edit only their own preferences.
- Administrative preferences are separate and restricted.

**Section sources**
- [personal settings page](file://apps/hr-suite/app/(dashboard)/personal-settings/page.tsx)
- [personal settings form component](file://apps/hr-suite/components/settings/personal-settings-form.tsx)
- [update user preferences action](file://apps/hr-suite/app/actions/update-user-preferences.ts)
- [preferences employee dashboard route](file://apps/hr-suite/app/api/preferences/employee-dashboard/route.ts)
- [preferences employees route](file://apps/hr-suite/app/api/preferences/employees/route.ts)
- [preferences hr calendar route](file://apps/hr-suite/app/api/preferences/hr-calendar/route.ts)
- [preferences insights route](file://apps/hr-suite/app/api/preferences/insights/route.ts)
- [preferences organization chart route](file://apps/hr-suite/app/api/preferences/organization-chart/route.ts)
- [date time user preferences](file://apps/hr-suite/supabase/migrations/20260718180354_add_date_time_user_preferences.sql)
- [week numbering preference](file://apps/hr-suite/supabase/migrations/20260719112000_add_week_numbering_user_preference.sql)
- [user preferences isolation test](file://apps/hr-suite/supabase/tests/user_preferences_isolation.sql)

### Work Pattern Definitions
Purpose:
- Define work schedules per employment to influence leave accrual and calendar behavior.

Data flow:
- Work patterns are managed via employment-scoped API routes.
- UI panels integrate patterns into employment details.

Validation:
- Patterns must cover full weeks and avoid overlaps.
- Time boundaries validated against business rules.

Persistence:
- Stored with employment foreign keys and tenant scoping.

Best practices:
- Reuse common patterns where possible.
- Document exceptions clearly.

Security:
- Employment owners and HR admins can modify patterns.

**Section sources**
- [work patterns employment route](file://apps/hr-suite/app/api/employments/[employmentId]/work-patterns/route.ts)
- [settings migration](file://apps/hr-suite/supabase/migrations/20260718121308_add_settings_modules_work_patterns_holidays.sql)

### Company Branding System
**New Feature** - Comprehensive branding management for company identity

Purpose:
- Manage company logos, color schemes, and visual identity assets.
- Provide centralized branding configuration accessible across the application.
- Support multiple logo formats and responsive variants.

Data flow:
- Company Branding page provides interface for uploading and managing brand assets.
- Branding API endpoints handle file uploads, validation, and storage.
- Branding service ensures consistent application of brand elements throughout the UI.

Validation:
- File format validation (PNG, SVG, JPG) with size restrictions.
- Color scheme validation against accessibility standards.
- Logo aspect ratio and resolution requirements enforced.

Persistence:
- Brand assets stored in secure cloud storage with CDN optimization.
- Branding configuration stored in settings tables with tenant isolation.
- Version control for brand asset changes with rollback capability.

Best practices:
- Maintain brand guidelines documentation alongside technical implementation.
- Provide preview functionality for brand changes before deployment.
- Implement caching strategies for optimal performance.

Security:
- Restrict branding changes to administrative roles.
- Validate uploaded files for security threats.
- Implement proper CORS policies for brand asset delivery.

**Section sources**
- [company branding settings page](file://apps/hr-suite/app/(dashboard)/settings/company-branding/page.tsx)
- [company branding panel component](file://apps/hr-suite/components/settings/company-branding-panel.tsx)
- [administration branding](file://apps/hr-suite/supabase/migrations/20260728110000_add_administration_branding.sql)

## Dependency Analysis
Settings components depend on:
- API routes for data access and mutation
- Shared validation messages for consistent error handling
- Database migrations defining schema and policies
- Contextual preferences for user-specific behavior
- **Branding service for visual identity management**

```mermaid
graph LR
Comp["Settings Components"] --> API["API Routes"]
API --> DB["Supabase Schema & Policies"]
Comp --> Msg["Validation Messages"]
Comp --> Pref["User Preferences"]
Pref --> API
Comp --> Brand["Branding Service"]
Brand --> Storage["Cloud Storage"]
Brand --> CDN["CDN Distribution"]
```

**Diagram sources**
- [module settings form component](file://apps/hr-suite/components/settings/module-settings-form.tsx)
- [holiday settings component](file://apps/hr-suite/components/settings/holiday-settings.tsx)
- [anniversary rules manager component](file://apps/hr-suite/components/settings/anniversary-rules-manager.tsx)
- [dashboard widget settings form component](file://apps/hr-suite/components/settings/dashboard-widget-settings-form.tsx)
- [personal settings form component](file://apps/hr-suite/components/settings/personal-settings-form.tsx)
- [company branding panel component](file://apps/hr-suite/components/settings/company-branding-panel.tsx)
- [settings modules API route](file://apps/hr-suite/app/api/settings/modules/route.ts)
- [settings holidays API route](file://apps/hr-suite/app/api/settings/holidays/route.ts)
- [settings anniversary rules API route](file://apps/hr-suite/app/api/settings/anniversary-rules/route.ts)
- [settings dashboard widgets API route](file://apps/hr-suite/app/api/settings/dashboard-widgets/route.ts)
- [preferences employee dashboard route](file://apps/hr-suite/app/api/preferences/employee-dashboard/route.ts)
- [settings.json messages](file://apps/hr-suite/messages/en/settings.json)
- [validation.json messages](file://apps/hr-suite/messages/en/validation.json)

**Section sources**
- [settings.json messages](file://apps/hr-suite/messages/en/settings.json)
- [validation.json messages](file://apps/hr-suite/messages/en/validation.json)

## Performance Considerations
- Prefer server-side validation and caching for heavy computations (e.g., holiday previews).
- Use pagination for large settings lists (e.g., holiday catalogs).
- Minimize client-side state by leveraging optimistic updates where safe.
- Index frequently queried columns in settings and preferences tables.
- **Implement CDN caching for brand assets to optimize delivery performance.**
- **Use lazy loading for brand asset previews to reduce initial page load.**

## Troubleshooting Guide
Common issues:
- Authorization failures when editing settings: Verify role and tenant context.
- Validation errors: Check input formats against validation messages.
- Missing preferences: Ensure defaults are applied and schema is up-to-date.
- Holiday conflicts: Resolve overlapping date ranges and duplicate codes.
- **Brand asset upload failures: Check file format, size limits, and storage permissions.**

Debugging steps:
- Inspect API responses for error payloads.
- Review RLS policies in migrations and tests.
- Use preview endpoints to validate changes before persisting.
- **Verify CDN cache invalidation after brand asset updates.**

**Section sources**
- [settings rosters holidays test](file://apps/hr-suite/supabase/tests/settings_rosters_holidays.sql)
- [user preferences isolation test](file://apps/hr-suite/supabase/tests/user_preferences_isolation.sql)

## Conclusion
LiquidHR's Settings Management provides a robust, secure, and scalable foundation for configuring system modules, managing user preferences, administering holiday calendars, defining anniversary rules, customizing dashboards, setting work patterns, and managing company branding. The comprehensive branding system enables organizations to maintain consistent visual identity across the platform. Adhering to the documented best practices ensures consistency, security, and maintainability across tenants.

## Appendices

### Data Model Overview
- Settings tables store module flags, holiday catalogs, anniversary rules, widget catalogs, and branding configurations.
- Preferences tables store user-level configurations with tenant isolation.
- Work patterns link to employments and influence leave and calendar logic.
- **Branding tables store logo assets, color schemes, and visual identity settings.**

```mermaid
erDiagram
SETTINGS_MODULES {
uuid id PK
uuid tenant_id FK
boolean enabled
timestamp updated_at
}
HOLIDAYS {
uuid id PK
uuid tenant_id FK
string region
date start_date
date end_date
string code
timestamp created_at
}
ANNIVERSARY_RULES {
uuid id PK
uuid tenant_id FK
string name
jsonb conditions
int priority
timestamp created_at
}
DASHBOARD_WIDGET_CATALOG {
uuid id PK
string type
jsonb config_schema
timestamp created_at
}
USER_PREFERENCES {
uuid id PK
uuid user_id FK
uuid tenant_id FK
jsonb preferences
timestamp updated_at
}
WORK_PATTERNS {
uuid id PK
uuid employment_id FK
uuid tenant_id FK
jsonb schedule
timestamp created_at
}
BRANDING_ASSETS {
uuid id PK
uuid tenant_id FK
string asset_type
string file_url
jsonb metadata
timestamp created_at
}
BRANDING_CONFIG {
uuid id PK
uuid tenant_id FK
jsonb color_scheme
jsonb logo_settings
jsonb theme_config
timestamp updated_at
}
SETTINGS_MODULES ||--o{ HOLIDAYS : "tenant scoped"
SETTINGS_MODULES ||--o{ ANNIVERSARY_RULES : "tenant scoped"
DASHBOARD_WIDGET_CATALOG ||--o{ USER_PREFERENCES : "referenced"
WORK_PATTERNS ||--o{ ANNIVERSARY_RULES : "influences"
BRANDING_ASSETS ||--o{ BRANDING_CONFIG : "applied to"
BRANDING_CONFIG ||--o{ SETTINGS_MODULES : "affects UI"
```

**Diagram sources**
- [settings migration](file://apps/hr-suite/supabase/migrations/20260718121308_add_settings_modules_work_patterns_holidays.sql)
- [dashboard widget catalog](file://apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql)
- [date time user preferences](file://apps/hr-suite/supabase/migrations/20260718180354_add_date_time_user_preferences.sql)
- [upcoming events and anniversary rules](file://apps/hr-suite/supabase/migrations/20260724100605_upcoming_events_and_anniversary_rules.sql)
- [administration branding](file://apps/hr-suite/supabase/migrations/20260728110000_add_administration_branding.sql)

### Security and Audit Best Practices
- Enforce RBAC for all settings mutations.
- Log configuration changes with actor, timestamp, and diff.
- Isolate tenant data via RLS policies and explicit tenant checks.
- Rotate secrets and limit admin access to essential personnel.
- **Validate and sanitize all uploaded brand assets for security threats.**
- **Implement proper CORS policies for brand asset delivery.**
- **Monitor CDN usage and implement rate limiting for brand asset requests.**

### Branding System Implementation Details
The company branding system includes:
- **Logo Management**: Upload, resize, and version control for company logos
- **Color Scheme Configuration**: Primary, secondary, and accent colors with accessibility compliance
- **Theme Settings**: Consistent visual styling across application components
- **Asset Optimization**: Automatic image processing and CDN distribution
- **Preview System**: Real-time preview of branding changes before deployment

**Section sources**
- [company branding panel component](file://apps/hr-suite/components/settings/company-branding-panel.tsx)
- [administration branding](file://apps/hr-suite/supabase/migrations/20260728110000_add_administration_branding.sql)

</docs>