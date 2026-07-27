# Custom Fields Tables

<cite>
**Referenced Files in This Document**
- [20260715122802_add_custom_field_definitions.sql](file://apps/hr-suite/supabase/migrations/20260715122802_add_custom_field_definitions.sql)
- [20260715123119_add_custom_field_value_rpc.sql](file://apps/hr-suite/supabase/migrations/20260715123119_add_custom_field_value_rpc.sql)
- [20260715123927_harden_custom_field_values.sql](file://apps/hr-suite/supabase/migrations/20260715123927_harden_custom_field_values.sql)
- [20260715131230_seed_custom_fields_and_tenant_roles.sql](file://apps/hr-suite/supabase/migrations/20260715131230_seed_custom_fields_and_tenant_roles.sql)
- [custom_fields_isolation.sql](file://apps/hr-suite/supabase/tests/custom_fields_isolation.sql)
- [route.ts](file://apps/hr-suite/app/api/custom-fields/route.ts)
- [route.ts](file://apps/hr-suite/app/api/custom-fields/[definitionId]/route.ts)
- [employee-custom-fields.tsx](file://apps/hr-suite/components/custom-fields/employee-custom-fields.tsx)
- [custom-field-manager.tsx](file://apps/hr-suite/components/custom-fields/custom-field-manager.tsx)
- [VRIJE_VELDEN.md](file://docs/requirements/custom-fields/VRIJE_VELDEN.md)
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
This document provides comprehensive data model documentation for LiquidHR’s custom fields system. It explains the schema for custom field definitions, dynamic value storage using JSONB, RPC functions for value retrieval and validation, security model with tenant isolation and permissions, relationships to HR entities (employees, employments), and operational guidance including creation patterns, validation strategies, performance optimization, migration, and backup considerations.

## Project Structure
The custom fields feature spans database migrations, API routes, UI components, and requirements documentation:
- Database schema and policies are defined in Supabase migrations under apps/hr-suite/supabase/migrations.
- API endpoints for custom fields live under apps/hr-suite/app/api/custom-fields.
- UI components for managing and editing custom fields are under apps/hr-suite/components/custom-fields.
- Requirements and design context are documented under docs/requirements/custom-fields.

```mermaid
graph TB
subgraph "Database"
A["Custom Field Definitions"]
B["Custom Field Values (JSONB)"]
C["RLS Policies & Functions"]
end
subgraph "API Layer"
D["/api/custom-fields route"]
E["/api/custom-fields/[definitionId] route"]
end
subgraph "UI Layer"
F["Employee Custom Fields Editor"]
G["Custom Field Manager"]
end
A --> B
C --> B
D --> A
D --> B
E --> A
E --> B
F --> D
G --> D
```

**Diagram sources**
- [20260715122802_add_custom_field_definitions.sql](file://apps/hr-suite/supabase/migrations/20260715122802_add_custom_field_definitions.sql)
- [20260715123119_add_custom_field_value_rpc.sql](file://apps/hr-suite/supabase/migrations/20260715123119_add_custom_field_value_rpc.sql)
- [20260715123927_harden_custom_field_values.sql](file://apps/hr-suite/supabase/migrations/20260715123927_harden_custom_field_values.sql)
- [route.ts](file://apps/hr-suite/app/api/custom-fields/route.ts)
- [route.ts](file://apps/hr-suite/app/api/custom-fields/[definitionId]/route.ts)
- [employee-custom-fields.tsx](file://apps/hr-suite/components/custom-fields/employee-custom-fields.tsx)
- [custom-field-manager.tsx](file://apps/hr-suite/components/custom-fields/custom-field-manager.tsx)

**Section sources**
- [20260715122802_add_custom_field_definitions.sql](file://apps/hr-suite/supabase/migrations/20260715122802_add_custom_field_definitions.sql)
- [20260715123119_add_custom_field_value_rpc.sql](file://apps/hr-suite/supabase/migrations/20260715123119_add_custom_field_value_rpc.sql)
- [20260715123927_harden_custom_field_values.sql](file://apps/hr-suite/supabase/migrations/20260715123927_harden_custom_field_values.sql)
- [route.ts](file://apps/hr-suite/app/api/custom-fields/route.ts)
- [route.ts](file://apps/hr-suite/app/api/custom-fields/[definitionId]/route.ts)
- [employee-custom-fields.tsx](file://apps/hr-suite/components/custom-fields/employee-custom-fields.tsx)
- [custom-field-manager.tsx](file://apps/hr-suite/components/custom-fields/custom-field-manager.tsx)

## Core Components
- Custom Field Definitions table stores metadata about each custom field, including field type, validation rules, labels, visibility, and scoping to HR entity types.
- Custom Field Values table stores dynamic values per entity instance using a JSONB column, enabling flexible data typing while preserving definition-driven validation at write time.
- RPC functions encapsulate value retrieval, validation, and conversion logic based on the associated definition.
- RLS policies enforce tenant isolation and role-based access control for both definitions and values.

Key responsibilities:
- Definitions: define schema-like constraints for otherwise unstructured JSONB values.
- Values: store typed payloads per entity reference (e.g., employee_id, employment_id).
- RPCs: centralize validation and conversion to ensure consistency across clients.
- Security: isolate data by tenant and restrict mutations via RBAC.

**Section sources**
- [20260715122802_add_custom_field_definitions.sql](file://apps/hr-suite/supabase/migrations/20260715122802_add_custom_field_definitions.sql)
- [20260715123119_add_custom_field_value_rpc.sql](file://apps/hr-suite/supabase/migrations/20260715123119_add_custom_field_value_rpc.sql)
- [20260715123927_harden_custom_field_values.sql](file://apps/hr-suite/supabase/migrations/20260715123927_harden_custom_field_values.sql)

## Architecture Overview
The custom fields architecture combines a rigid metadata layer (definitions) with a flexible data layer (JSONB values), enforced by server-side RPCs and RLS policies.

```mermaid
sequenceDiagram
participant UI as "Employee Custom Fields UI"
participant API as "Custom Fields API"
participant DB as "PostgreSQL (Definitions + Values)"
participant RPC as "Value RPC Functions"
participant POL as "RLS Policies"
UI->>API : "GET /api/custom-fields"
API->>DB : "Query definitions (tenant-scoped)"
DB-->>API : "Definitions list"
API-->>UI : "Definitions payload"
UI->>API : "POST /api/custom-fields/ : definitionId/value"
API->>RPC : "Validate and convert value"
RPC->>POL : "Check tenant and permissions"
POL-->>RPC : "Access granted/denied"
RPC->>DB : "Upsert JSONB value"
DB-->>RPC : "Success"
RPC-->>API : "Validated value"
API-->>UI : "Confirmation response"
```

**Diagram sources**
- [route.ts](file://apps/hr-suite/app/api/custom-fields/route.ts)
- [route.ts](file://apps/hr-suite/app/api/custom-fields/[definitionId]/route.ts)
- [20260715123119_add_custom_field_value_rpc.sql](file://apps/hr-suite/supabase/migrations/20260715123119_add_custom_field_value_rpc.sql)
- [20260715123927_harden_custom_field_values.sql](file://apps/hr-suite/supabase/migrations/20260715123927_harden_custom_field_values.sql)

## Detailed Component Analysis

### Data Model: Custom Field Definitions
- Purpose: Define the shape and behavior of custom fields.
- Attributes typically include:
  - Unique identifier and tenant scope
  - Human-readable label and description
  - Field type (string, number, boolean, date, enum, etc.)
  - Validation rules (required, min/max, regex, allowed values)
  - Display settings (order, visibility flags)
  - Entity scope (which HR entities can use the field)
- Indexing and constraints ensure efficient lookups and uniqueness within a tenant.

```mermaid
erDiagram
CUSTOM_FIELD_DEFINITIONS {
uuid id PK
uuid tenant_id FK
string name
string label
string field_type
jsonb validation_rules
jsonb display_metadata
uuid entity_scope
timestamp created_at
timestamp updated_at
}
```

**Diagram sources**
- [20260715122802_add_custom_field_definitions.sql](file://apps/hr-suite/supabase/migrations/20260715122802_add_custom_field_definitions.sql)

**Section sources**
- [20260715122802_add_custom_field_definitions.sql](file://apps/hr-suite/supabase/migrations/20260715122802_add_custom_field_definitions.sql)

### Data Model: Custom Field Values (JSONB)
- Purpose: Store dynamic, typed values per entity instance.
- Key attributes:
  - Reference to the definition
  - Reference to the target entity (e.g., employee_id or employment_id)
  - JSONB payload holding the actual value
  - Tenant isolation key
- JSONB enables flexible schemas while definitions enforce validation at write time.

```mermaid
erDiagram
CUSTOM_FIELD_VALUES {
uuid id PK
uuid definition_id FK
uuid entity_id FK
string entity_type
jsonb value
uuid tenant_id FK
timestamp created_at
timestamp updated_at
}
CUSTOM_FIELD_DEFINITIONS ||--o{ CUSTOM_FIELD_VALUES : "defines"
```

**Diagram sources**
- [20260715123119_add_custom_field_value_rpc.sql](file://apps/hr-suite/supabase/migrations/20260715123119_add_custom_field_value_rpc.sql)
- [20260715123927_harden_custom_field_values.sql](file://apps/hr-suite/supabase/migrations/20260715123927_harden_custom_field_values.sql)

**Section sources**
- [20260715123119_add_custom_field_value_rpc.sql](file://apps/hr-suite/supabase/migrations/20260715123119_add_custom_field_value_rpc.sql)
- [20260715123927_harden_custom_field_values.sql](file://apps/hr-suite/supabase/migrations/20260715123927_harden_custom_field_values.sql)

### RPC Functions: Value Retrieval, Validation, and Conversion
- Value retrieval:
  - Fetches values for a given entity and definition set.
  - Returns normalized payloads according to definition types.
- Validation:
  - Enforces required fields, type checks, and rule constraints from definitions.
  - Rejects invalid inputs early to maintain data integrity.
- Type conversion:
  - Converts raw JSONB values into application-friendly types.
  - Ensures consistent serialization across UI and services.

```mermaid
flowchart TD
Start(["RPC Entry"]) --> LoadDef["Load Definition by ID"]
LoadDef --> CheckTenant{"Tenant matches?"}
CheckTenant --> |No| Deny["Return Permission Error"]
CheckTenant --> |Yes| ValidateInput["Validate Input Against Rules"]
ValidateInput --> Valid{"Valid?"}
Valid --> |No| ReturnError["Return Validation Error"]
Valid --> |Yes| ConvertType["Convert to Target Type"]
ConvertType --> Upsert["Upsert JSONB Value"]
Upsert --> Success["Return Normalized Value"]
Deny --> End(["Exit"])
ReturnError --> End
Success --> End
```

**Diagram sources**
- [20260715123119_add_custom_field_value_rpc.sql](file://apps/hr-suite/supabase/migrations/20260715123119_add_custom_field_value_rpc.sql)
- [20260715123927_harden_custom_field_values.sql](file://apps/hr-suite/supabase/migrations/20260715123927_harden_custom_field_values.sql)

**Section sources**
- [20260715123119_add_custom_field_value_rpc.sql](file://apps/hr-suite/supabase/migrations/20260715123119_add_custom_field_value_rpc.sql)
- [20260715123927_harden_custom_field_values.sql](file://apps/hr-suite/supabase/migrations/20260715123927_harden_custom_field_values.sql)

### Security Model: Tenant Isolation and Permissions
- Tenant isolation:
  - All queries and mutations filter by tenant_id.
  - RLS policies prevent cross-tenant data access.
- Role-based access:
  - Roles determine who can read/write definitions and values.
  - Fine-grained policies protect sensitive fields and bulk operations.
- Auditability:
  - Timestamps and optional audit trails support compliance.

```mermaid
classDiagram
class TenantUser {
+uuid tenant_id
+string role
+can_read_definitions()
+can_write_definitions()
+can_read_values()
+can_write_values()
}
class RLS_Policies {
+filter_by_tenant()
+enforce_role_access()
}
class CustomFieldDefinitions {
+uuid tenant_id
+jsonb validation_rules
}
class CustomFieldValues {
+uuid tenant_id
+jsonb value
}
TenantUser --> RLS_Policies : "subject to"
RLS_Policies --> CustomFieldDefinitions : "guard"
RLS_Policies --> CustomFieldValues : "guard"
```

**Diagram sources**
- [20260715123927_harden_custom_field_values.sql](file://apps/hr-suite/supabase/migrations/20260715123927_harden_custom_field_values.sql)
- [custom_fields_isolation.sql](file://apps/hr-suite/supabase/tests/custom_fields_isolation.sql)

**Section sources**
- [20260715123927_harden_custom_field_values.sql](file://apps/hr-suite/supabase/migrations/20260715123927_harden_custom_field_values.sql)
- [custom_fields_isolation.sql](file://apps/hr-suite/supabase/tests/custom_fields_isolation.sql)

### Relationships to HR Entities
- Custom fields attach to HR entities such as employees and employments through foreign keys and entity_type discriminator.
- This allows per-entity customization without altering core tables.
- UI components render relevant fields based on entity context.

```mermaid
erDiagram
EMPLOYEES {
uuid id PK
uuid tenant_id FK
string first_name
string last_name
}
EMPLOYMENTS {
uuid id PK
uuid tenant_id FK
uuid employee_id FK
string status
}
CUSTOM_FIELD_VALUES ||--|| EMPLOYEES : "entity_id when entity_type='employee'"
CUSTOM_FIELD_VALUES ||--|| EMPLOYMENTS : "entity_id when entity_type='employment'"
```

**Diagram sources**
- [20260715123119_add_custom_field_value_rpc.sql](file://apps/hr-suite/supabase/migrations/20260715123119_add_custom_field_value_rpc.sql)
- [employee-custom-fields.tsx](file://apps/hr-suite/components/custom-fields/employee-custom-fields.tsx)

**Section sources**
- [20260715123119_add_custom_field_value_rpc.sql](file://apps/hr-suite/supabase/migrations/20260715123119_add_custom_field_value_rpc.sql)
- [employee-custom-fields.tsx](file://apps/hr-suite/components/custom-fields/employee-custom-fields.tsx)

### API Endpoints and Client Integration
- GET /api/custom-fields:
  - Returns available definitions scoped to the current tenant and user roles.
- POST /api/custom-fields/:definitionId/value:
  - Validates input against definition rules.
  - Persists normalized JSONB value.
- UI components consume these endpoints to render editors and managers.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant API as "Custom Fields API"
participant DB as "Definitions + Values"
FE->>API : "GET /api/custom-fields"
API->>DB : "Select definitions by tenant"
DB-->>API : "Definitions"
API-->>FE : "Definitions payload"
FE->>API : "POST /api/custom-fields/ : id/value"
API->>DB : "Validate and upsert value"
DB-->>API : "Success"
API-->>FE : "Normalized value"
```

**Diagram sources**
- [route.ts](file://apps/hr-suite/app/api/custom-fields/route.ts)
- [route.ts](file://apps/hr-suite/app/api/custom-fields/[definitionId]/route.ts)

**Section sources**
- [route.ts](file://apps/hr-suite/app/api/custom-fields/route.ts)
- [route.ts](file://apps/hr-suite/app/api/custom-fields/[definitionId]/route.ts)

### UI Components: Editing and Management
- Employee Custom Fields Editor:
  - Renders fields based on definitions for an employee context.
  - Submits validated values via API.
- Custom Field Manager:
  - Admin interface to create/edit definitions and assign entity scopes.

```mermaid
graph LR
Manager["Custom Field Manager"] --> API["/api/custom-fields"]
Editor["Employee Custom Fields Editor"] --> API
API --> DB["Definitions + Values"]
```

**Diagram sources**
- [custom-field-manager.tsx](file://apps/hr-suite/components/custom-fields/custom-field-manager.tsx)
- [employee-custom-fields.tsx](file://apps/hr-suite/components/custom-fields/employee-custom-fields.tsx)
- [route.ts](file://apps/hr-suite/app/api/custom-fields/route.ts)

**Section sources**
- [custom-field-manager.tsx](file://apps/hr-suite/components/custom-fields/custom-field-manager.tsx)
- [employee-custom-fields.tsx](file://apps/hr-suite/components/custom-fields/employee-custom-fields.tsx)
- [route.ts](file://apps/hr-suite/app/api/custom-fields/route.ts)

## Dependency Analysis
- Migrations establish schema, policies, and RPCs.
- API routes depend on definitions/values tables and invoke RPCs for validation/conversion.
- UI components depend on API endpoints and rely on definition metadata for rendering.

```mermaid
graph TB
M1["Mig: Definitions"] --> T1["Table: Definitions"]
M2["Mig: Value RPC"] --> F1["Function: Value RPC"]
M3["Mig: Harden Values"] --> P1["Policy: RLS"]
API1["API: /api/custom-fields"] --> T1
API1 --> F1
API2["API: /api/custom-fields/:id"] --> T1
API2 --> F1
UI1["UI: Custom Field Manager"] --> API1
UI2["UI: Employee Editor"] --> API2
F1 --> P1
```

**Diagram sources**
- [20260715122802_add_custom_field_definitions.sql](file://apps/hr-suite/supabase/migrations/20260715122802_add_custom_field_definitions.sql)
- [20260715123119_add_custom_field_value_rpc.sql](file://apps/hr-suite/supabase/migrations/20260715123119_add_custom_field_value_rpc.sql)
- [20260715123927_harden_custom_field_values.sql](file://apps/hr-suite/supabase/migrations/20260715123927_harden_custom_field_values.sql)
- [route.ts](file://apps/hr-suite/app/api/custom-fields/route.ts)
- [route.ts](file://apps/hr-suite/app/api/custom-fields/[definitionId]/route.ts)

**Section sources**
- [20260715122802_add_custom_field_definitions.sql](file://apps/hr-suite/supabase/migrations/20260715122802_add_custom_field_definitions.sql)
- [20260715123119_add_custom_field_value_rpc.sql](file://apps/hr-suite/supabase/migrations/20260715123119_add_custom_field_value_rpc.sql)
- [20260715123927_harden_custom_field_values.sql](file://apps/hr-suite/supabase/migrations/20260715123927_harden_custom_field_values.sql)
- [route.ts](file://apps/hr-suite/app/api/custom-fields/route.ts)
- [route.ts](file://apps/hr-suite/app/api/custom-fields/[definitionId]/route.ts)

## Performance Considerations
- Use indexes on frequently queried columns (tenant_id, entity_id, entity_type, definition_id).
- Prefer batched reads/writes where possible to reduce round trips.
- Keep JSONB payloads small and structured; avoid deeply nested structures unless necessary.
- Leverage RPCs to perform validation and conversion server-side to minimize client overhead.
- Cache definition metadata on the client for faster rendering, with invalidation on updates.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Permission denied:
  - Verify tenant_id alignment and user roles.
  - Inspect RLS policies for correct filters.
- Validation errors:
  - Ensure input conforms to definition validation_rules.
  - Check type conversions in RPCs.
- Missing values:
  - Confirm entity references and entity_type match expectations.
  - Validate that upsert paths are executed successfully.

**Section sources**
- [custom_fields_isolation.sql](file://apps/hr-suite/supabase/tests/custom_fields_isolation.sql)
- [20260715123927_harden_custom_field_values.sql](file://apps/hr-suite/supabase/migrations/20260715123927_harden_custom_field_values.sql)

## Conclusion
LiquidHR’s custom fields system balances flexibility and rigor by combining definition-driven metadata with JSONB-backed dynamic values. Server-side RPCs enforce validation and conversion, while RLS policies secure tenant isolation and role-based access. The design supports scalable extension of HR entity attributes without schema churn, enabling robust customization across tenants.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Examples: Creating Custom Fields and Validating Data
- Create a new definition with appropriate field_type and validation_rules.
- Assign entity_scope to limit applicability (e.g., employee or employment).
- Submit values via the API endpoint; the RPC validates and converts before persisting.

**Section sources**
- [20260715122802_add_custom_field_definitions.sql](file://apps/hr-suite/supabase/migrations/20260715122802_add_custom_field_definitions.sql)
- [20260715123119_add_custom_field_value_rpc.sql](file://apps/hr-suite/supabase/migrations/20260715123119_add_custom_field_value_rpc.sql)
- [route.ts](file://apps/hr-suite/app/api/custom-fields/route.ts)

### Migration Strategies and Backup Considerations
- Migrate definitions incrementally; test validation rules thoroughly before rollout.
- Back up both definitions and values to preserve tenant-specific configurations.
- Use versioned migrations to track changes and enable rollback if needed.

**Section sources**
- [20260715122802_add_custom_field_definitions.sql](file://apps/hr-suite/supabase/migrations/20260715122802_add_custom_field_definitions.sql)
- [20260715123119_add_custom_field_value_rpc.sql](file://apps/hr-suite/supabase/migrations/20260715123119_add_custom_field_value_rpc.sql)
- [20260715123927_harden_custom_field_values.sql](file://apps/hr-suite/supabase/migrations/20260715123927_harden_custom_field_values.sql)
- [20260715131230_seed_custom_fields_and_tenant_roles.sql](file://apps/hr-suite/supabase/migrations/20260715131230_seed_custom_fields_and_tenant_roles.sql)

### Requirements Context
- Refer to the custom fields requirements document for business context and usage patterns.

**Section sources**
- [VRIJE_VELDEN.md](file://docs/requirements/custom-fields/VRIJE_VELDEN.md)