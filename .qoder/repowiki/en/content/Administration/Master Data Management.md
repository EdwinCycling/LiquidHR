# Master Data Management

<cite>
**Referenced Files in This Document**
- [master-data page](file://apps/hr-suite/app/(dashboard)/master-data/page.tsx)
- [jobs page](file://apps/hr-suite/app/(dashboard)/master-data/jobs/page.tsx)
- [salary-scales page](file://apps/hr-suite/app/(dashboard)/master-data/salary-scales/page.tsx)
- [end-reasons page](file://apps/hr-suite/app/(dashboard)/master-data/end-reasons/page.tsx)
- [job-catalog-manager component](file://apps/hr-suite/components/master-data/job-catalog-manager.tsx)
- [salary-scale-manager component](file://apps/hr-suite/components/master-data/salary-scale-manager.tsx)
- [end-reason-manager component](file://apps/hr-suite/components/master-data/end-reason-manager.tsx)
- [catalog-managers component](file://apps/hr-suite/components/master-data/catalog-managers.tsx)
- [master-data jobs API route](file://apps/hr-suite/app/api/master-data/jobs/route.ts)
- [master-data job-groups API route](file://apps/hr-suite/app/api/master-data/job-groups/route.ts)
- [master-data salary-scales API route](file://apps/hr-suite/app/api/master-data/salary-scales/route.ts)
- [master-data end-reasons API route](file://apps/hr-suite/app/api/master-data/end-reasons/route.ts)
- [master-data document-categories API route](file://apps/hr-suite/app/api/master-data/document-categories/route.ts)
- [master-data relation-types API route](file://apps/hr-suite/app/api/master-data/relation-types/route.ts)
- [20260718100000_add_job_catalog_salary_revisions.sql](file://apps/hr-suite/supabase/migrations/20260718100000_add_job_catalog_salary_revisions.sql)
- [20260718100500_add_master_data_mutation_rpcs.sql](file://apps/hr-suite/supabase/migrations/20260718100500_add_master_data_mutation_rpcs.sql)
- [20260718100600_index_master_data_foreign_keys.sql](file://apps/hr-suite/supabase/migrations/20260718100600_index_master_data_foreign_keys.sql)
- [20260718131000_harden_hr_master_data_document_policies.sql](file://apps/hr-suite/supabase/migrations/20260718131000_harden_hr_master_data_document_policies.sql)
- [job_catalog_salary_revisions test](file://apps/hr-suite/supabase/tests/job_catalog_salary_revisions.sql)
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
This document explains LiquidHR’s Master Data Management (MDM) system with a focus on:
- Job catalog administration: job definitions, job groups, and position hierarchies
- Salary scale management: grade structures, step progression, and revision history tracking
- End reason configuration for employment terminations and transitions
- Document category management for employee documentation organization
It also covers data validation, referential integrity, version control for master data changes, multi-tenant isolation of reference data, RPC functions for mutations, and performance optimization strategies for large datasets. Practical examples are provided to guide administrators through common tasks.

## Project Structure
The MDM feature spans UI pages, reusable components, Next.js API routes, and Supabase migrations that define schemas, indexes, policies, and RPCs. The key areas are:
- Dashboard pages under the master-data section for browsing and editing
- Reusable managers for each domain (jobs, salary scales, end reasons)
- API routes exposing CRUD operations for master data entities
- Database migrations defining tables, constraints, indexes, RLS policies, and RPC functions

```mermaid
graph TB
subgraph "Dashboard Pages"
MDPage["Master Data Page"]
JobsPage["Jobs Page"]
ScalesPage["Salary Scales Page"]
EndReasonsPage["End Reasons Page"]
end
subgraph "Components"
CatalogManagers["Catalog Managers"]
JobManager["Job Catalog Manager"]
ScaleManager["Salary Scale Manager"]
EndReasonManager["End Reason Manager"]
end
subgraph "API Routes"
JobsAPI["/api/master-data/jobs"]
GroupsAPI["/api/master-data/job-groups"]
ScalesAPI["/api/master-data/salary-scales"]
EndReasonsAPI["/api/master-data/end-reasons"]
DocCatsAPI["/api/master-data/document-categories"]
RelTypesAPI["/api/master-data/relation-types"]
end
subgraph "Database Layer"
Migrations["Supabase Migrations<br/>Schema, Policies, Indexes, RPCs"]
end
MDPage --> CatalogManagers
JobsPage --> JobManager
ScalesPage --> ScaleManager
EndReasonsPage --> EndReasonManager
JobManager --> JobsAPI
ScaleManager --> ScalesAPI
EndReasonManager --> EndReasonsAPI
CatalogManagers --> DocCatsAPI
CatalogManagers --> RelTypesAPI
JobsAPI --> Migrations
GroupsAPI --> Migrations
ScalesAPI --> Migrations
EndReasonsAPI --> Migrations
DocCatsAPI --> Migrations
RelTypesAPI --> Migrations
```

**Diagram sources**
- [master-data page](file://apps/hr-suite/app/(dashboard)/master-data/page.tsx)
- [jobs page](file://apps/hr-suite/app/(dashboard)/master-data/jobs/page.tsx)
- [salary-scales page](file://apps/hr-suite/app/(dashboard)/master-data/salary-scales/page.tsx)
- [end-reasons page](file://apps/hr-suite/app/(dashboard)/master-data/end-reasons/page.tsx)
- [catalog-managers component](file://apps/hr-suite/components/master-data/catalog-managers.tsx)
- [job-catalog-manager component](file://apps/hr-suite/components/master-data/job-catalog-manager.tsx)
- [salary-scale-manager component](file://apps/hr-suite/components/master-data/salary-scale-manager.tsx)
- [end-reason-manager component](file://apps/hr-suite/components/master-data/end-reason-manager.tsx)
- [master-data jobs API route](file://apps/hr-suite/app/api/master-data/jobs/route.ts)
- [master-data job-groups API route](file://apps/hr-suite/app/api/master-data/job-groups/route.ts)
- [master-data salary-scales API route](file://apps/hr-suite/app/api/master-data/salary-scales/route.ts)
- [master-data end-reasons API route](file://apps/hr-suite/app/api/master-data/end-reasons/route.ts)
- [master-data document-categories API route](file://apps/hr-suite/app/api/master-data/document-categories/route.ts)
- [master-data relation-types API route](file://apps/hr-suite/app/api/master-data/relation-types/route.ts)
- [20260718100000_add_job_catalog_salary_revisions.sql](file://apps/hr-suite/supabase/migrations/20260718100000_add_job_catalog_salary_revisions.sql)
- [20260718100500_add_master_data_mutation_rpcs.sql](file://apps/hr-suite/supabase/migrations/20260718100500_add_master_data_mutation_rpcs.sql)
- [20260718100600_index_master_data_foreign_keys.sql](file://apps/hr-suite/supabase/migrations/20260718100600_index_master_data_foreign_keys.sql)
- [20260718131000_harden_hr_master_data_document_policies.sql](file://apps/hr-suite/supabase/migrations/20260718131000_harden_hr_master_data_document_policies.sql)

**Section sources**
- [master-data page](file://apps/hr-suite/app/(dashboard)/master-data/page.tsx)
- [jobs page](file://apps/hr-suite/app/(dashboard)/master-data/jobs/page.tsx)
- [salary-scales page](file://apps/hr-suite/app/(dashboard)/master-data/salary-scales/page.tsx)
- [end-reasons page](file://apps/hr-suite/app/(dashboard)/master-data/end-reasons/page.tsx)
- [catalog-managers component](file://apps/hr-suite/components/master-data/catalog-managers.tsx)
- [job-catalog-manager component](file://apps/hr-suite/components/master-data/job-catalog-manager.tsx)
- [salary-scale-manager component](file://apps/hr-suite/components/master-data/salary-scale-manager.tsx)
- [end-reason-manager component](file://apps/hr-suite/components/master-data/end-reason-manager.tsx)
- [master-data jobs API route](file://apps/hr-suite/app/api/master-data/jobs/route.ts)
- [master-data job-groups API route](file://apps/hr-suite/app/api/master-data/job-groups/route.ts)
- [master-data salary-scales API route](file://apps/hr-suite/app/api/master-data/salary-scales/route.ts)
- [master-data end-reasons API route](file://apps/hr-suite/app/api/master-data/end-reasons/route.ts)
- [master-data document-categories API route](file://apps/hr-suite/app/api/master-data/document-categories/route.ts)
- [master-data relation-types API route](file://apps/hr-suite/app/api/master-data/relation-types/route.ts)
- [20260718100000_add_job_catalog_salary_revisions.sql](file://apps/hr-suite/supabase/migrations/20260718100000_add_job_catalog_salary_revisions.sql)
- [20260718100500_add_master_data_mutation_rpcs.sql](file://apps/hr-suite/supabase/migrations/20260718100500_add_master_data_mutation_rpcs.sql)
- [20260718100600_index_master_data_foreign_keys.sql](file://apps/hr-suite/supabase/migrations/20260718100600_index_master_data_foreign_keys.sql)
- [20260718131000_harden_hr_master_data_document_policies.sql](file://apps/hr-suite/supabase/migrations/20260718131000_harden_hr_master_data_document_policies.sql)

## Core Components
- Job Catalog Manager: Provides interfaces to create and manage job definitions, group them, and maintain hierarchical relationships among positions.
- Salary Scale Manager: Enables definition of grades, steps, and revisions; supports versioning and auditability of salary structures over time.
- End Reason Manager: Configures termination and transition reasons used across employments.
- Catalog Managers: Central hub for managing related catalogs such as document categories and relation types.

These components interact with API routes that enforce validation, authorization, and persistence via Supabase.

**Section sources**
- [job-catalog-manager component](file://apps/hr-suite/components/master-data/job-catalog-manager.tsx)
- [salary-scale-manager component](file://apps/hr-suite/components/master-data/salary-scale-manager.tsx)
- [end-reason-manager component](file://apps/hr-suite/components/master-data/end-reason-manager.tsx)
- [catalog-managers component](file://apps/hr-suite/components/master-data/catalog-managers.tsx)

## Architecture Overview
The MDM architecture follows a layered approach:
- Presentation layer: Dashboard pages and reusable manager components
- API layer: Next.js routes handling request validation, authorization checks, and orchestration
- Data layer: Supabase schema with RLS policies, foreign keys, indexes, and RPC functions for complex mutations

```mermaid
sequenceDiagram
participant Admin as "Admin UI"
participant Route as "Next.js API Route"
participant DB as "Supabase (Tables/RLS/RPC)"
participant Cache as "Client Cache"
Admin->>Route : "POST /api/master-data/jobs"
Route->>Route : "Validate payload"
Route->>DB : "Insert job row (RLS enforced)"
DB-->>Route : "Created record"
Route-->>Admin : "Success response"
Admin->>Cache : "Invalidate/update cache"
```

**Diagram sources**
- [master-data jobs API route](file://apps/hr-suite/app/api/master-data/jobs/route.ts)
- [20260718100500_add_master_data_mutation_rpcs.sql](file://apps/hr-suite/supabase/migrations/20260718100500_add_master_data_mutation_rpcs.sql)

## Detailed Component Analysis

### Job Catalog Administration
Job catalog administration includes:
- Job definitions: core attributes describing roles and responsibilities
- Job groups: logical grouping of jobs for reporting and access control
- Position hierarchies: parent-child relationships to model organizational structure

Implementation highlights:
- UI flows are driven by the Job Catalog Manager component
- API routes handle creation, updates, and deletions with validation
- Database schema enforces referential integrity and tenant isolation

Practical example: Creating a job profile
- Navigate to the Jobs page
- Use the manager to define job attributes and assign to a job group
- Save and verify visibility within the tenant scope

```mermaid
flowchart TD
Start(["Open Jobs Page"]) --> Create["Create New Job Definition"]
Create --> DefineAttrs["Define Attributes and Metadata"]
DefineAttrs --> AssignGroup["Assign to Job Group"]
AssignGroup --> Validate["Validate Inputs"]
Validate --> Persist["Persist via API Route"]
Persist --> Confirm["Confirm Success"]
Confirm --> End(["Done"])
```

**Section sources**
- [jobs page](file://apps/hr-suite/app/(dashboard)/master-data/jobs/page.tsx)
- [job-catalog-manager component](file://apps/hr-suite/components/master-data/job-catalog-manager.tsx)
- [master-data jobs API route](file://apps/hr-suite/app/api/master-data/jobs/route.ts)
- [master-data job-groups API route](file://apps/hr-suite/app/api/master-data/job-groups/route.ts)

### Salary Scale Management
Salary scale management supports:
- Grade structures: defining levels or bands
- Step progression: incremental steps within grades
- Revision history: versioned changes to scales over time

Key aspects:
- Salary Scale Manager provides UI for creating grades/steps and publishing revisions
- API routes ensure consistent state transitions and validations
- Database migrations introduce revision tables and constraints to preserve historical accuracy

Practical example: Defining a salary structure
- Open the Salary Scales page
- Create a new scale with grades and steps
- Publish a revision when changes are approved
- Review revision history for auditability

```mermaid
classDiagram
class SalaryScale {
+id
+name
+currency
+isActive
}
class Grade {
+id
+scaleId
+level
+minStep
+maxStep
}
class Step {
+id
+gradeId
+stepNumber
+amount
}
class Revision {
+id
+scaleId
+version
+effectiveDate
+createdBy
}
SalaryScale ||--o{ Grade : "has many"
Grade ||--o{ Step : "has many"
SalaryScale ||--o{ Revision : "tracked by"
```

**Diagram sources**
- [salary-scale-manager component](file://apps/hr-suite/components/master-data/salary-scale-manager.tsx)
- [20260718100000_add_job_catalog_salary_revisions.sql](file://apps/hr-suite/supabase/migrations/20260718100000_add_job_catalog_salary_revisions.sql)

**Section sources**
- [salary-scales page](file://apps/hr-suite/app/(dashboard)/master-data/salary-scales/page.tsx)
- [salary-scale-manager component](file://apps/hr-suite/components/master-data/salary-scale-manager.tsx)
- [master-data salary-scales API route](file://apps/hr-suite/app/api/master-data/salary-scales/route.ts)
- [20260718100000_add_job_catalog_salary_revisions.sql](file://apps/hr-suite/supabase/migrations/20260718100000_add_job_catalog_salary_revisions.sql)

### End Reason Configuration
End reasons capture termination and transition reasons for employments. They are referenced during termination workflows to standardize outcomes and reporting.

Implementation highlights:
- End Reason Manager provides CRUD operations
- API routes validate inputs and enforce tenant scoping
- Referential integrity ensures only valid reasons are used in employment records

Practical example: Configuring a termination reason
- Go to the End Reasons page
- Add a new reason with descriptive metadata
- Save and use it in termination forms

```mermaid
flowchart TD
Start(["Open End Reasons Page"]) --> Add["Add New End Reason"]
Add --> SetDetails["Set Details and Scope"]
SetDetails --> Validate["Validate Inputs"]
Validate --> Save["Save via API Route"]
Save --> Verify["Verify Availability in Employment Forms"]
Verify --> End(["Done"])
```

**Section sources**
- [end-reasons page](file://apps/hr-suite/app/(dashboard)/master-data/end-reasons/page.tsx)
- [end-reason-manager component](file://apps/hr-suite/components/master-data/end-reason-manager.tsx)
- [master-data end-reasons API route](file://apps/hr-suite/app/api/master-data/end-reasons/route.ts)

### Document Category Management
Document categories organize employee documents into structured folders or tags. They support consistent categorization across tenants.

Implementation highlights:
- Catalog Managers expose endpoints for document categories
- API routes handle creation, updates, and deletion with validation
- Policies ensure tenant isolation and controlled access

Practical example: Organizing document categories
- Access the Catalog Managers interface
- Create categories and assign hierarchy if needed
- Apply categories when uploading or organizing employee documents

```mermaid
flowchart TD
Start(["Open Catalog Managers"]) --> CreateCat["Create Document Category"]
CreateCat --> DefineHierarchy["Define Hierarchy (optional)"]
DefineHierarchy --> Validate["Validate Inputs"]
Validate --> Persist["Persist via API Route"]
Persist --> Apply["Apply Categories to Documents"]
Apply --> End(["Done"])
```

**Section sources**
- [catalog-managers component](file://apps/hr-suite/components/master-data/catalog-managers.tsx)
- [master-data document-categories API route](file://apps/hr-suite/app/api/master-data/document-categories/route.ts)

## Dependency Analysis
Master data modules depend on shared infrastructure:
- API routes rely on Supabase for persistence, RLS policies for security, and indexes for performance
- UI components depend on API routes for data operations and caching strategies
- Migrations define schema, constraints, and RPCs enabling complex transactions

```mermaid
graph LR
UI["UI Components"] --> API["API Routes"]
API --> DB["Supabase Schema & Policies"]
API --> RPC["RPC Functions"]
DB --> IDX["Indexes"]
DB --> POL["RLS Policies"]
```

**Diagram sources**
- [master-data jobs API route](file://apps/hr-suite/app/api/master-data/jobs/route.ts)
- [master-data salary-scales API route](file://apps/hr-suite/app/api/master-data/salary-scales/route.ts)
- [master-data end-reasons API route](file://apps/hr-suite/app/api/master-data/end-reasons/route.ts)
- [master-data document-categories API route](file://apps/hr-suite/app/api/master-data/document-categories/route.ts)
- [20260718100500_add_master_data_mutation_rpcs.sql](file://apps/hr-suite/supabase/migrations/20260718100500_add_master_data_mutation_rpcs.sql)
- [20260718100600_index_master_data_foreign_keys.sql](file://apps/hr-suite/supabase/migrations/20260718100600_index_master_data_foreign_keys.sql)
- [20260718131000_harden_hr_master_data_document_policies.sql](file://apps/hr-suite/supabase/migrations/20260718131000_harden_hr_master_data_document_policies.sql)

**Section sources**
- [master-data jobs API route](file://apps/hr-suite/app/api/master-data/jobs/route.ts)
- [master-data salary-scales API route](file://apps/hr-suite/app/api/master-data/salary-scales/route.ts)
- [master-data end-reasons API route](file://apps/hr-suite/app/api/master-data/end-reasons/route.ts)
- [master-data document-categories API route](file://apps/hr-suite/app/api/master-data/document-categories/route.ts)
- [20260718100500_add_master_data_mutation_rpcs.sql](file://apps/hr-suite/supabase/migrations/20260718100500_add_master_data_mutation_rpcs.sql)
- [20260718100600_index_master_data_foreign_keys.sql](file://apps/hr-suite/supabase/migrations/20260718100600_index_master_data_foreign_keys.sql)
- [20260718131000_harden_hr_master_data_document_policies.sql](file://apps/hr-suite/supabase/migrations/20260718131000_harden_hr_master_data_document_policies.sql)

## Performance Considerations
To optimize MDM operations for large datasets:
- Leverage indexes on foreign keys and frequently queried columns to reduce lookup times
- Use pagination and filtering in API responses to limit payload sizes
- Implement client-side caching and invalidation strategies to minimize redundant requests
- Batch mutations where possible to reduce network overhead
- Ensure RLS policies are efficient and scoped to tenant identifiers to avoid full-table scans

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Validation errors: Check input payloads against expected schemas; ensure required fields are present
- Authorization failures: Verify user permissions and tenant scoping; confirm RLS policies allow access
- Referential integrity violations: Ensure referenced IDs exist and belong to the same tenant
- Performance bottlenecks: Inspect query plans, add missing indexes, and reduce result sets with filters

**Section sources**
- [master-data jobs API route](file://apps/hr-suite/app/api/master-data/jobs/route.ts)
- [master-data salary-scales API route](file://apps/hr-suite/app/api/master-data/salary-scales/route.ts)
- [master-data end-reasons API route](file://apps/hr-suite/app/api/master-data/end-reasons/route.ts)
- [master-data document-categories API route](file://apps/hr-suite/app/api/master-data/document-categories/route.ts)
- [20260718131000_harden_hr_master_data_document_policies.sql](file://apps/hr-suite/supabase/migrations/20260718131000_harden_hr_master_data_document_policies.sql)

## Conclusion
LiquidHR’s Master Data Management system provides robust tools for administering job catalogs, salary scales, end reasons, and document categories. With strong validation, referential integrity, version control, and multi-tenant isolation, it ensures reliable and scalable master data operations. API routes and RPC functions enable efficient mutations, while indexes and policies optimize performance and security.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Practical Examples Summary
- Creating a job profile: Use the Jobs page and Job Catalog Manager to define attributes and assign groups
- Defining a salary structure: Use the Salary Scales page and Salary Scale Manager to set grades, steps, and publish revisions
- Configuring termination reasons: Use the End Reasons page and End Reason Manager to add and manage reasons
- Organizing document categories: Use Catalog Managers to create and apply categories consistently

[No sources needed since this section provides general guidance]

### Version Control and Auditability
- Salary scale revisions are tracked to maintain historical accuracy
- Changes to master data should follow approval workflows before publication
- Audit trails can be extended via event projections or change logs

**Section sources**
- [20260718100000_add_job_catalog_salary_revisions.sql](file://apps/hr-suite/supabase/migrations/20260718100000_add_job_catalog_salary_revisions.sql)
- [job_catalog_salary_revisions test](file://apps/hr-suite/supabase/tests/job_catalog_salary_revisions.sql)

### Multi-Tenant Isolation
- All master data is scoped to tenants via policies and foreign keys
- API routes enforce tenant context from authentication
- Queries and mutations must include tenant identifiers to prevent cross-tenant data leakage

**Section sources**
- [20260718131000_harden_hr_master_data_document_policies.sql](file://apps/hr-suite/supabase/migrations/20260718131000_harden_hr_master_data_document_policies.sql)
- [20260718100600_index_master_data_foreign_keys.sql](file://apps/hr-suite/supabase/migrations/20260718100600_index_master_data_foreign_keys.sql)