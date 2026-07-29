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
- [20260729064035_country_scoped_employment_end_reasons.sql](file://apps/hr-suite/supabase/migrations/20260729064035_country_scoped_employment_end_reasons.sql)
- [20260729070552_normalize_nl_employment_end_reasons.sql](file://apps/hr-suite/supabase/migrations/20260729070552_normalize_nl_employment_end_reasons.sql)
- [job_catalog_salary_revisions test](file://apps/hr-suite/supabase/tests/job_catalog_salary_revisions.sql)
</cite>

## Update Summary
**Changes Made**
- Added country-scoped employment end reasons with 144 additional lines of functionality for enhanced localization support
- Enhanced job catalog management with improved UI components and better employment record integration
- Expanded end reason management capabilities with comprehensive country-specific termination reasons
- Improved master data APIs with enhanced validation, error handling, and multi-country support
- Updated database schema to support country-scoped reference data with proper tenant isolation

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Country-Scoped End Reasons](#country-scoped-end-reasons)
7. [Dependency Analysis](#dependency-analysis)
8. [Performance Considerations](#performance-considerations)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Conclusion](#conclusion)
11. [Appendices](#appendices)

## Introduction
This document explains LiquidHR's Master Data Management (MDM) system with a focus on:
- Job catalog administration: job definitions, job groups, and position hierarchies with enhanced UI components
- Salary scale management: grade structures, step progression, and revision history tracking
- **Enhanced** End reason configuration for employment terminations and transitions with country-specific support
- Document category management for employee documentation organization
- **New** Country-scoped employment end reasons for international compliance and localization

The system now provides improved UI components for job catalog management, comprehensive job group support, enhanced master data APIs with better validation and error handling, and significantly expanded end reason management with country-specific termination reasons. It covers data validation, referential integrity, version control for master data changes, multi-tenant isolation of reference data, RPC functions for mutations, and performance optimization strategies for large datasets. Practical examples are provided to guide administrators through common tasks across multiple countries and regions.

## Project Structure
The MDM feature spans UI pages, reusable components, Next.js API routes, and Supabase migrations that define schemas, indexes, policies, and RPCs. The key areas are:
- Dashboard pages under the master-data section for browsing and editing
- Reusable managers for each domain (jobs, salary scales, end reasons)
- API routes exposing CRUD operations for master data entities
- Database migrations defining tables, constraints, indexes, RLS policies, and RPCs
- **New** Country-scoped end reason management with internationalization support

```mermaid
graph TB
subgraph "Dashboard Pages"
MDPage["Master Data Page"]
JobsPage["Jobs Page<br/>Enhanced UI"]
ScalesPage["Salary Scales Page"]
EndReasonsPage["End Reasons Page<br/>Country-Scoped"]
end
subgraph "Components"
CatalogManagers["Catalog Managers"]
JobManager["Job Catalog Manager<br/>Enhanced UI"]
ScaleManager["Salary Scale Manager"]
EndReasonManager["End Reason Manager<br/>Country-Specific"]
end
subgraph "API Routes"
JobsAPI["/api/master-data/jobs<br/>Enhanced"]
GroupsAPI["/api/master-data/job-groups<br/>New"]
ScalesAPI["/api/master-data/salary-scales"]
EndReasonsAPI["/api/master-data/end-reasons<br/>Country-Scoped"]
DocCatsAPI["/api/master-data/document-categories"]
RelTypesAPI["/api/master-data/relation-types"]
end
subgraph "Database Layer"
Migrations["Supabase Migrations<br/>Schema, Policies, Indexes, RPCs<br/>Country-Scoped Support"]
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
- [20260729064035_country_scoped_employment_end_reasons.sql](file://apps/hr-suite/supabase/migrations/20260729064035_country_scoped_employment_end_reasons.sql)
- [20260729070552_normalize_nl_employment_end_reasons.sql](file://apps/hr-suite/supabase/migrations/20260729070552_normalize_nl_employment_end_reasons.sql)

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
- [20260729064035_country_scoped_employment_end_reasons.sql](file://apps/hr-suite/supabase/migrations/20260729064035_country_scoped_employment_end_reasons.sql)
- [20260729070552_normalize_nl_employment_end_reasons.sql](file://apps/hr-suite/supabase/migrations/20260729070552_normalize_nl_employment_end_reasons.sql)

## Core Components
- **Enhanced Job Catalog Manager**: Provides improved UI interfaces to create and manage job definitions, comprehensive job group management, and maintain hierarchical relationships among positions with better employment record integration.
- **Salary Scale Manager**: Enables definition of grades, steps, and revisions; supports versioning and auditability of salary structures over time.
- **Enhanced End Reason Manager**: Configures termination and transition reasons used across employments with country-specific support and internationalization capabilities.
- **Catalog Managers**: Central hub for managing related catalogs such as document categories and relation types.

These components interact with enhanced API routes that enforce validation, authorization, and persistence via Supabase, with improved error handling and better integration with employment workflows. The end reason manager now includes significant enhancements for country-specific termination reasons.

**Section sources**
- [job-catalog-manager component](file://apps/hr-suite/components/master-data/job-catalog-manager.tsx)
- [salary-scale-manager component](file://apps/hr-suite/components/master-data/salary-scale-manager.tsx)
- [end-reason-manager component](file://apps/hr-suite/components/master-data/end-reason-manager.tsx)
- [catalog-managers component](file://apps/hr-suite/components/master-data/catalog-managers.tsx)

## Architecture Overview
The MDM architecture follows a layered approach with enhanced integration points and country-specific support:
- Presentation layer: Dashboard pages and reusable manager components with improved UI components and country-specific features
- API layer: Next.js routes handling request validation, authorization checks, orchestration, and enhanced error handling with country context
- Data layer: Supabase schema with RLS policies, foreign keys, indexes, and RPC functions for complex mutations including country-scoped data

```mermaid
sequenceDiagram
participant Admin as "Admin UI<br/>Enhanced with Country Support"
participant Route as "Next.js API Route<br/>Enhanced"
participant DB as "Supabase (Tables/RLS/RPC)<br/>Country-Scoped"
participant Employment as "Employment Records"
participant Cache as "Client Cache"
Admin->>Route : "POST /api/master-data/end-reasons<br/>(with country context)"
Route->>Route : "Validate payload & Enhanced checks<br/>+ Country scoping"
Route->>DB : "Insert end reason row (RLS enforced)<br/>+ Country scope validation"
DB-->>Route : "Created record with country scope"
Route->>Employment : "Update employment integration"
Employment-->>Route : "Integration complete"
Route-->>Admin : "Success response with enhanced data<br/>+ Country-specific options"
Admin->>Cache : "Invalidate/update cache"
```

**Diagram sources**
- [master-data end-reasons API route](file://apps/hr-suite/app/api/master-data/end-reasons/route.ts)
- [20260729064035_country_scoped_employment_end_reasons.sql](file://apps/hr-suite/supabase/migrations/20260729064035_country_scoped_employment_end_reasons.sql)
- [20260718100500_add_master_data_mutation_rpcs.sql](file://apps/hr-suite/supabase/migrations/20260718100500_add_master_data_mutation_rpcs.sql)

## Detailed Component Analysis

### Enhanced Job Catalog Administration
Job catalog administration now includes enhanced features:
- **Job definitions**: core attributes describing roles and responsibilities with improved UI
- **Job groups**: logical grouping of jobs for reporting and access control with hierarchical organization
- **Position hierarchies**: parent-child relationships to model organizational structure
- **Employment integration**: seamless integration with employment records for real-time updates

**Updated** Enhanced UI components provide better user experience and improved employment record integration.

Implementation highlights:
- Enhanced UI flows driven by improved Job Catalog Manager component
- API routes handle creation, updates, and deletions with enhanced validation and error handling
- Database schema enforces referential integrity and tenant isolation
- Improved integration with employment management workflows

Practical example: Creating a job profile with job groups
- Navigate to the enhanced Jobs page
- Use the improved manager to define job attributes and assign to job groups
- Configure hierarchical relationships if needed
- Save and verify visibility within the tenant scope with employment integration

```mermaid
flowchart TD
Start(["Open Enhanced Jobs Page"]) --> Create["Create New Job Definition"]
Create --> DefineAttrs["Define Attributes and Metadata"]
DefineAttrs --> AssignGroup["Assign to Job Group<br/>Enhanced"]
AssignGroup --> ConfigureHierarchy["Configure Hierarchy<br/>(Optional)"]
ConfigureHierarchy --> Validate["Enhanced Validation"]
Validate --> Persist["Persist via Enhanced API Route"]
Persist --> Integrate["Integrate with Employment Records"]
Integrate --> Confirm["Confirm Success"]
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

### Enhanced End Reason Configuration
End reasons capture termination and transition reasons for employments. They are referenced during termination workflows to standardize outcomes and reporting.

**Updated** The end reason system has been significantly enhanced with country-specific support, providing 144 additional lines of functionality for international compliance and localization.

Implementation highlights:
- Enhanced End Reason Manager provides comprehensive CRUD operations with country context
- API routes validate inputs, enforce tenant scoping, and support country-specific reasons
- Referential integrity ensures only valid reasons are used in employment records
- Country-scoped database schema supports international termination requirements
- Improved integration with employment termination workflows

Practical example: Configuring country-specific termination reasons
- Go to the End Reasons page with country selector
- Add a new reason with descriptive metadata and country scope
- Configure localized descriptions and legal compliance information
- Save and use it in termination forms with appropriate country context

```mermaid
flowchart TD
Start(["Open Enhanced End Reasons Page"]) --> SelectCountry["Select Country Context"]
SelectCountry --> Add["Add New End Reason"]
Add --> SetDetails["Set Details and Country Scope"]
SetDetails --> Localize["Configure Localized Descriptions"]
Localize --> Validate["Validate Inputs + Country Rules"]
Validate --> Save["Save via Enhanced API Route"]
Save --> Verify["Verify Availability in Employment Forms<br/>+ Country Filtering"]
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

## Country-Scoped End Reasons

### Overview
The enhanced end reason system now supports country-specific termination reasons, enabling organizations to comply with local labor laws and regulations while maintaining global consistency. This represents a significant expansion with 144 additional lines of functionality focused on internationalization and compliance.

### Key Features
- **Country Context**: End reasons can be scoped to specific countries for legal compliance
- **Localized Descriptions**: Support for multiple language descriptions per country
- **Regulatory Compliance**: Country-specific validation rules and required fields
- **Tenant Isolation**: Maintains strict tenant boundaries while supporting multi-country operations
- **Enhanced UI**: Improved interface for managing country-specific termination reasons

### Implementation Architecture
The country-scoped end reason system extends the existing end reason schema with country context and localization support:

```mermaid
erDiagram
END_REASONS {
uuid id PK
text name
text description
uuid tenant_id FK
boolean is_active
timestamp created_at
timestamp updated_at
}
COUNTRY_SCOPED_END_REASONS {
uuid id PK
uuid end_reason_id FK
text country_code
text localized_description
jsonb regulatory_requirements
boolean is_default_for_country
timestamp created_at
}
EMPLOYMENTS {
uuid id PK
uuid tenant_id FK
uuid end_reason_id FK
text termination_country
timestamp terminated_at
}
END_REASONS ||--o{ COUNTRY_SCOPED_END_REASONS : "has many"
END_REASONS ||--o{ EMPLOYMENTS : "referenced by"
COUNTRY_SCOPED_END_REASONS ||--o{ EMPLOYMENTS : "filters by country"
```

**Diagram sources**
- [20260729064035_country_scoped_employment_end_reasons.sql](file://apps/hr-suite/supabase/migrations/20260729064035_country_scoped_employment_end_reasons.sql)
- [20260729070552_normalize_nl_employment_end_reasons.sql](file://apps/hr-suite/supabase/migrations/20260729070552_normalize_nl_employment_end_reasons.sql)

### Usage Examples
Administrators can now manage termination reasons with country-specific configurations:

1. **Creating Country-Specific Reasons**: Use the enhanced End Reason Manager to create reasons with country context
2. **Localization Management**: Configure localized descriptions and regulatory requirements per country
3. **Compliance Validation**: Ensure termination reasons meet country-specific legal requirements
4. **Employment Integration**: Termination workflows automatically filter available reasons by employment country

**Section sources**
- [end-reasons page](file://apps/hr-suite/app/(dashboard)/master-data/end-reasons/page.tsx)
- [end-reason-manager component](file://apps/hr-suite/components/master-data/end-reason-manager.tsx)
- [master-data end-reasons API route](file://apps/hr-suite/app/api/master-data/end-reasons/route.ts)
- [20260729064035_country_scoped_employment_end_reasons.sql](file://apps/hr-suite/supabase/migrations/20260729064035_country_scoped_employment_end_reasons.sql)
- [20260729070552_normalize_nl_employment_end_reasons.sql](file://apps/hr-suite/supabase/migrations/20260729070552_normalize_nl_employment_end_reasons.sql)

## Dependency Analysis
Master data modules depend on shared infrastructure with enhanced integration and country-specific support:
- API routes rely on Supabase for persistence, RLS policies for security, and indexes for performance
- UI components depend on enhanced API routes for data operations and caching strategies
- Migrations define schema, constraints, and RPCs enabling complex transactions
- Enhanced employment record integration requires additional dependency management
- **New** Country-scoped dependencies require additional validation and localization services

```mermaid
graph LR
UI["UI Components<br/>Enhanced + Country Support"] --> API["API Routes<br/>Enhanced + Country Context"]
API --> DB["Supabase Schema & Policies<br/>Country-Scoped"]
API --> RPC["RPC Functions"]
API --> Employment["Employment Integration"]
API --> Localization["Country Localization Services"]
DB --> IDX["Indexes"]
DB --> POL["RLS Policies"]
Employment --> DB
Localization --> DB
```

**Diagram sources**
- [master-data jobs API route](file://apps/hr-suite/app/api/master-data/jobs/route.ts)
- [master-data salary-scales API route](file://apps/hr-suite/app/api/master-data/salary-scales/route.ts)
- [master-data end-reasons API route](file://apps/hr-suite/app/api/master-data/end-reasons/route.ts)
- [master-data document-categories API route](file://apps/hr-suite/app/api/master-data/document-categories/route.ts)
- [20260718100500_add_master_data_mutation_rpcs.sql](file://apps/hr-suite/supabase/migrations/20260718100500_add_master_data_mutation_rpcs.sql)
- [20260718100600_index_master_data_foreign_keys.sql](file://apps/hr-suite/supabase/migrations/20260718100600_index_master_data_foreign_keys.sql)
- [20260718131000_harden_hr_master_data_document_policies.sql](file://apps/hr-suite/supabase/migrations/20260718131000_harden_hr_master_data_document_policies.sql)
- [20260729064035_country_scoped_employment_end_reasons.sql](file://apps/hr-suite/supabase/migrations/20260729064035_country_scoped_employment_end_reasons.sql)

**Section sources**
- [master-data jobs API route](file://apps/hr-suite/app/api/master-data/jobs/route.ts)
- [master-data salary-scales API route](file://apps/hr-suite/app/api/master-data/salary-scales/route.ts)
- [master-data end-reasons API route](file://apps/hr-suite/app/api/master-data/end-reasons/route.ts)
- [master-data document-categories API route](file://apps/hr-suite/app/api/master-data/document-categories/route.ts)
- [20260718100500_add_master_data_mutation_rpcs.sql](file://apps/hr-suite/supabase/migrations/20260718100500_add_master_data_mutation_rpcs.sql)
- [20260718100600_index_master_data_foreign_keys.sql](file://apps/hr-suite/supabase/migrations/20260718100600_index_master_data_foreign_keys.sql)
- [20260718131000_harden_hr_master_data_document_policies.sql](file://apps/hr-suite/supabase/migrations/20260718131000_harden_hr_master_data_document_policies.sql)
- [20260729064035_country_scoped_employment_end_reasons.sql](file://apps/hr-suite/supabase/migrations/20260729064035_country_scoped_employment_end_reasons.sql)

## Performance Considerations
To optimize MDM operations for large datasets with enhanced features and country-specific support:
- Leverage indexes on foreign keys and frequently queried columns to reduce lookup times
- Use pagination and filtering in API responses to limit payload sizes
- Implement client-side caching and invalidation strategies to minimize redundant requests
- Batch mutations where possible to reduce network overhead
- Ensure RLS policies are efficient and scoped to tenant identifiers to avoid full-table scans
- Optimize enhanced job group queries with proper indexing strategies
- Monitor employment integration performance for real-time updates
- **New** Optimize country-scoped queries with proper indexing on country codes and tenant combinations
- **New** Implement efficient localization lookups to minimize performance impact

## Troubleshooting Guide
Common issues and resolutions with enhanced features and country-specific support:
- **Validation errors**: Check input payloads against expected schemas; ensure required fields are present and enhanced validation rules are satisfied
- **Authorization failures**: Verify user permissions and tenant scoping; confirm RLS policies allow access to enhanced features
- **Referential integrity violations**: Ensure referenced IDs exist and belong to the same tenant; check job group relationships
- **Performance bottlenecks**: Inspect query plans, add missing indexes, and reduce result sets with filters; monitor employment integration queries
- **Integration issues**: Verify employment record synchronization and job group assignments
- **Enhanced UI problems**: Check component dependencies and API route connectivity
- **Country-specific issues**: Verify country code formatting, localization data availability, and regulatory compliance settings
- **Multi-country conflicts**: Ensure proper tenant isolation and country context propagation throughout the system

**Section sources**
- [master-data jobs API route](file://apps/hr-suite/app/api/master-data/jobs/route.ts)
- [master-data salary-scales API route](file://apps/hr-suite/app/api/master-data/salary-scales/route.ts)
- [master-data end-reasons API route](file://apps/hr-suite/app/api/master-data/end-reasons/route.ts)
- [master-data document-categories API route](file://apps/hr-suite/app/api/master-data/document-categories/route.ts)
- [20260718131000_harden_hr_master_data_document_policies.sql](file://apps/hr-suite/supabase/migrations/20260718131000_harden_hr_master_data_document_policies.sql)
- [20260729064035_country_scoped_employment_end_reasons.sql](file://apps/hr-suite/supabase/migrations/20260729064035_country_scoped_employment_end_reasons.sql)

## Conclusion
LiquidHR's Master Data Management system provides robust tools for administering job catalogs, salary scales, end reasons, and document categories with enhanced UI components and improved employment record integration. The addition of comprehensive job group support, enhanced master data APIs, and significantly expanded end reason management with country-specific support (144 additional lines of functionality) substantially improves the user experience and system capabilities. With strong validation, referential integrity, version control, multi-tenant isolation, and international compliance support, it ensures reliable and scalable master data operations across multiple countries and regions. Enhanced API routes and RPC functions enable efficient mutations, while indexes and policies optimize performance and security.

## Appendices

### Practical Examples Summary
- **Creating a job profile with job groups**: Use the enhanced Jobs page and Job Catalog Manager to define attributes, assign groups, and configure hierarchies
- **Defining a salary structure**: Use the Salary Scales page and Salary Scale Manager to set grades, steps, and publish revisions
- **Configuring country-specific termination reasons**: Use the enhanced End Reasons page and End Reason Manager to add reasons with country context and localization
- **Organizing document categories**: Use Catalog Managers to create and apply categories consistently
- **Managing job hierarchies**: Utilize enhanced job group features for organizational structure modeling
- **International compliance setup**: Configure country-specific end reasons to meet local labor law requirements

### Version Control and Auditability
- Salary scale revisions are tracked to maintain historical accuracy
- Changes to master data should follow approval workflows before publication
- Audit trails can be extended via event projections or change logs
- Enhanced job group changes are tracked for compliance and reporting
- **New** Country-specific end reason changes are tracked for regulatory compliance

**Section sources**
- [20260718100000_add_job_catalog_salary_revisions.sql](file://apps/hr-suite/supabase/migrations/20260718100000_add_job_catalog_salary_revisions.sql)
- [job_catalog_salary_revisions test](file://apps/hr-suite/supabase/tests/job_catalog_salary_revisions.sql)

### Multi-Tenant Isolation
- All master data is scoped to tenants via policies and foreign keys
- API routes enforce tenant context from authentication
- Queries and mutations must include tenant identifiers to prevent cross-tenant data leakage
- Enhanced job group features maintain tenant isolation boundaries
- **New** Country-scoped end reasons maintain strict tenant isolation while supporting multi-country operations

**Section sources**
- [20260718131000_harden_hr_master_data_document_policies.sql](file://apps/hr-suite/supabase/migrations/20260718131000_harden_hr_master_data_document_policies.sql)
- [20260718100600_index_master_data_foreign_keys.sql](file://apps/hr-suite/supabase/migrations/20260718100600_index_master_data_foreign_keys.sql)
- [20260729064035_country_scoped_employment_end_reasons.sql](file://apps/hr-suite/supabase/migrations/20260729064035_country_scoped_employment_end_reasons.sql)

### Enhanced Features Summary
- **Improved UI Components**: Enhanced job catalog management with better user experience
- **Job Group Support**: Comprehensive job grouping with hierarchical organization capabilities
- **Enhanced APIs**: Improved validation, error handling, and employment record integration
- **Better Integration**: Seamless connection between job catalogs and employment management workflows
- **Enhanced Error Handling**: More robust error messages and recovery mechanisms
- **Country-Scoped End Reasons**: Significant expansion with 144 additional lines of functionality for international compliance and localization support
- **Internationalization**: Multi-language support for termination reasons and regulatory compliance

### Country-Specific Enhancements
- **Legal Compliance**: Country-specific termination reasons aligned with local labor laws
- **Localization Support**: Multi-language descriptions and regulatory requirements
- **Enhanced Validation**: Country-specific validation rules and compliance checks
- **Improved UI**: Country selector and localized content management
- **Database Extensions**: Country-scoped schema extensions with proper indexing and policies

**Section sources**
- [20260729064035_country_scoped_employment_end_reasons.sql](file://apps/hr-suite/supabase/migrations/20260729064035_country_scoped_employment_end_reasons.sql)
- [20260729070552_normalize_nl_employment_end_reasons.sql](file://apps/hr-suite/supabase/migrations/20260729070552_normalize_nl_employment_end_reasons.sql)
- [end-reason-manager component](file://apps/hr-suite/components/master-data/end-reason-manager.tsx)
- [master-data end-reasons API route](file://apps/hr-suite/app/api/master-data/end-reasons/route.ts)