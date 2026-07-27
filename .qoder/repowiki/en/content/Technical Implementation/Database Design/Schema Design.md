# Schema Design

<cite>
**Referenced Files in This Document**
- [20260712124858_init_employee_core_hr.sql](file://apps/hr-suite/supabase/migrations/20260712124858_init_employee_core_hr.sql)
- [20260712124911_add_tenant_rbac_and_organization.sql](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql)
- [20260715071156_add_employment_core.sql](file://apps/hr-suite/supabase/migrations/20260715071156_add_employment_core.sql)
- [20260715071422_add_employment_timelines.sql](file://apps/hr-suite/supabase/migrations/20260715071422_add_employment_timelines.sql)
- [20260715071717_add_employment_terminations.sql](file://apps/hr-suite/supabase/migrations/20260715071717_add_employment_terminations.sql)
- [20260715120810_complete_employee_core.sql](file://apps/hr-suite/supabase/migrations/20260715120810_complete_employee_core.sql)
- [20260715123119_add_custom_field_value_rpc.sql](file://apps/hr-suite/supabase/migrations/20260715123119_add_custom_field_value_rpc.sql)
- [20260715141843_add_employment_change_management.sql](file://apps/hr-suite/supabase/migrations/20260715141843_add_employment_change_management.sql)
- [20260718100000_add_job_catalog_salary_revisions.sql](file://apps/hr-suite/supabase/migrations/20260718100000_add_job_catalog_salary_revisions.sql)
- [20260718110000_add_employee_document_dossiers.sql](file://apps/hr-suite/supabase/migrations/20260718110000_add_employee_document_dossiers.sql)
- [20260722142551_add_leave_engine_foundation.sql](file://apps/hr-suite/supabase/migrations/20260722142551_add_leave_engine_foundation.sql)
- [20260722190000_add_leave_request_booking_engine.sql](file://apps/hr-suite/supabase/migrations/20260722190000_add_leave_request_booking_engine.sql)
- [20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql)
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

This document provides comprehensive schema design documentation for LiquidHR's PostgreSQL database. The database follows modern HRIS principles with strong emphasis on data integrity, multi-tenancy support, and flexible organizational structures. The schema supports core HR functions including employee management, employment lifecycle, organizational hierarchy, role-based access control, and leave management.

The database design emphasizes:
- **Multi-tenancy**: Complete isolation between organizations through tenant scoping
- **Flexible Organization Structure**: Support for departments, roles, and hierarchical relationships
- **Employment Lifecycle Management**: Comprehensive tracking of employment history, changes, and terminations
- **Audit Trail**: Detailed activity logging for compliance and analytics
- **Extensibility**: Custom field support for domain-specific requirements

## Project Structure

The LiquidHR database schema is organized into logical modules corresponding to different HR domains:

```mermaid
graph TB
subgraph "Core HR"
A["employees"] --> B["employments"]
B --> C["employment_timelines"]
B --> D["employment_terminations"]
end
subgraph "Organization"
E["organizations"] --> F["departments"]
G["roles"] --> H["role_assignments"]
F --> H
end
subgraph "Master Data"
I["jobs"] --> J["salary_scales"]
K["end_reasons"] --> L["relation_types"]
end
subgraph "Leave Management"
M["leave_types"] --> N["leave_requests"]
N --> O["leave_ledger"]
end
subgraph "Supporting"
P["custom_fields"] --> Q["custom_field_values"]
R["documents"] --> S["activity_entries"]
end
A --> F
A --> G
B --> I
B --> J
```

**Diagram sources**
- [20260712124858_init_employee_core_hr.sql:1-100](file://apps/hr-suite/supabase/migrations/20260712124858_init_employee_core_hr.sql#L1-L100)
- [20260712124911_add_tenant_rbac_and_organization.sql:1-150](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql#L1-L150)
- [20260715071156_add_employment_core.sql:1-200](file://apps/hr-suite/supabase/migrations/20260715071156_add_employment_core.sql#L1-L200)

**Section sources**
- [20260712124858_init_employee_core_hr.sql:1-50](file://apps/hr-suite/supabase/migrations/20260712124858_init_employee_core_hr.sql#L1-L50)
- [20260712124911_add_tenant_rbac_and_organization.sql:1-50](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql#L1-L50)

## Core Components

### Employee Management System

The employee core system forms the foundation of LiquidHR's HR capabilities. Employees are scoped to organizations and support comprehensive personal information management.

#### Key Tables:

**employees table**
- Primary identifier: `id` (UUID)
- Organization scoping: `organization_id` (FK to organizations)
- Personal information: name, email, phone, address fields
- Employment status tracking: `is_active`, `archived_at`
- Audit fields: `created_at`, `updated_at`, `created_by`, `updated_by`

**employment_core table**
- Links employees to organizational units
- Tracks employment periods with start/end dates
- Supports multiple concurrent employments per employee
- Includes job title, department, and reporting relationships

**Section sources**
- [20260712124858_init_employee_core_hr.sql:1-100](file://apps/hr-suite/supabase/migrations/20260712124858_init_employee_core_hr.sql#L1-L100)
- [20260715120810_complete_employee_core.sql:1-150](file://apps/hr-suite/supabase/migrations/20260715120810_complete_employee_core.sql#L1-L150)

### Employment Lifecycle Management

The employment system manages the complete lifecycle of an employee's relationship with the organization, from onboarding to termination.

#### Core Employment Tables:

**employments table**
- Represents active employment contracts
- Links to jobs, departments, and salary scales
- Tracks employment type, work hours, and compensation
- Supports part-time, full-time, and contract arrangements

**employment_timelines table**
- Historical record of employment changes
- Captures promotions, transfers, and role modifications
- Maintains audit trail for compliance requirements

**employment_terminations table**
- Records employment endings with reasons and dates
- Supports voluntary and involuntary terminations
- Tracks final settlements and exit procedures

**Section sources**
- [20260715071156_add_employment_core.sql:1-200](file://apps/hr-suite/supabase/migrations/20260715071156_add_employment_core.sql#L1-L200)
- [20260715071422_add_employment_timelines.sql:1-100](file://apps/hr-suite/supabase/migrations/20260715071422_add_employment_timelines.sql#L1-L100)
- [20260715071717_add_employment_terminations.sql:1-100](file://apps/hr-suite/supabase/migrations/20260715071717_add_employment_terminations.sql#L1-L100)

### Organizational Structure

LiquidHR supports flexible organizational hierarchies with departments, roles, and management assignments.

#### Organization Tables:

**organizations table**
- Top-level tenant container
- Contains company information and settings
- Supports multi-company structures within a single tenant

**departments table**
- Hierarchical department structure
- Supports parent-child relationships
- Includes department codes, descriptions, and managers

**roles table**
- Role-based access control definitions
- Permission sets for different job functions
- Supports inheritance and custom permissions

**Section sources**
- [20260712124911_add_tenant_rbac_and_organization.sql:1-200](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql#L1-L200)

## Architecture Overview

The LiquidHR database architecture follows a modular design pattern with clear separation of concerns:

```mermaid
erDiagram
TENANTS {
uuid id PK
text name
text legal_name
text vat_number
timestamp created_at
timestamp updated_at
}
ORGANIZATIONS {
uuid id PK
uuid tenant_id FK
text name
text code
text description
jsonb settings
timestamp created_at
timestamp updated_at
}
EMPLOYEES {
uuid id PK
uuid organization_id FK
text first_name
text last_name
text email
text phone
date birth_date
text bsn
boolean is_active
timestamp archived_at
timestamp created_at
timestamp updated_at
}
DEPARTMENTS {
uuid id PK
uuid organization_id FK
uuid parent_department_id FK
text name
text code
text description
timestamp created_at
timestamp updated_at
}
ROLES {
uuid id PK
uuid organization_id FK
text name
text description
jsonb permissions
timestamp created_at
timestamp updated_at
}
JOBS {
uuid id PK
uuid organization_id FK
text title
text description
text category
timestamp created_at
timestamp updated_at
}
SALARY_SCALES {
uuid id PK
uuid organization_id FK
text name
text description
timestamp created_at
timestamp updated_at
}
EMPLOYMENTS {
uuid id PK
uuid employee_id FK
uuid job_id FK
uuid department_id FK
uuid salary_scale_id FK
date start_date
date end_date
text employment_type
decimal hourly_rate
decimal monthly_salary
timestamp created_at
timestamp updated_at
}
EMPLOYEE_ROLE_ASSIGNMENTS {
uuid id PK
uuid employee_id FK
uuid role_id FK
uuid department_id FK
date effective_from
date effective_to
timestamp created_at
}
TENANTS ||--o{ ORGANIZATIONS : owns
ORGANIZATIONS ||--o{ EMPLOYEES : employs
ORGANIZATIONS ||--o{ DEPARTMENTS : contains
ORGANIZATIONS ||--o{ ROLES : defines
ORGANIZATIONS ||--o{ JOBS : offers
ORGANIZATIONS ||--o{ SALARY_SCALES : uses
EMPLOYEES ||--o{ EMPLOYMENTS : has
DEPARTMENTS ||--o{ EMPLOYMENTS : hosts
JOBS ||--o{ EMPLOYMENTS : defines
SALARY_SCALES ||--o{ EMPLOYMENTS : determines
EMPLOYEES ||--o{ EMPLOYEE_ROLE_ASSIGNMENTS : assigned
ROLES ||--o{ EMPLOYEE_ROLE_ASSIGNMENTS : grants
```

**Diagram sources**
- [20260712124858_init_employee_core_hr.sql:1-100](file://apps/hr-suite/supabase/migrations/20260712124858_init_employee_core_hr.sql#L1-L100)
- [20260712124911_add_tenant_rbac_and_organization.sql:1-200](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql#L1-L200)
- [20260715071156_add_employment_core.sql:1-200](file://apps/hr-suite/supabase/migrations/20260715071156_add_employment_core.sql#L1-L200)

## Detailed Component Analysis

### Employee Entity Relationship Model

The employee entity serves as the central hub connecting various HR domains:

```mermaid
classDiagram
class Employee {
+uuid id
+uuid organization_id
+string firstName
+string lastName
+string email
+string phone
+date birthDate
+string bsn
+boolean isActive
+timestamp createdAt
+timestamp updatedAt
}
class Employment {
+uuid id
+uuid employeeId
+uuid jobId
+uuid departmentId
+uuid salaryScaleId
+date startDate
+date endDate
+string employmentType
+decimal hourlyRate
+decimal monthlySalary
}
class Department {
+uuid id
+uuid organizationId
+uuid parentDepartmentId
+string name
+string code
+string description
}
class Role {
+uuid id
+uuid organizationId
+string name
+string description
+jsonb permissions
}
class Job {
+uuid id
+uuid organizationId
+string title
+string description
+string category
}
class SalaryScale {
+uuid id
+uuid organizationId
+string name
+string description
}
Employee "1" o-- "*" Employment : "has"
Employee "1" o-- "*" Department : "belongs_to"
Employee "1" o-- "*" Role : "assigned_to"
Employment "1" o-- "1" Job : "uses"
Employment "1" o-- "1" Department : "located_in"
Employment "1" o-- "1" SalaryScale : "compensation_based_on"
Department "1" o-- "*" Department : "contains"
```

**Diagram sources**
- [20260712124858_init_employee_core_hr.sql:1-100](file://apps/hr-suite/supabase/migrations/20260712124858_init_employee_core_hr.sql#L1-L100)
- [20260715071156_add_employment_core.sql:1-200](file://apps/hr-suite/supabase/migrations/20260715071156_add_employment_core.sql#L1-L200)

### Employment Lifecycle State Machine

The employment system implements a comprehensive state machine for managing employment transitions:

```mermaid
stateDiagram-v2
[*] --> Active : "New Hire"
Active --> OnProbation : "Start Probation"
Active --> Terminated : "Termination"
Active --> Suspended : "Suspension"
OnProbation --> Active : "Confirmation"
OnProbation --> Terminated : "Failed Probation"
Suspended --> Active : "Reinstatement"
Suspended --> Terminated : "Termination During Suspension"
Terminated --> Rehired : "Rehire"
Rehired --> Active : "New Employment"
note right of Active : "Current employment period<br/>Active work assignment"
note right of OnProbation : "Trial period<br/>Limited privileges"
note right of Terminated : "End of employment<br/>Exit procedures completed"
note right of Suspended : "Temporary pause<br/>No work activities"
```

**Diagram sources**
- [20260715071156_add_employment_core.sql:1-200](file://apps/hr-suite/supabase/migrations/20260715071156_add_employment_core.sql#L1-L200)
- [20260715071717_add_employment_terminations.sql:1-100](file://apps/hr-suite/supabase/migrations/20260715071717_add_employment_terminations.sql#L1-L100)

### Leave Management Engine

The leave engine provides comprehensive vacation and time-off management:

```mermaid
flowchart TD
Start([Leave Request Created]) --> ValidateEligibility["Validate Employee Eligibility"]
ValidateEligibility --> CheckBalance["Check Leave Balance"]
CheckBalance --> BalanceSufficient{"Sufficient Balance?"}
BalanceSufficient --> |No| RejectRequest["Reject Request"]
BalanceSufficient --> |Yes| CheckApproval["Check Approval Workflow"]
CheckApproval --> ApprovalRequired{"Approval Required?"}
ApprovalRequired --> |No| AutoApprove["Auto-approve"]
ApprovalRequired --> |Yes| SendForApproval["Send for Approval"]
AutoApprove --> CreateBooking["Create Time Booking"]
SendForApproval --> AwaitDecision["Await Decision"]
AwaitDecision --> Approved{"Approved?"}
Approved --> |Yes| CreateBooking
Approved --> |No| RejectRequest
CreateBooking --> UpdateLedger["Update Leave Ledger"]
UpdateLedger --> DeductBalance["Deduct Leave Balance"]
DeductBalance --> Complete([Request Complete])
RejectRequest --> End([End])
Complete --> End
```

**Diagram sources**
- [20260722142551_add_leave_engine_foundation.sql:1-200](file://apps/hr-suite/supabase/migrations/20260722142551_add_leave_engine_foundation.sql#L1-L200)
- [20260722190000_add_leave_request_booking_engine.sql:1-200](file://apps/hr-suite/supabase/migrations/20260722190000_add_leave_request_booking_engine.sql#L1-L200)

## Dependency Analysis

The database schema demonstrates careful dependency management with clear separation between core entities and supporting features:

```mermaid
graph TD
subgraph "Foundation Layer"
A["organizations"] --> B["users"]
A --> C["tenant_settings"]
end
subgraph "Core HR Layer"
D["employees"] --> A
E["employments"] --> D
F["departments"] --> A
G["roles"] --> A
H["jobs"] --> A
I["salary_scales"] --> A
end
subgraph "Operational Layer"
J["employment_timelines"] --> E
K["employment_terminations"] --> E
L["employee_role_assignments"] --> D
L --> G
M["custom_fields"] --> A
N["custom_field_values"] --> M
end
subgraph "Analytics Layer"
O["activity_entries"] --> D
O --> E
P["leave_requests"] --> D
Q["leave_ledger"] --> P
end
E --> F
E --> H
E --> I
D --> F
```

**Diagram sources**
- [20260712124911_add_tenant_rbac_and_organization.sql:1-200](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql#L1-L200)
- [20260715071156_add_employment_core.sql:1-200](file://apps/hr-suite/supabase/migrations/20260715071156_add_employment_core.sql#L1-L200)
- [20260722142551_add_leave_engine_foundation.sql:1-200](file://apps/hr-suite/supabase/migrations/20260722142551_add_leave_engine_foundation.sql#L1-L200)

**Section sources**
- [20260712124911_add_tenant_rbac_and_organization.sql:1-200](file://apps/hr-suite/supabase/migrations/20260712124911_add_tenant_rbac_and_organization.sql#L1-L200)
- [20260715071156_add_employment_core.sql:1-200](file://apps/hr-suite/supabase/migrations/20260715071156_add_employment_core.sql#L1-L200)

## Performance Considerations

### Indexing Strategy

The schema implements strategic indexing for optimal query performance:

- **Primary Key Indexes**: All tables use UUID primary keys with automatic B-tree indexes
- **Foreign Key Indexes**: Strategic indexing on frequently queried foreign key columns
- **Composite Indexes**: Multi-column indexes for common query patterns
- **Partial Indexes**: Conditional indexes for filtered queries on large datasets

### Data Normalization Principles

The database follows normalization principles while balancing practical performance needs:

- **Third Normal Form (3NF)**: Most tables achieve 3NF to eliminate redundancy
- **Controlled Denormalization**: Strategic denormalization for read-heavy operations
- **JSONB Fields**: Flexible metadata storage using PostgreSQL JSONB types
- **Partitioning Ready**: Schema designed for potential future partitioning

### Storage Optimization

- **Appropriate Data Types**: Careful selection of data types to minimize storage
- **Constraint Enforcement**: Database-level constraints prevent invalid data
- **Efficient Relationships**: Foreign key relationships maintain referential integrity
- **Audit Trail Efficiency**: Append-only audit tables for historical data

## Troubleshooting Guide

### Common Schema Issues

**Employee Access Problems**
- Verify organization scoping through `organization_id` foreign keys
- Check employee status flags (`is_active`, `archived_at`)
- Ensure proper role assignments for required permissions

**Employment Timeline Issues**
- Validate date ranges don't overlap for same employee
- Check employment status consistency across related tables
- Verify termination records match employment end dates

**Permission Denied Errors**
- Review role-based access control configurations
- Check department-level authorization settings
- Verify user-to-employee mapping in multi-tenant scenarios

### Query Optimization Tips

**Employee Lookup Queries**
```sql
-- Optimized employee search with organization scoping
SELECT e.*, d.name as department_name
FROM employees e
JOIN departments d ON e.department_id = d.id
WHERE e.organization_id = current_setting('app.current_organization')::uuid
AND e.is_active = true
ORDER BY e.last_name, e.first_name;
```

**Employment History Analysis**
```sql
-- Current employment with department and job details
SELECT 
    e.employee_id,
    e.start_date,
    e.end_date,
    j.title as job_title,
    d.name as department_name,
    ss.name as salary_scale
FROM employments e
JOIN jobs j ON e.job_id = j.id
JOIN departments d ON e.department_id = d.id
LEFT JOIN salary_scales ss ON e.salary_scale_id = ss.id
WHERE e.employee_id = ? AND e.end_date IS NULL;
```

**Section sources**
- [20260715123119_add_custom_field_value_rpc.sql:1-100](file://apps/hr-suite/supabase/migrations/20260715123119_add_custom_field_value_rpc.sql#L1-L100)
- [20260724160000_add_employee_activity_entries.sql:1-100](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql#L1-L100)

## Conclusion

The LiquidHR database schema represents a mature, enterprise-grade HR information system design. The architecture successfully balances flexibility with data integrity, supporting complex organizational structures while maintaining performance at scale. Key strengths include:

- **Comprehensive Multi-tenancy**: Complete isolation between organizations with shared infrastructure
- **Flexible Organization Modeling**: Support for complex departmental hierarchies and role-based access
- **Complete Employment Lifecycle**: Full coverage from hiring to termination with detailed audit trails
- **Extensible Architecture**: Custom field support and modular design for future enhancements
- **Performance-Optimized**: Strategic indexing and normalization for optimal query performance

The schema provides a solid foundation for building sophisticated HR applications while maintaining data consistency and security across multi-tenant environments. Future enhancements can build upon this robust foundation without compromising existing functionality or data integrity.