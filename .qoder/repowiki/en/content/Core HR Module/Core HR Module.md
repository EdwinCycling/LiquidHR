# Core HR Module

<cite>
**Referenced Files in This Document**
- [20260712124858_init_employee_core_hr.sql](file://apps/hr-suite/supabase/migrations/20260712124858_init_employee_core_hr.sql)
- [20260715071156_add_employment_core.sql](file://apps/hr-suite/supabase/migrations/20260715071156_add_employment_core.sql)
- [20260715071422_add_employment_timelines.sql](file://apps/hr-suite/supabase/migrations/20260715071422_add_employment_timelines.sql)
- [20260715071717_add_employment_terminations.sql](file://apps/hr-suite/supabase/migrations/20260715071717_add_employment_terminations.sql)
- [20260715072010_harden_employment_security.sql](file://apps/hr-suite/supabase/migrations/20260715072010_harden_employment_security.sql)
- [20260715120810_complete_employee_core.sql](file://apps/hr-suite/supabase/migrations/20260715120810_complete_employee_core.sql)
- [20260715121304_optimize_employee_core_indexes.sql](file://apps/hr-suite/supabase/migrations/20260715121304_optimize_employee_core_indexes.sql)
- [20260715124506_isolate_employee_secure_identifiers.sql](file://apps/hr-suite/supabase/migrations/20260715124506_isolate_employee_secure_identifiers.sql)
- [20260715130026_index_secure_employee_foreign_keys.sql](file://apps/hr-suite/supabase/migrations/20260715130026_index_secure_employee_foreign_keys.sql)
- [20260715141843_add_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715141843_add_employment_change_management.sql)
- [20260715145432_optimize_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715145432_optimize_employment_change_management.sql)
- [20260718150000_add_employee_archive_and_avatar_state.sql](file://apps/hr-suite/supabase/migrations/20260718150000_add_employee_archive_and_avatar_state.sql)
- [20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql)
- [20260724172716_harden_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724172716_harden_employee_activity_entries.sql)
- [route.ts (employees)](file://apps/hr-suite/app/api/employees/route.ts)
- [route.ts (employee detail)](file://apps/hr-suite/app/api/employees/[employeeId]/route.ts)
- [route.ts (employments)](file://apps/hr-suite/app/api/employees/[employeeId]/employments/route.ts)
- [route.ts (employment detail)](file://apps/hr-suite/app/api/employments/[employmentId]/route.ts)
- [route.ts (organization chart)](file://apps/hr-suite/app/api/organization-chart/route.ts)
- [page.tsx (employees list)](file://apps/hr-suite/app/(dashboard)/employees/page.tsx)
- [page.tsx (employee detail)](file://apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx)
- [page.tsx (departments)](file://apps/hr-suite/app/(dashboard)/departments/page.tsx)
- [page.tsx (role assignments)](file://apps/hr-suite/app/(dashboard)/role-assignments/page.tsx)
- [authorization-manager.tsx](file://apps/hr-suite/components/organization/authorization-manager.tsx)
- [department-create-form.tsx](file://apps/hr-suite/components/organization/department-create-form.tsx)
- [role-assignment-manager.tsx](file://apps/hr-suite/components/organization/role-assignment-manager.tsx)
- [employee-create-wizard.tsx](file://apps/hr-suite/components/employees/employee-create-wizard.tsx)
- [employment-create-form.tsx](file://apps/hr-suite/components/employment/employment-create-form.tsx)
- [termination-form.tsx](file://apps/hr-suite/components/employment/termination-form.tsx)
- [employment-timeline.tsx](file://apps/hr-suite/components/employment/employment-timeline.tsx)
- [organization-chart-canvas.tsx](file://apps/hr-suite/components/organization-chart/organization-chart-canvas.tsx)
- [organization-chart-explorer.tsx](file://apps/hr-suite/components/organization-chart/organization-chart-explorer.tsx)
- [MEDEWERKER.md](file://docs/requirements/core-hr/MEDEWERKER.md)
- [CONTRACT_EN_DIENSTVERBAND.md](file://docs/requirements/employment/CONTRACT_EN_DIENSTVERBAND.md)
- [AFDELINGEN_EN_ROLLEN.md](file://docs/requirements/organization/AFDELINGEN_EN_ROLLEN.md)
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
This document explains the Core HR Module that underpins LiquidHR’s employee and organizational management. It covers the data model for employees (medewerker), employment lifecycle (dienstverband), and organization structure (organisatie). It also documents CRUD operations, contract management, department hierarchy, role assignments, and the authorization framework. The content is designed for both beginners learning HR workflows and developers extending the system.

Key concepts:
- Medewerker (employee): a person record with personal details, secure identifiers, and relationships to employments and other entities.
- Dienstverband (employment): a time-bounded assignment linking a medewerker to an organization, job, department, and work patterns; includes change history and termination.
- Organisatie (organization): the tenant-scoped container for departments, roles, and placements.

## Project Structure
The Core HR Module spans UI pages, API routes, shared components, and database migrations. The frontend organizes features by domain (employees, employments, organization), while the backend exposes REST-like endpoints under /api. Database schema evolution is managed via Supabase migrations.

```mermaid
graph TB
subgraph "Frontend Pages"
EMP_LIST["Employees List"]
EMP_DETAIL["Employee Detail"]
DEPT_PAGE["Departments"]
ROLE_PAGE["Role Assignments"]
end
subgraph "API Routes"
API_EMP["/api/employees"]
API_EMP_ID["/api/employees/[employeeId]"]
API_EMP_EMPS["/api/employees/[employeeId]/employments"]
API_EMP_DET["/api/employments/[employmentId]"]
API_ORG_CHART["/api/organization-chart"]
end
subgraph "Components"
COMP_CREATE_WIZARD["Employee Create Wizard"]
COMP_DEPT_FORM["Department Create Form"]
COMP_ROLE_MGR["Role Assignment Manager"]
COMP_EMP_TIMELINE["Employment Timeline"]
COMP_ORG_CANVAS["Organization Chart Canvas"]
end
subgraph "Database Migrations"
MIG_EMP_CORE["Employee Core Schema"]
MIG_EMP_LIFE["Employment Lifecycle"]
MIG_AUTH["Authorization & Security"]
end
EMP_LIST --> API_EMP
EMP_DETAIL --> API_EMP_ID
EMP_DETAIL --> API_EMP_EMPS
DEPT_PAGE --> API_ORG_CHART
ROLE_PAGE --> API_ORG_CHART
API_EMP --> MIG_EMP_CORE
API_EMP_ID --> MIG_EMP_CORE
API_EMP_EMPS --> MIG_EMP_LIFE
API_EMP_DET --> MIG_EMP_LIFE
API_ORG_CHART --> MIG_AUTH
COMP_CREATE_WIZARD --> API_EMP
COMP_DEPT_FORM --> API_ORG_CHART
COMP_ROLE_MGR --> API_ORG_CHART
COMP_EMP_TIMELINE --> API_EMP_EMPS
COMP_ORG_CANVAS --> API_ORG_CHART
```

**Diagram sources**
- [route.ts (employees)](file://apps/hr-suite/app/api/employees/route.ts)
- [route.ts (employee detail)](file://apps/hr-suite/app/api/employees/[employeeId]/route.ts)
- [route.ts (employments)](file://apps/hr-suite/app/api/employees/[employeeId]/employments/route.ts)
- [route.ts (employment detail)](file://apps/hr-suite/app/api/employments/[employmentId]/route.ts)
- [route.ts (organization chart)](file://apps/hr-suite/app/api/organization-chart/route.ts)
- [page.tsx (employees list)](file://apps/hr-suite/app/(dashboard)/employees/page.tsx)
- [page.tsx (employee detail)](file://apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx)
- [page.tsx (departments)](file://apps/hr-suite/app/(dashboard)/departments/page.tsx)
- [page.tsx (role assignments)](file://apps/hr-suite/app/(dashboard)/role-assignments/page.tsx)
- [employee-create-wizard.tsx](file://apps/hr-suite/components/employees/employee-create-wizard.tsx)
- [department-create-form.tsx](file://apps/hr-suite/components/organization/department-create-form.tsx)
- [role-assignment-manager.tsx](file://apps/hr-suite/components/organization/role-assignment-manager.tsx)
- [employment-timeline.tsx](file://apps/hr-suite/components/employment/employment-timeline.tsx)
- [organization-chart-canvas.tsx](file://apps/hr-suite/components/organization-chart/organization-chart-canvas.tsx)
- [20260712124858_init_employee_core_hr.sql](file://apps/hr-suite/supabase/migrations/20260712124858_init_employee_core_hr.sql)
- [20260715071156_add_employment_core.sql](file://apps/hr-suite/supabase/migrations/20260715071156_add_employment_core.sql)
- [20260715071422_add_employment_timelines.sql](file://apps/hr-suite/supabase/migrations/20260715071422_add_employment_timelines.sql)
- [20260715071717_add_employment_terminations.sql](file://apps/hr-suite/supabase/migrations/20260715071717_add_employment_terminations.sql)
- [20260715072010_harden_employment_security.sql](file://apps/hr-suite/supabase/migrations/20260715072010_harden_employment_security.sql)

**Section sources**
- [page.tsx (employees list)](file://apps/hr-suite/app/(dashboard)/employees/page.tsx)
- [page.tsx (employee detail)](file://apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx)
- [page.tsx (departments)](file://apps/hr-suite/app/(dashboard)/departments/page.tsx)
- [page.tsx (role assignments)](file://apps/hr-suite/app/(dashboard)/role-assignments/page.tsx)
- [route.ts (employees)](file://apps/hr-suite/app/api/employees/route.ts)
- [route.ts (employee detail)](file://apps/hr-suite/app/api/employees/[employeeId]/route.ts)
- [route.ts (employments)](file://apps/hr-suite/app/api/employees/[employeeId]/employments/route.ts)
- [route.ts (employment detail)](file://apps/hr-suite/app/api/employments/[employmentId]/route.ts)
- [route.ts (organization chart)](file://apps/hr-suite/app/api/organization-chart/route.ts)

## Core Components
- Employee data model: stores core identity, contact info, secure identifiers, archive state, and avatar metadata. Indexed for performance and isolation of sensitive fields.
- Employment lifecycle: models start/end dates, status transitions, changes over time, and termination records. Includes timeline entries and security hardening.
- Organization structure: supports departments, hierarchical placement, and role-based access control. Provides APIs for chart rendering and management.
- Authorization framework: enforces tenant scoping, RBAC, and RLS policies across employee and employment resources.

Practical examples:
- Onboarding a new medewerker: create employee, assign first dienstverband, set department and role, then publish to org chart.
- Department restructuring: update parent-child relationships, reassign employments, and audit changes via timelines.
- Role-based access control: assign roles to users scoped to specific organizations or departments.

**Section sources**
- [20260712124858_init_employee_core_hr.sql](file://apps/hr-suite/supabase/migrations/20260712124858_init_employee_core_hr.sql)
- [20260715071156_add_employment_core.sql](file://apps/hr-suite/supabase/migrations/20260715071156_add_employment_core.sql)
- [20260715071422_add_employment_timelines.sql](file://apps/hr-suite/supabase/migrations/20260715071422_add_employment_timelines.sql)
- [20260715071717_add_employment_terminations.sql](file://apps/hr-suite/supabase/migrations/20260715071717_add_employment_terminations.sql)
- [20260715072010_harden_employment_security.sql](file://apps/hr-suite/supabase/migrations/20260715072010_harden_employment_security.sql)
- [20260715120810_complete_employee_core.sql](file://apps/hr-suite/supabase/migrations/20260715120810_complete_employee_core.sql)
- [20260715121304_optimize_employee_core_indexes.sql](file://apps/hr-suite/supabase/migrations/20260715121304_optimize_employee_core_indexes.sql)
- [20260715124506_isolate_employee_secure_identifiers.sql](file://apps/hr-suite/supabase/migrations/20260715124506_isolate_employee_secure_identifiers.sql)
- [20260715130026_index_secure_employee_foreign_keys.sql](file://apps/hr-suite/supabase/migrations/20260715130026_index_secure_employee_foreign_keys.sql)
- [20260715141843_add_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715141843_add_employment_change_management.sql)
- [20260715145432_optimize_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715145432_optimize_employment_change_management.sql)
- [20260718150000_add_employee_archive_and_avatar_state.sql](file://apps/hr-suite/supabase/migrations/20260718150000_add_employee_archive_and_avatar_state.sql)
- [20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql)
- [20260724172716_harden_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724172716_harden_employee_activity_entries.sql)

## Architecture Overview
The Core HR Module follows a layered architecture:
- Presentation layer: Next.js pages and reusable components for HR workflows.
- API layer: Route handlers for CRUD and specialized operations (e.g., organization chart, timelines).
- Data layer: Supabase-managed Postgres schema with RLS policies and indexes.

```mermaid
sequenceDiagram
participant UI as "UI Page"
participant API as "API Route"
participant DB as "Supabase/Postgres"
participant POL as "RLS Policies"
UI->>API : "Create employee"
API->>DB : "Insert into employee table"
DB->>POL : "Evaluate tenant scope and permissions"
POL-->>DB : "Allow/Deny"
DB-->>API : "Return created record"
API-->>UI : "Success response"
```

**Diagram sources**
- [route.ts (employees)](file://apps/hr-suite/app/api/employees/route.ts)
- [20260712124858_init_employee_core_hr.sql](file://apps/hr-suite/supabase/migrations/20260712124858_init_employee_core_hr.sql)
- [20260715072010_harden_employment_security.sql](file://apps/hr-suite/supabase/migrations/20260715072010_harden_employment_security.sql)

## Detailed Component Analysis

### Employee Data Model
The employee model captures core identity, contact information, secure identifiers, and archival state. Indexes optimize lookups and foreign key constraints ensure referential integrity. Secure identifiers are isolated to reduce exposure risk.

```mermaid
erDiagram
MEDWERKER {
uuid id PK
string first_name
string last_name
string email
timestamp created_at
timestamp updated_at
boolean archived
jsonb avatar_metadata
}
SECURE_IDENTIFIERS {
uuid id PK
uuid medewerker_id FK
string bsn
string passport_number
timestamp created_at
}
ACTIVITY_ENTRIES {
uuid id PK
uuid medewerker_id FK
string action
jsonb payload
timestamp occurred_at
}
MEDWERKER ||--o{ SECURE_IDENTIFIERS : "has"
MEDWERKER ||--o{ ACTIVITY_ENTRIES : "logs"
```

**Diagram sources**
- [20260712124858_init_employee_core_hr.sql](file://apps/hr-suite/supabase/migrations/20260712124858_init_employee_core_hr.sql)
- [20260715124506_isolate_employee_secure_identifiers.sql](file://apps/hr-suite/supabase/migrations/20260715124506_isolate_employee_secure_identifiers.sql)
- [20260718150000_add_employee_archive_and_avatar_state.sql](file://apps/hr-suite/supabase/migrations/20260718150000_add_employee_archive_and_avatar_state.sql)
- [20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql)

**Section sources**
- [20260712124858_init_employee_core_hr.sql](file://apps/hr-suite/supabase/migrations/20260712124858_init_employee_core_hr.sql)
- [20260715124506_isolate_employee_secure_identifiers.sql](file://apps/hr-suite/supabase/migrations/20260715124506_isolate_employee_secure_identifiers.sql)
- [20260718150000_add_employee_archive_and_avatar_state.sql](file://apps/hr-suite/supabase/migrations/20260718150000_add_employee_archive_and_avatar_state.sql)
- [20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql)
- [20260724172716_harden_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724172716_harden_employee_activity_entries.sql)

### Employment Lifecycle Management
Employments represent time-bound assignments with robust change tracking and termination handling. Timelines capture incremental changes, and termination records formalize exits.

```mermaid
flowchart TD
Start(["Start Employment"]) --> Validate["Validate Dates and Status"]
Validate --> CreateRecord["Create Employment Record"]
CreateRecord --> SetActive["Set Active Status"]
SetActive --> TrackChanges["Track Changes via Timeline"]
TrackChanges --> Monitor{"Monitor Status"}
Monitor --> |Extend| Extend["Update End Date and Record Change"]
Monitor --> |Terminate| Terminate["Create Termination Record"]
Terminate --> Finalize["Finalize and Close"]
Extend --> Monitor
Finalize --> End(["End"])
```

**Diagram sources**
- [20260715071156_add_employment_core.sql](file://apps/hr-suite/supabase/migrations/20260715071156_add_employment_core.sql)
- [20260715071422_add_employment_timelines.sql](file://apps/hr-suite/supabase/migrations/20260715071422_add_employment_timelines.sql)
- [20260715071717_add_employment_terminations.sql](file://apps/hr-suite/supabase/migrations/20260715071717_add_employment_terminations.sql)
- [20260715141843_add_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715141843_add_employment_change_management.sql)

**Section sources**
- [20260715071156_add_employment_core.sql](file://apps/hr-suite/supabase/migrations/20260715071156_add_employment_core.sql)
- [20260715071422_add_employment_timelines.sql](file://apps/hr-suite/supabase/migrations/20260715071422_add_employment_timelines.sql)
- [20260715071717_add_employment_terminations.sql](file://apps/hr-suite/supabase/migrations/20260715071717_add_employment_terminations.sql)
- [20260715141843_add_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715141843_add_employment_change_management.sql)
- [20260715145432_optimize_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715145432_optimize_employment_change_management.sql)

### Organizational Structure Handling
Organizations manage departments and role assignments. The organization chart API provides hierarchical data for visualization and management.

```mermaid
classDiagram
class Organization {
+uuid id
+string name
+uuid tenant_id
}
class Department {
+uuid id
+uuid organization_id FK
+uuid parent_department_id FK
+string name
+timestamp created_at
}
class RoleAssignment {
+uuid id
+uuid user_id FK
+uuid organization_id FK
+uuid role_id FK
+timestamp assigned_at
}
Organization ||--o{ Department : "contains"
Organization ||--o{ RoleAssignment : "scopes"
```

**Diagram sources**
- [route.ts (organization chart)](file://apps/hr-suite/app/api/organization-chart/route.ts)
- [20260712124911_add_tenant_rbac_and_organization.sql](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql)

**Section sources**
- [route.ts (organization chart)](file://apps/hr-suite/app/api/organization-chart/route.ts)
- [20260712124911_add_tenant_rbac_and_organization.sql](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql)

### Employee CRUD Operations
CRUD operations are exposed through API routes and driven by UI components. The employee creation wizard guides users through onboarding steps.

```mermaid
sequenceDiagram
participant User as "HR Admin"
participant UI as "Employee Create Wizard"
participant API as "/api/employees"
participant DB as "Employee Table"
User->>UI : "Fill onboarding form"
UI->>API : "POST create employee"
API->>DB : "Insert employee record"
DB-->>API : "Created employee"
API-->>UI : "Redirect to employee detail"
```

**Diagram sources**
- [employee-create-wizard.tsx](file://apps/hr-suite/components/employees/employee-create-wizard.tsx)
- [route.ts (employees)](file://apps/hr-suite/app/api/employees/route.ts)

**Section sources**
- [employee-create-wizard.tsx](file://apps/hr-suite/components/employees/employee-create-wizard.tsx)
- [route.ts (employees)](file://apps/hr-suite/app/api/employees/route.ts)

### Employment Contract Management
Contract management includes creating employments, updating terms, and terminating contracts. The timeline component visualizes changes over time.

```mermaid
sequenceDiagram
participant HR as "HR Manager"
participant UI as "Employment Create Form"
participant API as "/api/employees/[employeeId]/employments"
participant TIMELINE as "Timeline Component"
HR->>UI : "Define contract details"
UI->>API : "POST create employment"
API-->>UI : "Return employment ID"
UI->>TIMELINE : "Render timeline for employment"
```

**Diagram sources**
- [employment-create-form.tsx](file://apps/hr-suite/components/employment/employment-create-form.tsx)
- [route.ts (employments)](file://apps/hr-suite/app/api/employees/[employeeId]/employments/route.ts)
- [employment-timeline.tsx](file://apps/hr-suite/components/employment/employment-timeline.tsx)

**Section sources**
- [employment-create-form.tsx](file://apps/hr-suite/components/employment/employment-create-form.tsx)
- [route.ts (employments)](file://apps/hr-suite/app/api/employees/[employeeId]/employments/route.ts)
- [employment-timeline.tsx](file://apps/hr-suite/components/employment/employment-timeline.tsx)

### Department Hierarchy
Department management supports hierarchical structures and reassignments. The department create form facilitates adding new units.

```mermaid
flowchart TD
A["Add New Department"] --> B["Select Parent Department"]
B --> C["Set Department Name and Metadata"]
C --> D["Save and Update Org Chart"]
D --> E["Reassign Employments if Needed"]
```

**Diagram sources**
- [department-create-form.tsx](file://apps/hr-suite/components/organization/department-create-form.tsx)
- [route.ts (organization chart)](file://apps/hr-suite/app/api/organization-chart/route.ts)

**Section sources**
- [department-create-form.tsx](file://apps/hr-suite/components/organization/department-create-form.tsx)
- [route.ts (organization chart)](file://apps/hr-suite/app/api/organization-chart/route.ts)

### Role Assignments and Authorization Framework
Role assignments link users to roles within organizational scopes. The authorization manager provides a UI for managing permissions.

```mermaid
sequenceDiagram
participant Admin as "Admin"
participant UI as "Role Assignment Manager"
participant API as "/api/roles"
participant POL as "RLS Policies"
Admin->>UI : "Assign role to user"
UI->>API : "POST assign role"
API->>POL : "Enforce tenant and scope"
POL-->>API : "Allow/Deny"
API-->>UI : "Confirmation"
```

**Diagram sources**
- [role-assignment-manager.tsx](file://apps/hr-suite/components/organization/role-assignment-manager.tsx)
- [authorization-manager.tsx](file://apps/hr-suite/components/organization/authorization-manager.tsx)

**Section sources**
- [role-assignment-manager.tsx](file://apps/hr-suite/components/organization/role-assignment-manager.tsx)
- [authorization-manager.tsx](file://apps/hr-suite/components/organization/authorization-manager.tsx)

## Dependency Analysis
The Core HR Module depends on:
- Frontend pages and components for user interactions.
- API routes for business logic and data persistence.
- Database migrations for schema evolution and security policies.

```mermaid
graph LR
EMP_PAGE["Employees Page"] --> EMP_API["/api/employees"]
EMP_DETAIL["Employee Detail Page"] --> EMP_DETAIL_API["/api/employees/[employeeId]"]
EMP_DETAIL --> EMP_EMPS_API["/api/employees/[employeeId]/employments"]
DEPT_PAGE["Departments Page"] --> ORG_CHART_API["/api/organization-chart"]
ROLE_PAGE["Role Assignments Page"] --> ORG_CHART_API
EMP_API --> MIG_EMP["Employee Migrations"]
EMP_DETAIL_API --> MIG_EMP
EMP_EMPS_API --> MIG_EMP_LIFE["Employment Migrations"]
ORG_CHART_API --> MIG_AUTH["Authorization Migrations"]
```

**Diagram sources**
- [page.tsx (employees list)](file://apps/hr-suite/app/(dashboard)/employees/page.tsx)
- [page.tsx (employee detail)](file://apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx)
- [page.tsx (departments)](file://apps/hr-suite/app/(dashboard)/departments/page.tsx)
- [page.tsx (role assignments)](file://apps/hr-suite/app/(dashboard)/role-assignments/page.tsx)
- [route.ts (employees)](file://apps/hr-suite/app/api/employees/route.ts)
- [route.ts (employee detail)](file://apps/hr-suite/app/api/employees/[employeeId]/route.ts)
- [route.ts (employments)](file://apps/hr-suite/app/api/employees/[employeeId]/employments/route.ts)
- [route.ts (organization chart)](file://apps/hr-suite/app/api/organization-chart/route.ts)
- [20260712124858_init_employee_core_hr.sql](file://apps/hr-suite/supabase/migrations/20260712124858_init_employee_core_hr.sql)
- [20260715071156_add_employment_core.sql](file://apps/hr-suite/supabase/migrations/20260715071156_add_employment_core.sql)
- [20260712124911_add_tenant_rbac_and_organization.sql](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql)

**Section sources**
- [page.tsx (employees list)](file://apps/hr-suite/app/(dashboard)/employees/page.tsx)
- [page.tsx (employee detail)](file://apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx)
- [page.tsx (departments)](file://apps/hr-suite/app/(dashboard)/departments/page.tsx)
- [page.tsx (role assignments)](file://apps/hr-suite/app/(dashboard)/role-assignments/page.tsx)
- [route.ts (employees)](file://apps/hr-suite/app/api/employees/route.ts)
- [route.ts (employee detail)](file://apps/hr-suite/app/api/employees/[employeeId]/route.ts)
- [route.ts (employments)](file://apps/hr-suite/app/api/employees/[employeeId]/employments/route.ts)
- [route.ts (organization chart)](file://apps/hr-suite/app/api/organization-chart/route.ts)
- [20260712124858_init_employee_core_hr.sql](file://apps/hr-suite/supabase/migrations/20260712124858_init_employee_core_hr.sql)
- [20260715071156_add_employment_core.sql](file://apps/hr-suite/supabase/migrations/20260715071156_add_employment_core.sql)
- [20260712124911_add_tenant_rbac_and_organization.sql](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql)

## Performance Considerations
- Indexing: Ensure foreign keys and frequently queried columns are indexed to speed up lookups.
- Query optimization: Use selective queries and avoid N+1 patterns when fetching employee and employment data.
- Caching: Consider caching static organization chart data where appropriate.
- Security overhead: RLS policies add checks; design them efficiently to minimize latency.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Permission denied errors: Verify tenant scoping and RLS policies for the current user.
- Missing employment timeline entries: Check change management triggers and ensure updates are recorded.
- Slow employee searches: Review indexes on search fields and consider full-text indexing if needed.

**Section sources**
- [20260715072010_harden_employment_security.sql](file://apps/hr-suite/supabase/migrations/20260715072010_harden_employment_security.sql)
- [20260715141843_add_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715141843_add_employment_change_management.sql)
- [20260715121304_optimize_employee_core_indexes.sql](file://apps/hr-suite/supabase/migrations/20260715121304_optimize_employee_core_indexes.sql)

## Conclusion
The Core HR Module provides a robust foundation for managing employees, employments, and organizational structures in LiquidHR. With clear data models, comprehensive lifecycle management, and strong authorization controls, it supports both everyday HR tasks and complex organizational changes. Developers can extend functionality using the provided APIs and components while maintaining security and performance.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices
- Terminology reference:
  - Medewerker: Employee
  - Dienstverband: Employment
  - Organisatie: Organization
- Related documentation:
  - [MEDEWERKER.md](file://docs/requirements/core-hr/MEDEWERKER.md)
  - [CONTRACT_EN_DIENSTVERBAND.md](file://docs/requirements/employment/CONTRACT_EN_DIENSTVERBAND.md)
  - [AFDELINGEN_EN_ROLLEN.md](file://docs/requirements/organization/AFDELINGEN_EN_ROLLEN.md)

**Section sources**
- [MEDEWERKER.md](file://docs/requirements/core-hr/MEDEWERKER.md)
- [CONTRACT_EN_DIENSTVERBAND.md](file://docs/requirements/employment/CONTRACT_EN_DIENSTVERBAND.md)
- [AFDELINGEN_EN_ROLLEN.md](file://docs/requirements/organization/AFDELINGEN_EN_ROLLEN.md)