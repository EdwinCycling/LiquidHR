# System Architecture

<cite>
**Referenced Files in This Document**
- [package.json](file://apps/hr-suite/package.json)
- [next.config.ts](file://apps/hr-suite/next.config.ts)
- [vercel.json](file://vercel.json)
- [proxy.ts](file://apps/hr-suite/proxy.ts)
- [layout.tsx](file://apps/hr-suite/app/layout.tsx)
- [page.tsx](file://apps/hr-suite/app/page.tsx)
- [route.ts](file://apps/hr-suite/app/api/context/route.ts)
- [route.ts](file://apps/hr-suite/app/api/employees/route.ts)
- [route.ts](file://apps/hr-suite/app/api/leave/request/route.ts)
- [config.toml](file://apps/hr-suite/supabase/config.toml)
- [20260712124911_add_tenant_rbac_and_organization.sql](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql)
- [20260714174305_add_multitenancy_administrations.sql](file://apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql)
- [20260722142551_add_leave_engine_foundation.sql](file://apps/hr-suite/supabase/migrations/20260722142551_add_leave_engine_foundation.sql)
- [types.ts](file://packages/db/types.ts)
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

## Introduction
This document describes the system architecture for LiquidHR, a multitenant HR suite built with Next.js 14+ on Vercel and powered by Supabase (PostgreSQL). It explains how frontend components interact with API routes, how business logic is organized, and how data flows to and from the database. It also covers deployment topology, infrastructure boundaries, technology stack decisions, scalability considerations, performance strategies, and monitoring approaches.

## Project Structure
LiquidHR is organized as a Next.js application under apps/hr-suite with:
- app/: Next.js App Router pages and API routes
- components/: Feature-based UI components
- lib/: Shared libraries and utilities
- supabase/: Database migrations, tests, and configuration
- packages/db/: Shared database types used across the project

Key configuration files include package.json (dependencies and scripts), next.config.ts (Next.js settings), vercel.json (Vercel deployment config), and proxy.ts (local development proxying).

```mermaid
graph TB
subgraph "Frontend (Next.js)"
APP["app/ (Pages + API Routes)"]
COMP["components/ (UI)"]
LIB["lib/ (Shared Logic)"]
end
subgraph "Backend Services"
API["API Routes (Serverless)"]
SUPABASE["Supabase Auth & Edge Functions"]
end
subgraph "Data Layer"
PG["PostgreSQL (Supabase)"]
MIGRATIONS["Migrations & Tests"]
end
APP --> API
COMP --> APP
LIB --> APP
API --> SUPABASE
SUPABASE --> PG
MIGRATIONS --> PG
```

**Diagram sources**
- [package.json](file://apps/hr-suite/package.json)
- [next.config.ts](file://apps/hr-suite/next.config.ts)
- [vercel.json](file://vercel.json)
- [proxy.ts](file://apps/hr-suite/proxy.ts)
- [config.toml](file://apps/hr-suite/supabase/config.toml)

**Section sources**
- [package.json](file://apps/hr-suite/package.json)
- [next.config.ts](file://apps/hr-suite/next.config.ts)
- [vercel.json](file://vercel.json)
- [proxy.ts](file://apps/hr-suite/proxy.ts)

## Core Components
- Frontend Application: Next.js App Router provides server-side rendering and routing. Pages render UI and fetch data via API routes or client-side calls.
- API Routes: REST endpoints under app/api handle authentication, authorization, tenant scoping, and business operations.
- Business Logic: Encapsulated in lib modules and invoked by API routes and components.
- Database Layer: PostgreSQL schema defined through migrations; Row-Level Security (RLS) enforces multitenancy and RBAC.
- Multitenancy: Administrations and organization tables scope data per tenant; policies ensure isolation.

**Section sources**
- [layout.tsx](file://apps/hr-suite/app/layout.tsx)
- [page.tsx](file://apps/hr-suite/app/page.tsx)
- [route.ts](file://apps/hr-suite/app/api/context/route.ts)
- [route.ts](file://apps/hr-suite/app/api/employees/route.ts)
- [20260712124911_add_tenant_rbac_and_organization.sql](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql)
- [20260714174305_add_multitenancy_administrations.sql](file://apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql)

## Architecture Overview
The system follows a layered architecture:
- Presentation Layer: React components and Next.js pages render the UI.
- API Layer: Serverless API routes process requests, enforce auth and tenant context, and orchestrate business logic.
- Data Layer: Supabase Postgres stores all domain data with RLS policies enforcing security and isolation.

```mermaid
graph TB
Client["Browser / Mobile"]
Vercel["Vercel Edge Runtime"]
NextJS["Next.js App Router"]
APIRoutes["API Routes"]
SupabaseAuth["Supabase Auth"]
SupabaseDB["Supabase PostgreSQL"]
Migrations["Database Migrations"]
Client --> Vercel
Vercel --> NextJS
NextJS --> APIRoutes
APIRoutes --> SupabaseAuth
APIRoutes --> SupabaseDB
Migrations --> SupabaseDB
```

**Diagram sources**
- [vercel.json](file://vercel.json)
- [next.config.ts](file://apps/hr-suite/next.config.ts)
- [route.ts](file://apps/hr-suite/app/api/context/route.ts)
- [config.toml](file://apps/hr-suite/supabase/config.toml)

## Detailed Component Analysis

### Frontend Application (Next.js App Router)
- Layout and Root: The root layout sets up global providers and styles. Pages define routes and compose feature components.
- Routing: File-based routing maps directories to URLs. Loading states are handled via dedicated loading files.
- Internationalization: Messages are organized per locale and loaded by features.

```mermaid
flowchart TD
Start(["Request to Page"]) --> Route["App Router Match"]
Route --> Layout["Render layout.tsx"]
Layout --> Page["Render page.tsx"]
Page --> Components["Load Feature Components"]
Components --> API["Call API Routes if needed"]
API --> End(["Response Rendered"])
```

**Diagram sources**
- [layout.tsx](file://apps/hr-suite/app/layout.tsx)
- [page.tsx](file://apps/hr-suite/app/page.tsx)

**Section sources**
- [layout.tsx](file://apps/hr-suite/app/layout.tsx)
- [page.tsx](file://apps/hr-suite/app/page.tsx)

### API Routes and Context
- Context Route: Establishes tenant context, user session, and permissions for subsequent requests.
- Employees Route: Handles employee CRUD operations scoped to the current tenant and role.
- Leave Request Route: Orchestrates leave request creation, validation, and ledger updates.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant API as "API Route"
participant AUTH as "Supabase Auth"
participant DB as "PostgreSQL"
FE->>API : "POST /api/leave/request"
API->>AUTH : "Validate session & tenant"
AUTH-->>API : "User context"
API->>DB : "Insert leave request"
DB-->>API : "Record created"
API-->>FE : "Success response"
```

**Diagram sources**
- [route.ts](file://apps/hr-suite/app/api/context/route.ts)
- [route.ts](file://apps/hr-suite/app/api/employees/route.ts)
- [route.ts](file://apps/hr-suite/app/api/leave/request/route.ts)

**Section sources**
- [route.ts](file://apps/hr-suite/app/api/context/route.ts)
- [route.ts](file://apps/hr-suite/app/api/employees/route.ts)
- [route.ts](file://apps/hr-suite/app/api/leave/request/route.ts)

### Database Schema and Multitenancy
- Tenant and RBAC: Migrations introduce tenants, roles, and organization scoping. Policies enforce row-level access based on tenant membership and roles.
- Administrations: Separate administration entities isolate data per customer or legal entity.
- Leave Engine: Dedicated schema supports leave types, accrual rules, and transaction ledgers.

```mermaid
erDiagram
TENANT {
uuid id PK
string name
timestamp created_at
}
ADMINISTRATION {
uuid id PK
uuid tenant_id FK
string code
timestamp created_at
}
EMPLOYEE {
uuid id PK
uuid administration_id FK
string email
timestamp created_at
}
LEAVE_TYPE {
uuid id PK
uuid administration_id FK
string name
boolean active
}
LEAVE_REQUEST {
uuid id PK
uuid employee_id FK
uuid leave_type_id FK
date start_date
date end_date
enum status
}
TENANT ||--o{ ADMINISTRATION : "has many"
ADMINISTRATION ||--o{ EMPLOYEE : "contains"
ADMINISTRATION ||--o{ LEAVE_TYPE : "defines"
EMPLOYEE ||--o{ LEAVE_REQUEST : "submits"
LEAVE_TYPE ||--o{ LEAVE_REQUEST : "governs"
```

**Diagram sources**
- [20260712124911_add_tenant_rbac_and_organization.sql](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql)
- [20260714174305_add_multitenancy_administrations.sql](file://apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql)
- [20260722142551_add_leave_engine_foundation.sql](file://apps/hr-suite/supabase/migrations/20260722142551_add_leave_engine_foundation.sql)

**Section sources**
- [20260712124911_add_tenant_rbac_and_organization.sql](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql)
- [20260714174305_add_multitenancy_administrations.sql](file://apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql)
- [20260722142551_add_leave_engine_foundation.sql](file://apps/hr-suite/supabase/migrations/20260722142551_add_leave_engine_foundation.sql)

### Shared Types and Contracts
- Database Types: Centralized TypeScript definitions for database models ensure type safety between frontend, API, and backend.

```mermaid
classDiagram
class Employee {
+uuid id
+uuid administrationId
+string email
+datetime createdAt
}
class Administration {
+uuid id
+uuid tenantId
+string code
+datetime createdAt
}
class LeaveType {
+uuid id
+uuid administrationId
+string name
+boolean active
}
class LeaveRequest {
+uuid id
+uuid employeeId
+uuid leaveTypeId
+date startDate
+date endDate
+enum status
}
Employee --> Administration : "belongsTo"
LeaveRequest --> Employee : "belongsTo"
LeaveRequest --> LeaveType : "belongsTo"
```

**Diagram sources**
- [types.ts](file://packages/db/types.ts)

**Section sources**
- [types.ts](file://packages/db/types.ts)

## Dependency Analysis
Dependencies are managed via npm and configured for Next.js and Supabase integration. Local development uses a proxy to route API calls to Supabase services.

```mermaid
graph LR
PKG["package.json"]
NEXT["next.config.ts"]
VERCEL["vercel.json"]
PROXY["proxy.ts"]
SUPABASE_CFG["supabase/config.toml"]
PKG --> NEXT
PKG --> PROXY
VERCEL --> NEXT
PROXY --> SUPABASE_CFG
```

**Diagram sources**
- [package.json](file://apps/hr-suite/package.json)
- [next.config.ts](file://apps/hr-suite/next.config.ts)
- [vercel.json](file://vercel.json)
- [proxy.ts](file://apps/hr-suite/proxy.ts)
- [config.toml](file://apps/hr-suite/supabase/config.toml)

**Section sources**
- [package.json](file://apps/hr-suite/package.json)
- [next.config.ts](file://apps/hr-suite/next.config.ts)
- [vercel.json](file://vercel.json)
- [proxy.ts](file://apps/hr-suite/proxy.ts)
- [config.toml](file://apps/hr-suite/supabase/config.toml)

## Performance Considerations
- Rendering Strategy: Use server-side rendering for initial load and client-side hydration for interactivity.
- Data Fetching: Prefer API routes for server-side data access to leverage caching and reduce payload size.
- Database Optimization: Leverage indexes and RLS policies to minimize query overhead and ensure secure scoping.
- Caching: Utilize Next.js caching headers and Supabase edge functions where appropriate.
- Bundle Size: Tree-shake unused dependencies and split routes to improve load times.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Authentication Issues: Verify Supabase Auth configuration and session handling in API routes.
- Authorization Errors: Check RLS policies and tenant scoping in migrations and policies.
- API Failures: Inspect error responses from API routes and validate input payloads.
- Database Connectivity: Ensure environment variables and proxy settings point to the correct Supabase instance.

**Section sources**
- [route.ts](file://apps/hr-suite/app/api/context/route.ts)
- [20260712124911_add_tenant_rbac_and_organization.sql](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql)

## Conclusion
LiquidHR’s architecture combines Next.js for a responsive frontend, Supabase for secure backend services, and PostgreSQL for robust data storage. Multitenancy is enforced through clear scoping and policies, ensuring data isolation and security. The modular structure supports scalability and maintainability, while performance optimizations and monitoring practices help deliver a reliable HR platform.