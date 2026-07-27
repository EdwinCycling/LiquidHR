# Business Logic Layer

<cite>
**Referenced Files in This Document**
- [apps/hr-suite/app/api/employees/route.ts](file://apps/hr-suite/app/api/employees/route.ts)
- [apps/hr-suite/app/api/employments/[employmentId]/route.ts](file://apps/hr-suite/app/api/employments/[employmentId]/route.ts)
- [apps/hr-suite/app/api/leave/request/route.ts](file://apps/hr-suite/app/api/leave/request/route.ts)
- [apps/hr-suite/app/api/leave/balance-report/route.ts](file://apps/hr-suite/app/api/leave/balance-report/route.ts)
- [apps/hr-suite/app/api/organization-chart/route.ts](file://apps/hr-suite/app/api/organization-chart/route.ts)
- [apps/hr-suite/app/api/hr-events/route.ts](file://apps/hr-suite/app/api/hr-events/route.ts)
- [apps/hr-suite/lib/employees/index.ts](file://apps/hr-suite/lib/employees/index.ts)
- [apps/hr-suite/lib/employment/index.ts](file://apps/hr-suite/lib/employment/index.ts)
- [apps/hr-suite/lib/leave/index.ts](file://apps/hr-suite/lib/leave/index.ts)
- [apps/hr-suite/lib/organization/index.ts](file://apps/hr-suite/lib/organization/index.ts)
- [apps/hr-suite/lib/supabase/client.ts](file://apps/hr-suite/lib/supabase/client.ts)
- [apps/hr-suite/lib/security/auth-context.ts](file://apps/hr-suite/lib/security/auth-context.ts)
- [apps/hr-suite/lib/settings/holidays/index.ts](file://apps/hr-suite/lib/settings/holidays/index.ts)
- [apps/hr-suite/lib/work-patterns/index.ts](file://apps/hr-suite/lib/work-patterns/index.ts)
- [apps/hr-suite/messages/en/errors.json](file://apps/hr-suite/messages/en/errors.json)
- [apps/hr-suite/messages/en/validation.json](file://apps/hr-suite/messages/en/validation.json)
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
This document explains the business logic layer architecture of LiquidHR with a focus on the service-oriented design implemented under the lib directory. It details how domain-specific modules encapsulate business rules, how data access is separated from business logic, and how complex workflows such as employment lifecycle management, employee data processing, organizational hierarchy calculations, and leave engine operations are orchestrated. It also covers transaction management, validation pipelines, error propagation patterns, performance optimization techniques, caching strategies, and asynchronous operation handling.

## Project Structure
The business logic layer is organized by domain within the lib directory:
- employees: Employee master data services and validations
- employment: Employment lifecycle, changes, terminations, and timelines
- leave: Leave engine configuration, request booking, ledger operations, and balance reporting
- organization: Organizational units, assignments, placements, and chart computation
- settings: Holidays, work patterns, and module toggles that influence business rules
- security: Authentication context and authorization helpers used across services
- supabase: Data access client and typed queries for database interactions

API routes in apps/hr-suite/app/api act as thin controllers that validate inputs, enforce authorization, orchestrate services, and return responses. Services in lib implement domain logic and delegate persistence to Supabase via typed clients.

```mermaid
graph TB
subgraph "API Routes"
A["employees/route.ts"]
B["employments/[employmentId]/route.ts"]
C["leave/request/route.ts"]
D["leave/balance-report/route.ts"]
E["organization-chart/route.ts"]
F["hr-events/route.ts"]
end
subgraph "Business Services (lib)"
S1["employees/index.ts"]
S2["employment/index.ts"]
S3["leave/index.ts"]
S4["organization/index.ts"]
S5["settings/holidays/index.ts"]
S6["work-patterns/index.ts"]
S7["security/auth-context.ts"]
end
subgraph "Data Access"
D1["supabase/client.ts"]
end
A --> S1
B --> S2
C --> S3
D --> S3
E --> S4
F --> S3
S1 --> D1
S2 --> D1
S3 --> D1
S4 --> D1
S5 --> D1
S6 --> D1
S7 --> D1
```

**Diagram sources**
- [apps/hr-suite/app/api/employees/route.ts](file://apps/hr-suite/app/api/employees/route.ts)
- [apps/hr-suite/app/api/employments/[employmentId]/route.ts](file://apps/hr-suite/app/api/employments/[employmentId]/route.ts)
- [apps/hr-suite/app/api/leave/request/route.ts](file://apps/hr-suite/app/api/leave/request/route.ts)
- [apps/hr-suite/app/api/leave/balance-report/route.ts](file://apps/hr-suite/app/api/leave/balance-report/route.ts)
- [apps/hr-suite/app/api/organization-chart/route.ts](file://apps/hr-suite/app/api/organization-chart/route.ts)
- [apps/hr-suite/app/api/hr-events/route.ts](file://apps/hr-suite/app/api/hr-events/route.ts)
- [apps/hr-suite/lib/employees/index.ts](file://apps/hr-suite/lib/employees/index.ts)
- [apps/hr-suite/lib/employment/index.ts](file://apps/hr-suite/lib/employment/index.ts)
- [apps/hr-suite/lib/leave/index.ts](file://apps/hr-suite/lib/leave/index.ts)
- [apps/hr-suite/lib/organization/index.ts](file://apps/hr-suite/lib/organization/index.ts)
- [apps/hr-suite/lib/settings/holidays/index.ts](file://apps/hr-suite/lib/settings/holidays/index.ts)
- [apps/hr-suite/lib/work-patterns/index.ts](file://apps/hr-suite/lib/work-patterns/index.ts)
- [apps/hr-suite/lib/security/auth-context.ts](file://apps/hr-suite/lib/security/auth-context.ts)
- [apps/hr-suite/lib/supabase/client.ts](file://apps/hr-suite/lib/supabase/client.ts)

**Section sources**
- [apps/hr-suite/app/api/employees/route.ts](file://apps/hr-suite/app/api/employees/route.ts)
- [apps/hr-suite/app/api/employments/[employmentId]/route.ts](file://apps/hr-suite/app/api/employments/[employmentId]/route.ts)
- [apps/hr-suite/app/api/leave/request/route.ts](file://apps/hr-suite/app/api/leave/request/route.ts)
- [apps/hr-suite/app/api/leave/balance-report/route.ts](file://apps/hr-suite/app/api/leave/balance-report/route.ts)
- [apps/hr-suite/app/api/organization-chart/route.ts](file://apps/hr-suite/app/api/organization-chart/route.ts)
- [apps/hr-suite/app/api/hr-events/route.ts](file://apps/hr-suite/app/api/hr-events/route.ts)
- [apps/hr-suite/lib/employees/index.ts](file://apps/hr-suite/lib/employees/index.ts)
- [apps/hr-suite/lib/employment/index.ts](file://apps/hr-suite/lib/employment/index.ts)
- [apps/hr-suite/lib/leave/index.ts](file://apps/hr-suite/lib/leave/index.ts)
- [apps/hr-suite/lib/organization/index.ts](file://apps/hr-suite/lib/organization/index.ts)
- [apps/hr-suite/lib/settings/holidays/index.ts](file://apps/hr-suite/lib/settings/holidays/index.ts)
- [apps/hr-suite/lib/work-patterns/index.ts](file://apps/hr-suite/lib/work-patterns/index.ts)
- [apps/hr-suite/lib/security/auth-context.ts](file://apps/hr-suite/lib/security/auth-context.ts)
- [apps/hr-suite/lib/supabase/client.ts](file://apps/hr-suite/lib/supabase/client.ts)

## Core Components
- Service modules in lib encapsulate domain logic:
  - employees: CRUD and validation for employee master data
  - employment: Lifecycle transitions, change sets, timeline events, termination flows
  - leave: Accrual rules, request validation, booking, ledger updates, balance reports
  - organization: Department and placement management, org chart computation
  - settings: Holidays and work patterns that affect scheduling and accrual
  - security: Auth context and permission checks used by services
  - supabase: Typed client for DB operations

- API routes serve as entry points:
  - Validate payloads using shared validators
  - Enforce authorization via auth context
  - Orchestrate one or more services
  - Manage transactions where needed
  - Emit HR events for downstream consumers

**Section sources**
- [apps/hr-suite/lib/employees/index.ts](file://apps/hr-suite/lib/employees/index.ts)
- [apps/hr-suite/lib/employment/index.ts](file://apps/hr-suite/lib/employment/index.ts)
- [apps/hr-suite/lib/leave/index.ts](file://apps/hr-suite/lib/leave/index.ts)
- [apps/hr-suite/lib/organization/index.ts](file://apps/hr-suite/lib/organization/index.ts)
- [apps/hr-suite/lib/settings/holidays/index.ts](file://apps/hr-suite/lib/settings/holidays/index.ts)
- [apps/hr-suite/lib/work-patterns/index.ts](file://apps/hr-suite/lib/work-patterns/index.ts)
- [apps/hr-suite/lib/security/auth-context.ts](file://apps/hr-suite/lib/security/auth-context.ts)
- [apps/hr-suite/lib/supabase/client.ts](file://apps/hr-suite/lib/supabase/client.ts)

## Architecture Overview
LiquidHR follows a service-oriented architecture:
- API routes are thin controllers responsible for input validation, authorization, orchestration, and response formatting.
- Services implement business rules and coordinate multiple data operations.
- Data access is abstracted through a typed Supabase client, ensuring type safety and consistent query patterns.
- Cross-cutting concerns like authentication, authorization, holidays, and work patterns are centralized in dedicated modules.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Route as "API Route"
participant Auth as "Auth Context"
participant Service as "Domain Service"
participant DB as "Supabase Client"
Client->>Route : HTTP Request
Route->>Route : Validate Input
Route->>Auth : Check Permissions
Auth-->>Route : Authorized
Route->>Service : Execute Business Operation
Service->>DB : Read/Write Data
DB-->>Service : Results
Service-->>Route : Domain Result
Route-->>Client : HTTP Response
```

**Diagram sources**
- [apps/hr-suite/app/api/employees/route.ts](file://apps/hr-suite/app/api/employees/route.ts)
- [apps/hr-suite/lib/security/auth-context.ts](file://apps/hr-suite/lib/security/auth-context.ts)
- [apps/hr-suite/lib/employees/index.ts](file://apps/hr-suite/lib/employees/index.ts)
- [apps/hr-suite/lib/supabase/client.ts](file://apps/hr-suite/lib/supabase/client.ts)

## Detailed Component Analysis

### Employment Lifecycle Management
Employment services manage creation, changes, terminations, and timeline events. The flow typically includes:
- Validating employment change requests against current state and policy rules
- Creating change sets and scheduling follow-ups
- Transitioning employment states and recording timeline entries
- Emitting HR events for audit and notifications

```mermaid
flowchart TD
Start(["Start Employment Change"]) --> Validate["Validate Change Request"]
Validate --> PolicyCheck{"Policy Allows?"}
PolicyCheck --> |No| Reject["Reject With Validation Error"]
PolicyCheck --> |Yes| CreateChangeSet["Create Change Set"]
CreateChangeSet --> ScheduleFollowUp["Schedule Follow-Up"]
ScheduleFollowUp --> ApplyChanges["Apply Changes To Employment"]
ApplyChanges --> RecordTimeline["Record Timeline Entry"]
RecordTimeline --> EmitEvent["Emit HR Event"]
EmitEvent --> End(["End"])
Reject --> End
```

**Diagram sources**
- [apps/hr-suite/lib/employment/index.ts](file://apps/hr-suite/lib/employment/index.ts)
- [apps/hr-suite/app/api/employments/[employmentId]/route.ts](file://apps/hr-suite/app/api/employments/[employmentId]/route.ts)
- [apps/hr-suite/app/api/hr-events/route.ts](file://apps/hr-suite/app/api/hr-events/route.ts)

**Section sources**
- [apps/hr-suite/lib/employment/index.ts](file://apps/hr-suite/lib/employment/index.ts)
- [apps/hr-suite/app/api/employments/[employmentId]/route.ts](file://apps/hr-suite/app/api/employments/[employmentId]/route.ts)
- [apps/hr-suite/app/api/hr-events/route.ts](file://apps/hr-suite/app/api/hr-events/route.ts)

### Employee Data Processing
Employee services handle master data operations with robust validation and authorization:
- Input validation against schema constraints
- Authorization checks based on tenant and role scopes
- Data normalization and enrichment
- Persistence via Supabase client with proper error mapping

```mermaid
classDiagram
class EmployeeService {
+createEmployee(data) Promise<Employee>
+updateEmployee(id, data) Promise<Employee>
+archiveEmployee(id) Promise<boolean>
-validateInput(data) ValidationResult
-enrichWithDefaults(data) Employee
}
class AuthContext {
+getTenantId() string
+hasPermission(action) boolean
}
class SupabaseClient {
+insert(table, row) Promise<Result>
+update(table, id, row) Promise<Result>
+delete(table, id) Promise<Result>
}
EmployeeService --> AuthContext : "uses"
EmployeeService --> SupabaseClient : "persists"
```

**Diagram sources**
- [apps/hr-suite/lib/employees/index.ts](file://apps/hr-suite/lib/employees/index.ts)
- [apps/hr-suite/lib/security/auth-context.ts](file://apps/hr-suite/lib/security/auth-context.ts)
- [apps/hr-suite/lib/supabase/client.ts](file://apps/hr-suite/lib/supabase/client.ts)

**Section sources**
- [apps/hr-suite/lib/employees/index.ts](file://apps/hr-suite/lib/employees/index.ts)
- [apps/hr-suite/lib/security/auth-context.ts](file://apps/hr-suite/lib/security/auth-context.ts)
- [apps/hr-suite/lib/supabase/client.ts](file://apps/hr-suite/lib/supabase/client.ts)

### Organizational Hierarchy Calculations
Organization services compute hierarchical structures and assignments:
- Resolve department trees and management chains
- Calculate reporting relationships and placement hierarchies
- Optimize queries for large organizations using indexed lookups
- Cache computed charts for frequently accessed views

```mermaid
sequenceDiagram
participant Client as "Client"
participant Route as "Org Chart Route"
participant OrgService as "Organization Service"
participant DB as "Supabase Client"
Client->>Route : GET /organization-chart
Route->>OrgService : BuildOrgChart(params)
OrgService->>DB : Query departments & assignments
DB-->>OrgService : Raw hierarchy data
OrgService->>OrgService : Compute relationships
OrgService-->>Route : Computed chart
Route-->>Client : JSON chart structure
```

**Diagram sources**
- [apps/hr-suite/app/api/organization-chart/route.ts](file://apps/hr-suite/app/api/organization-chart/route.ts)
- [apps/hr-suite/lib/organization/index.ts](file://apps/hr-suite/lib/organization/index.ts)
- [apps/hr-suite/lib/supabase/client.ts](file://apps/hr-suite/lib/supabase/client.ts)

**Section sources**
- [apps/hr-suite/app/api/organization-chart/route.ts](file://apps/hr-suite/app/api/organization-chart/route.ts)
- [apps/hr-suite/lib/organization/index.ts](file://apps/hr-suite/lib/organization/index.ts)
- [apps/hr-suite/lib/supabase/client.ts](file://apps/hr-suite/lib/supabase/client.ts)

### Leave Engine Business Rules
Leave services implement comprehensive leave management:
- Accrual calculation based on work patterns and holidays
- Request validation against policies and balances
- Booking operations with ledger updates
- Balance reporting with aggregation and filtering

```mermaid
flowchart TD
Start(["Leave Request"]) --> ValidateRequest["Validate Request Against Policies"]
ValidateRequest --> CheckBalance["Check Available Balance"]
CheckBalance --> BalanceSufficient{"Sufficient Balance?"}
BalanceSufficient --> |No| Reject["Reject Request"]
BalanceSufficient --> |Yes| BookLeave["Book Leave Transaction"]
BookLeave --> UpdateLedger["Update Ledger Entries"]
UpdateLedger --> EmitEvent["Emit HR Event"]
EmitEvent --> Complete(["Complete"])
Reject --> Complete
```

**Diagram sources**
- [apps/hr-suite/app/api/leave/request/route.ts](file://apps/hr-suite/app/api/leave/request/route.ts)
- [apps/hr-suite/lib/leave/index.ts](file://apps/hr-suite/lib/leave/index.ts)
- [apps/hr-suite/lib/settings/holidays/index.ts](file://apps/hr-suite/lib/settings/holidays/index.ts)
- [apps/hr-suite/lib/work-patterns/index.ts](file://apps/hr-suite/lib/work-patterns/index.ts)

**Section sources**
- [apps/hr-suite/app/api/leave/request/route.ts](file://apps/hr-suite/app/api/leave/request/route.ts)
- [apps/hr-suite/lib/leave/index.ts](file://apps/hr-suite/lib/leave/index.ts)
- [apps/hr-suite/lib/settings/holidays/index.ts](file://apps/hr-suite/lib/settings/holidays/index.ts)
- [apps/hr-suite/lib/work-patterns/index.ts](file://apps/hr-suite/lib/work-patterns/index.ts)

### Transaction Management
Transactions are managed at the service layer to ensure data consistency:
- Database-level transactions for atomic operations
- Compensation logic for partial failures
- Rollback strategies for complex multi-step processes
- Event emission only after successful commits

```mermaid
flowchart TD
Start(["Transaction Start"]) --> BeginTx["Begin Database Transaction"]
BeginTx --> Step1["Execute Step 1"]
Step1 --> Step2["Execute Step 2"]
Step2 --> Step3["Execute Step 3"]
Step3 --> Success{"All Steps Success?"}
Success --> |Yes| Commit["Commit Transaction"]
Success --> |No| Rollback["Rollback Transaction"]
Commit --> EmitEvents["Emit HR Events"]
EmitEvents --> End(["End"])
Rollback --> HandleError["Handle Error"]
HandleError --> End
```

**Diagram sources**
- [apps/hr-suite/lib/employment/index.ts](file://apps/hr-suite/lib/employment/index.ts)
- [apps/hr-suite/lib/leave/index.ts](file://apps/hr-suite/lib/leave/index.ts)
- [apps/hr-suite/lib/supabase/client.ts](file://apps/hr-suite/lib/supabase/client.ts)

**Section sources**
- [apps/hr-suite/lib/employment/index.ts](file://apps/hr-suite/lib/employment/index.ts)
- [apps/hr-suite/lib/leave/index.ts](file://apps/hr-suite/lib/leave/index.ts)
- [apps/hr-suite/lib/supabase/client.ts](file://apps/hr-suite/lib/supabase/client.ts)

### Validation Pipelines
Validation pipelines ensure data integrity and policy compliance:
- Schema validation for input payloads
- Business rule validation against current state
- Cross-field validation and dependency checks
- User-friendly error messages with localized strings

```mermaid
flowchart TD
Start(["Input Data"]) --> SchemaValidate["Schema Validation"]
SchemaValidate --> BusinessRules["Business Rule Validation"]
BusinessRules --> StateChecks["State Dependency Checks"]
StateChecks --> PolicyChecks["Policy Compliance"]
PolicyChecks --> Valid{"Valid?"}
Valid --> |No| MapErrors["Map Errors To Localized Messages"]
Valid --> |Yes| Proceed["Proceed To Processing"]
MapErrors --> ReturnError["Return Validation Errors"]
Proceed --> End(["End"])
ReturnError --> End
```

**Diagram sources**
- [apps/hr-suite/lib/employees/index.ts](file://apps/hr-suite/lib/employees/index.ts)
- [apps/hr-suite/lib/employment/index.ts](file://apps/hr-suite/lib/employment/index.ts)
- [apps/hr-suite/lib/leave/index.ts](file://apps/hr-suite/lib/leave/index.ts)
- [apps/hr-suite/messages/en/validation.json](file://apps/hr-suite/messages/en/validation.json)

**Section sources**
- [apps/hr-suite/lib/employees/index.ts](file://apps/hr-suite/lib/employees/index.ts)
- [apps/hr-suite/lib/employment/index.ts](file://apps/hr-suite/lib/employment/index.ts)
- [apps/hr-suite/lib/leave/index.ts](file://apps/hr-suite/lib/leave/index.ts)
- [apps/hr-suite/messages/en/validation.json](file://apps/hr-suite/messages/en/validation.json)

### Error Propagation Patterns
Error handling follows consistent patterns across services:
- Domain-specific error types with structured messages
- Translation of technical errors to user-friendly messages
- Proper HTTP status code mapping
- Audit logging for critical failures

```mermaid
classDiagram
class ValidationError {
+field : string
+message : string
+code : string
}
class BusinessError {
+reason : string
+context : object
+recoverable : boolean
}
class ServiceLayer {
+handleError(error) Response
+mapToUserMessage(error) string
+logError(error) void
}
ServiceLayer --> ValidationError : "throws"
ServiceLayer --> BusinessError : "throws"
```

**Diagram sources**
- [apps/hr-suite/messages/en/errors.json](file://apps/hr-suite/messages/en/errors.json)
- [apps/hr-suite/lib/employees/index.ts](file://apps/hr-suite/lib/employees/index.ts)
- [apps/hr-suite/lib/employment/index.ts](file://apps/hr-suite/lib/employment/index.ts)
- [apps/hr-suite/lib/leave/index.ts](file://apps/hr-suite/lib/leave/index.ts)

**Section sources**
- [apps/hr-suite/messages/en/errors.json](file://apps/hr-suite/messages/en/errors.json)
- [apps/hr-suite/lib/employees/index.ts](file://apps/hr-suite/lib/employees/index.ts)
- [apps/hr-suite/lib/employment/index.ts](file://apps/hr-suite/lib/employment/index.ts)
- [apps/hr-suite/lib/leave/index.ts](file://apps/hr-suite/lib/leave/index.ts)

## Dependency Analysis
The business logic layer exhibits clear separation of concerns:
- API routes depend on services for business logic
- Services depend on data access clients and utility modules
- Cross-cutting concerns are isolated in dedicated modules
- Minimal coupling between domain modules through well-defined interfaces

```mermaid
graph TB
subgraph "API Layer"
API1["employees/route.ts"]
API2["employments/[employmentId]/route.ts"]
API3["leave/request/route.ts"]
end
subgraph "Service Layer"
SVC1["employees/index.ts"]
SVC2["employment/index.ts"]
SVC3["leave/index.ts"]
end
subgraph "Infrastructure"
INF1["supabase/client.ts"]
INF2["security/auth-context.ts"]
INF3["settings/holidays/index.ts"]
end
API1 --> SVC1
API2 --> SVC2
API3 --> SVC3
SVC1 --> INF1
SVC1 --> INF2
SVC2 --> INF1
SVC2 --> INF2
SVC3 --> INF1
SVC3 --> INF2
SVC3 --> INF3
```

**Diagram sources**
- [apps/hr-suite/app/api/employees/route.ts](file://apps/hr-suite/app/api/employees/route.ts)
- [apps/hr-suite/app/api/employments/[employmentId]/route.ts](file://apps/hr-suite/app/api/employments/[employmentId]/route.ts)
- [apps/hr-suite/app/api/leave/request/route.ts](file://apps/hr-suite/app/api/leave/request/route.ts)
- [apps/hr-suite/lib/employees/index.ts](file://apps/hr-suite/lib/employees/index.ts)
- [apps/hr-suite/lib/employment/index.ts](file://apps/hr-suite/lib/employment/index.ts)
- [apps/hr-suite/lib/leave/index.ts](file://apps/hr-suite/lib/leave/index.ts)
- [apps/hr-suite/lib/supabase/client.ts](file://apps/hr-suite/lib/supabase/client.ts)
- [apps/hr-suite/lib/security/auth-context.ts](file://apps/hr-suite/lib/security/auth-context.ts)
- [apps/hr-suite/lib/settings/holidays/index.ts](file://apps/hr-suite/lib/settings/holidays/index.ts)

**Section sources**
- [apps/hr-suite/app/api/employees/route.ts](file://apps/hr-suite/app/api/employees/route.ts)
- [apps/hr-suite/app/api/employments/[employmentId]/route.ts](file://apps/hr-suite/app/api/employments/[employmentId]/route.ts)
- [apps/hr-suite/app/api/leave/request/route.ts](file://apps/hr-suite/app/api/leave/request/route.ts)
- [apps/hr-suite/lib/employees/index.ts](file://apps/hr-suite/lib/employees/index.ts)
- [apps/hr-suite/lib/employment/index.ts](file://apps/hr-suite/lib/employment/index.ts)
- [apps/hr-suite/lib/leave/index.ts](file://apps/hr-suite/lib/leave/index.ts)
- [apps/hr-suite/lib/supabase/client.ts](file://apps/hr-suite/lib/supabase/client.ts)
- [apps/hr-suite/lib/security/auth-context.ts](file://apps/hr-suite/lib/security/auth-context.ts)
- [apps/hr-suite/lib/settings/holidays/index.ts](file://apps/hr-suite/lib/settings/holidays/index.ts)

## Performance Considerations
- Query optimization: Use indexed columns and efficient joins for large datasets
- Caching strategies: Implement in-memory caching for frequently accessed data like holidays and work patterns
- Async operations: Leverage parallel execution for independent operations
- Connection pooling: Configure optimal connection pool sizes for database operations
- Pagination: Implement cursor-based pagination for large result sets
- Lazy loading: Load related data on demand to reduce initial payload size

## Troubleshooting Guide
Common issues and their resolution patterns:
- Validation errors: Check input schemas and business rule configurations
- Authorization failures: Verify user permissions and tenant scoping
- Database errors: Inspect connection pools and query performance
- Transaction failures: Review rollback scenarios and compensation logic
- Performance issues: Monitor query execution times and cache hit rates

**Section sources**
- [apps/hr-suite/messages/en/errors.json](file://apps/hr-suite/messages/en/errors.json)
- [apps/hr-suite/messages/en/validation.json](file://apps/hr-suite/messages/en/validation.json)

## Conclusion
LiquidHR's business logic layer implements a robust service-oriented architecture with clear separation of concerns. The lib directory organizes domain-specific modules that encapsulate business rules while maintaining clean boundaries with data access layers. Employment lifecycle management, employee data processing, organizational hierarchy calculations, and leave engine operations are implemented with comprehensive validation, transaction management, and error handling. Performance optimizations including caching, async operations, and query optimization ensure scalability and responsiveness.