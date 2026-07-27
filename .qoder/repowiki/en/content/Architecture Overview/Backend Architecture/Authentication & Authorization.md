# Authentication & Authorization

<cite>
**Referenced Files in This Document**
- [apps/hr-suite/app/auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)
- [apps/hr-suite/app/auth/reset-password/actions.ts](file://apps/hr-suite/app/auth/reset-password/actions.ts)
- [apps/hr-suite/app/auth/signout/route.ts](file://apps/hr-suite/app/auth/signout/route.ts)
- [apps/hr-suite/app/invite/[token]/actions.ts](file://apps/hr-suite/app/invite/[token]/actions.ts)
- [apps/hr-suite/app/api/context/administration/route.ts](file://apps/hr-suite/app/api/context/administration/route.ts)
- [apps/hr-suite/app/api/context/route.ts](file://apps/hr-suite/app/api/context/route.ts)
- [apps/hr-suite/app/api/invitations/route.ts](file://apps/hr-suite/app/api/invitations/route.ts)
- [apps/hr-suite/components/auth/auth-shell.tsx](file://apps/hr-suite/components/auth/auth-shell.tsx)
- [apps/hr-suite/components/auth/login-form.tsx](file://apps/hr-suite/components/auth/login-form.tsx)
- [apps/hr-suite/components/auth/password-reset-form.tsx](file://apps/hr-suite/components/auth/password-reset-form.tsx)
- [apps/hr-suite/components/auth/invitation-form.tsx](file://apps/hr-suite/components/auth/invitation-form.tsx)
- [apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql](file://apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql)
- [apps/hr-suite/supabase/migrations/20260714180142_enforce_administration_management_scope.sql](file://apps/hr-suite/supabase/migrations/20260714180142_enforce_administration_management_scope.sql)
- [apps/hr-suite/supabase/migrations/20260715064245_add_user_invitations.sql](file://apps/hr-suite/supabase/migrations/20260715064245_add_user_invitations.sql)
- [apps/hr-suite/supabase/migrations/20260715064924_harden_user_invitation_acceptance.sql](file://apps/hr-suite/supabase/migrations/2026064924_harden_user_invitation_acceptance.sql)
- [apps/hr-suite/supabase/migrations/20260715131230_seed_custom_fields_and_tenant_roles.sql](file://apps/hr-suite/supabase/migrations/20260715131230_seed_custom_fields_and_tenant_roles.sql)
- [apps/hr-suite/supabase/migrations/20260724112407_add_role_assignment_scope.sql](file://apps/hr-suite/supabase/migrations/20260724112407_add_role_assignment_scope.sql)
- [apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql)
- [apps/hr-suite/supabase/migrations/20260724172716_harden_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724172716_harden_employee_activity_entries.sql)
- [apps/hr-suite/supabase/tests/user_invitation_isolation.sql](file://apps/hr-suite/supabase/tests/user_invitation_isolation.sql)
- [apps/hr-suite/supabase/tests/multitenancy_isolation.sql](file://apps/hr-suite/supabase/tests/multitenancy_isolation.sql)
- [apps/hr-suite/supabase/config.toml](file://apps/hr-suite/supabase/config.toml)
- [apps/hr-suite/proxy.ts](file://apps/hr-suite/proxy.ts)
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
This document explains LiquidHR’s authentication and authorization system with a focus on Supabase Auth integration, JWT handling, session management, role-based access control (RBAC), Row Level Security (RLS), multitenancy security model, administration scope isolation, user invitation workflow, API route protection, custom permissions, password reset flows, email verification, audit logging, security monitoring, and compliance considerations for HR data protection. It is designed to be accessible to both technical and non-technical readers while providing code-level references for implementation details.

## Project Structure
The authentication and authorization features are implemented across Next.js App Router routes, server actions, UI components, and Supabase migrations and tests:
- Authentication entry points and callbacks live under app/auth and app/invite.
- API routes enforce authorization and context resolution for tenant and administration scoping.
- Supabase migrations define RBAC tables, RLS policies, and audit logging structures.
- Tests validate isolation boundaries for invitations and multitenancy.

```mermaid
graph TB
subgraph "Next.js App"
A["auth/callback/route.ts"]
B["auth/signout/route.ts"]
C["auth/reset-password/actions.ts"]
D["invite/[token]/actions.ts"]
E["api/context/route.ts"]
F["api/context/administration/route.ts"]
G["api/invitations/route.ts"]
end
subgraph "Supabase"
H["Auth Service"]
I["Postgres + RLS Policies"]
J["Audit Tables"]
end
A --> H
B --> H
C --> H
D --> H
E --> I
F --> I
G --> I
I --> J
```

**Diagram sources**
- [apps/hr-suite/app/auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)
- [apps/hr-suite/app/auth/signout/route.ts](file://apps/hr-suite/app/auth/signout/route.ts)
- [apps/hr-suite/app/auth/reset-password/actions.ts](file://apps/hr-suite/app/auth/reset-password/actions.ts)
- [apps/hr-suite/app/invite/[token]/actions.ts](file://apps/hr-suite/app/invite/[token]/actions.ts)
- [apps/hr-suite/app/api/context/route.ts](file://apps/hr-suite/app/api/context/route.ts)
- [apps/hr-suite/app/api/context/administration/route.ts](file://apps/hr-suite/app/api/context/administration/route.ts)
- [apps/hr-suite/app/api/invitations/route.ts](file://apps/hr-suite/app/api/invitations/route.ts)
- [apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql](file://apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql)
- [apps/hr-suite/supabase/migrations/20260715064245_add_user_invitations.sql](file://apps/hr-suite/supabase/migrations/20260715064245_add_user_invitations.sql)
- [apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql)

**Section sources**
- [apps/hr-suite/app/auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)
- [apps/hr-suite/app/auth/signout/route.ts](file://apps/hr-suite/app/auth/signout/route.ts)
- [apps/hr-suite/app/auth/reset-password/actions.ts](file://apps/hr-suite/app/auth/reset-password/actions.ts)
- [apps/hr-suite/app/invite/[token]/actions.ts](file://apps/hr-suite/app/invite/[token]/actions.ts)
- [apps/hr-suite/app/api/context/route.ts](file://apps/hr-suite/app/api/context/route.ts)
- [apps/hr-suite/app/api/context/administration/route.ts](file://apps/hr-suite/app/api/context/administration/route.ts)
- [apps/hr-suite/app/api/invitations/route.ts](file://apps/hr-suite/app/api/invitations/route.ts)

## Core Components
- Supabase Auth integration: Handles sign-in, callback processing, and session establishment via Next.js API routes and server actions.
- JWT token handling: Relies on Supabase client-side SDK to manage tokens and sessions; server routes validate requests using Supabase middleware or service keys where appropriate.
- Session management: Centralized through Supabase Auth sessions; sign-out clears local state and invalidates the session.
- RBAC and RLS: Enforced at the database layer with policies that restrict row access based on roles, tenants, and administrations.
- Multitenancy and administration scope: Users belong to organizations and can be scoped to specific administrations within an organization.
- User invitation workflow: Secure acceptance flow with token validation and isolation checks.

**Section sources**
- [apps/hr-suite/app/auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)
- [apps/hr-suite/app/auth/signout/route.ts](file://apps/hr-suite/app/auth/signout/route.ts)
- [apps/hr-suite/app/auth/reset-password/actions.ts](file://apps/hr-suite/app/auth/reset-password/actions.ts)
- [apps/hr-suite/app/invite/[token]/actions.ts](file://apps/hr-suite/app/invite/[token]/actions.ts)
- [apps/hr-suite/app/api/context/route.ts](file://apps/hr-suite/app/api/context/route.ts)
- [apps/hr-suite/app/api/context/administration/route.ts](file://apps/hr-suite/app/api/context/administration/route.ts)
- [apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql](file://apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql)
- [apps/hr-suite/supabase/migrations/20260714180142_enforce_administration_management_scope.sql](file://apps/hr-suite/supabase/migrations/20260714180142_enforce_administration_management_scope.sql)
- [apps/hr-suite/supabase/migrations/20260715064245_add_user_invitations.sql](file://apps/hr-suite/supabase/migrations/20260715064245_add_user_invitations.sql)
- [apps/hr-suite/supabase/migrations/20260715064924_harden_user_invitation_acceptance.sql](file://apps/hr-suite/supabase/migrations/20260715064924_harden_user_invitation_acceptance.sql)

## Architecture Overview
LiquidHR uses Supabase Auth for identity and session management, Next.js API routes for authorization logic, and Postgres RLS for fine-grained data access control. The architecture ensures that:
- Authentication occurs via Supabase and redirects through the callback route.
- Context resolution determines the active tenant and administration scope.
- RBAC policies govern what resources a user can access within their scope.
- Audit events are recorded for sensitive operations.

```mermaid
sequenceDiagram
participant U as "User"
participant UI as "Login Form"
participant CB as "auth/callback/route.ts"
participant SA as "Supabase Auth"
participant CTX as "api/context/route.ts"
participant DB as "Postgres + RLS"
U->>UI : Enter credentials
UI->>SA : Sign in request
SA-->>CB : Redirect with auth params
CB->>SA : Exchange session
CB-->>U : Set session cookies
U->>CTX : Request protected resource
CTX->>DB : Validate role and scope via RLS
DB-->>CTX : Authorized data or error
CTX-->>U : Response with authorized payload
```

**Diagram sources**
- [apps/hr-suite/components/auth/login-form.tsx](file://apps/hr-suite/components/auth/login-form.tsx)
- [apps/hr-suite/app/auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)
- [apps/hr-suite/app/api/context/route.ts](file://apps/hr-suite/app/api/context/route.ts)
- [apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql](file://apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql)

## Detailed Component Analysis

### Authentication Callback and Session Establishment
- Purpose: Finalize login by exchanging Supabase auth parameters, establishing a session, and redirecting to the application dashboard.
- Key behaviors: Validates callback state, sets secure cookies, and initializes client session.

```mermaid
flowchart TD
Start(["Callback Entry"]) --> ValidateParams["Validate auth params"]
ValidateParams --> SessionExchange["Exchange session with Supabase"]
SessionExchange --> SetCookies["Set secure session cookies"]
SetCookies --> Redirect["Redirect to dashboard"]
Redirect --> End(["Session Active"])
```

**Diagram sources**
- [apps/hr-suite/app/auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)

**Section sources**
- [apps/hr-suite/app/auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)

### Sign Out Flow
- Purpose: Invalidate the current session and clear local state.
- Key behaviors: Calls Supabase sign out, removes cookies, and redirects to login.

```mermaid
sequenceDiagram
participant U as "User"
participant UI as "Logout Action"
participant SR as "auth/signout/route.ts"
participant SA as "Supabase Auth"
U->>UI : Click logout
UI->>SR : POST /auth/signout
SR->>SA : Sign out request
SA-->>SR : Success
SR-->>U : Redirect to login
```

**Diagram sources**
- [apps/hr-suite/app/auth/signout/route.ts](file://apps/hr-suite/app/auth/signout/route.ts)

**Section sources**
- [apps/hr-suite/app/auth/signout/route.ts](file://apps/hr-suite/app/auth/signout/route.ts)

### Password Reset Flow
- Purpose: Allow users to securely reset passwords via email confirmation.
- Key behaviors: Initiates reset, verifies email, updates password, and logs the event.

```mermaid
sequenceDiagram
participant U as "User"
participant PRF as "Password Reset Form"
participant ACT as "auth/reset-password/actions.ts"
participant SA as "Supabase Auth"
U->>PRF : Submit email for reset
PRF->>ACT : Trigger reset action
ACT->>SA : Send password reset email
SA-->>ACT : Email sent
ACT-->>U : Confirmation message
U->>SA : Confirm reset link
SA-->>ACT : Update password
ACT-->>U : Success
```

**Diagram sources**
- [apps/hr-suite/components/auth/password-reset-form.tsx](file://apps/hr-suite/components/auth/password-reset-form.tsx)
- [apps/hr-suite/app/auth/reset-password/actions.ts](file://apps/hr-suite/app/auth/reset-password/actions.ts)

**Section sources**
- [apps/hr-suite/components/auth/password-reset-form.tsx](file://apps/hr-suite/components/auth/password-reset-form.tsx)
- [apps/hr-suite/app/auth/reset-password/actions.ts](file://apps/hr-suite/app/auth/reset-password/actions.ts)

### User Invitation Workflow
- Purpose: Invite new users to join an organization and accept invitations securely.
- Key behaviors: Creates invitation records, validates tokens, enforces isolation, and assigns initial roles/scopes.

```mermaid
sequenceDiagram
participant Admin as "Admin"
participant INV as "api/invitations/route.ts"
participant DB as "Postgres + RLS"
participant Accept as "invite/[token]/actions.ts"
participant SA as "Supabase Auth"
Admin->>INV : Create invitation
INV->>DB : Insert invitation record
DB-->>INV : Success
INV-->>Admin : Invitation email sent
Admin->>Accept : Accept invitation with token
Accept->>DB : Validate token and isolation
Accept->>SA : Link user to organization
SA-->>Accept : Success
Accept-->>Admin : Role assigned and scope set
```

**Diagram sources**
- [apps/hr-suite/app/api/invitations/route.ts](file://apps/hr-suite/app/api/invitations/route.ts)
- [apps/hr-suite/app/invite/[token]/actions.ts](file://apps/hr-suite/app/invite/[token]/actions.ts)
- [apps/hr-suite/supabase/migrations/20260715064245_add_user_invitations.sql](file://apps/hr-suite/supabase/migrations/20260715064245_add_user_invitations.sql)
- [apps/hr-suite/supabase/migrations/20260715064924_harden_user_invitation_acceptance.sql](file://apps/hr-suite/supabase/migrations/20260715064924_harden_user_invitation_acceptance.sql)

**Section sources**
- [apps/hr-suite/app/api/invitations/route.ts](file://apps/hr-suite/app/api/invitations/route.ts)
- [apps/hr-suite/app/invite/[token]/actions.ts](file://apps/hr-suite/app/invite/[token]/actions.ts)
- [apps/hr-suite/supabase/migrations/20260715064245_add_user_invitations.sql](file://apps/hr-suite/supabase/migrations/20260715064245_add_user_invitations.sql)
- [apps/hr-suite/supabase/migrations/20260715064924_harden_user_invitation_acceptance.sql](file://apps/hr-suite/supabase/migrations/20260715064924_harden_user_invitation_acceptance.sql)

### Context Resolution and Administration Scope
- Purpose: Determine the active tenant and administration scope for authenticated users.
- Key behaviors: Resolves context from session and user roles, enforces scope constraints, and returns authorized context.

```mermaid
flowchart TD
Entry(["Context Route"]) --> ResolveUser["Resolve authenticated user"]
ResolveUser --> LookupRoles["Lookup roles and scopes"]
LookupRoles --> CheckScope{"Valid administration scope?"}
CheckScope --> |Yes| ReturnCtx["Return authorized context"]
CheckScope --> |No| Deny["Deny access"]
ReturnCtx --> End(["Authorized"])
Deny --> End(["Unauthorized"])
```

**Diagram sources**
- [apps/hr-suite/app/api/context/route.ts](file://apps/hr-suite/app/api/context/route.ts)
- [apps/hr-suite/app/api/context/administration/route.ts](file://apps/hr-suite/app/api/context/administration/route.ts)
- [apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql](file://apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql)
- [apps/hr-suite/supabase/migrations/20260714180142_enforce_administration_management_scope.sql](file://apps/hr-suite/supabase/migrations/20260714180142_enforce_administration_management_scope.sql)

**Section sources**
- [apps/hr-suite/app/api/context/route.ts](file://apps/hr-suite/app/api/context/route.ts)
- [apps/hr-suite/app/api/context/administration/route.ts](file://apps/hr-suite/app/api/context/administration/route.ts)
- [apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql](file://apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql)
- [apps/hr-suite/supabase/migrations/20260714180142_enforce_administration_management_scope.sql](file://apps/hr-suite/supabase/migrations/20260714180142_enforce_administration_management_scope.sql)

### RBAC Implementation and Permission Checking
- Roles and scopes are defined and enforced via database policies and role assignments.
- Permission checks occur at the API layer and are backed by RLS policies ensuring row-level isolation.
- Custom permissions can be modeled as role-scoped capabilities and validated in server routes.

```mermaid
classDiagram
class Role {
+string id
+string name
+string organization_id
}
class RoleAssignment {
+string id
+string user_id
+string role_id
+string administration_id
+timestamp expires_at
}
class Policy {
+string table
+string operation
+string condition
}
Role <|-- RoleAssignment : "assigned to users"
Policy --> RoleAssignment : "evaluated against"
```

**Diagram sources**
- [apps/hr-suite/supabase/migrations/20260715131230_seed_custom_fields_and_tenant_roles.sql](file://apps/hr-suite/supabase/migrations/20260715131230_seed_custom_fields_and_tenant_roles.sql)
- [apps/hr-suite/supabase/migrations/20260724112407_add_role_assignment_scope.sql](file://apps/hr-suite/supabase/migrations/20260724112407_add_role_assignment_scope.sql)

**Section sources**
- [apps/hr-suite/supabase/migrations/20260715131230_seed_custom_fields_and_tenant_roles.sql](file://apps/hr-suite/supabase/migrations/20260715131230_seed_custom_fields_and_tenant_roles.sql)
- [apps/hr-suite/supabase/migrations/20260724112407_add_role_assignment_scope.sql](file://apps/hr-suite/supabase/migrations/20260724112407_add_role_assignment_scope.sql)

### Multitenancy Security Model and Administration Isolation
- Organizations encapsulate tenants; users are scoped to specific administrations within an organization.
- RLS policies ensure data isolation per administration and prevent cross-tenant access.
- Context routes enforce scope resolution before serving data.

```mermaid
graph TB
Org["Organization"]
AdminA["Administration A"]
AdminB["Administration B"]
User1["User 1"]
User2["User 2"]
DataA["Data A"]
DataB["Data B"]
Org --> AdminA
Org --> AdminB
AdminA --> DataA
AdminB --> DataB
User1 --> AdminA
User2 --> AdminB
DataA -- RLS --> User1
DataB -- RLS --> User2
```

**Diagram sources**
- [apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql](file://apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql)
- [apps/hr-suite/supabase/migrations/20260714180142_enforce_administration_management_scope.sql](file://apps/hr-suite/supabase/migrations/20260714180142_enforce_administration_management_scope.sql)

**Section sources**
- [apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql](file://apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql)
- [apps/hr-suite/supabase/migrations/20260714180142_enforce_administration_management_scope.sql](file://apps/hr-suite/supabase/migrations/20260714180142_enforce_administration_management_scope.sql)

### Protecting API Routes and Handling Authorization Failures
- Protected routes resolve user context and verify permissions before executing business logic.
- Authorization failures return standardized errors and avoid leaking internal details.
- Example patterns include checking role membership, verifying administration scope, and enforcing RLS.

```mermaid
flowchart TD
Req(["API Request"]) --> AuthCheck["Authenticate user"]
AuthCheck --> PermCheck{"Has required permission?"}
PermCheck --> |Yes| Execute["Execute business logic"]
PermCheck --> |No| Error["Return 403 Forbidden"]
Execute --> Resp["Return response"]
Error --> Resp
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

### Audit Logging and Security Monitoring
- Employee activity entries are captured for sensitive operations to support auditing and compliance.
- Hardened audit tables ensure integrity and immutability where applicable.
- Monitoring should track failed auth attempts, policy denials, and unusual access patterns.

```mermaid
sequenceDiagram
participant API as "Protected API"
participant AUD as "Audit Logger"
participant DB as "Audit Tables"
API->>AUD : Log sensitive operation
AUD->>DB : Insert immutable audit entry
DB-->>AUD : Acknowledge
AUD-->>API : Continue processing
```

**Diagram sources**
- [apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql)
- [apps/hr-suite/supabase/migrations/20260724172716_harden_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724172716_harden_employee_activity_entries.sql)

**Section sources**
- [apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql)
- [apps/hr-suite/supabase/migrations/20260724172716_harden_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724172716_harden_employee_activity_entries.sql)

### Email Verification and Security Best Practices
- Email verification is handled by Supabase Auth during sign-up and password reset flows.
- Best practices include:
  - Enforcing HTTPS and secure cookies.
  - Using short-lived tokens for password resets and invitations.
  - Validating all inputs and rejecting malformed requests early.
  - Applying least privilege principles for roles and scopes.
  - Regularly reviewing RLS policies and role assignments.

**Section sources**
- [apps/hr-suite/app/auth/reset-password/actions.ts](file://apps/hr-suite/app/auth/reset-password/actions.ts)
- [apps/hr-suite/supabase/migrations/20260715064245_add_user_invitations.sql](file://apps/hr-suite/supabase/migrations/20260715064245_add_user_invitations.sql)

## Dependency Analysis
Authentication and authorization depend on Supabase Auth, Next.js routing, and Postgres RLS policies. The following diagram illustrates key dependencies:

```mermaid
graph TB
Login["login-form.tsx"] --> Callback["auth/callback/route.ts"]
Callback --> Supabase["Supabase Auth"]
SignOut["auth/signout/route.ts"] --> Supabase
Reset["auth/reset-password/actions.ts"] --> Supabase
Invitations["api/invitations/route.ts"] --> RLS["Postgres RLS"]
Context["api/context/route.ts"] --> RLS
AdminCtx["api/context/administration/route.ts"] --> RLS
RLS --> Audit["employee_activity_entries"]
```

**Diagram sources**
- [apps/hr-suite/components/auth/login-form.tsx](file://apps/hr-suite/components/auth/login-form.tsx)
- [apps/hr-suite/app/auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)
- [apps/hr-suite/app/auth/signout/route.ts](file://apps/hr-suite/app/auth/signout/route.ts)
- [apps/hr-suite/app/auth/reset-password/actions.ts](file://apps/hr-suite/app/auth/reset-password/actions.ts)
- [apps/hr-suite/app/api/invitations/route.ts](file://apps/hr-suite/app/api/invitations/route.ts)
- [apps/hr-suite/app/api/context/route.ts](file://apps/hr-suite/app/api/context/route.ts)
- [apps/hr-suite/app/api/context/administration/route.ts](file://apps/hr-suite/app/api/context/administration/route.ts)
- [apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql)

**Section sources**
- [apps/hr-suite/components/auth/login-form.tsx](file://apps/hr-suite/components/auth/login-form.tsx)
- [apps/hr-suite/app/auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)
- [apps/hr-suite/app/auth/signout/route.ts](file://apps/hr-suite/app/auth/signout/route.ts)
- [apps/hr-suite/app/auth/reset-password/actions.ts](file://apps/hr-suite/app/auth/reset-password/actions.ts)
- [apps/hr-suite/app/api/invitations/route.ts](file://apps/hr-suite/app/api/invitations/route.ts)
- [apps/hr-suite/app/api/context/route.ts](file://apps/hr-suite/app/api/context/route.ts)
- [apps/hr-suite/app/api/context/administration/route.ts](file://apps/hr-suite/app/api/context/administration/route.ts)
- [apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql](file://apps/hr-suite/supabase/migrations/20260724160000_add_employee_activity_entries.sql)

## Performance Considerations
- Minimize round-trips to Supabase Auth by caching user context where safe.
- Use efficient RLS policies with indexed columns to reduce query latency.
- Avoid heavy computations in API routes; delegate to database functions when possible.
- Monitor slow queries and optimize indexes for frequently accessed tables.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Invalid callback state: Ensure proper configuration of Supabase Auth redirect URLs and environment variables.
- Session not persisting: Verify secure cookie settings and HTTPS usage.
- Unauthorized access: Check role assignments, administration scope, and RLS policies for the requested resource.
- Invitation acceptance failures: Validate token expiration and isolation checks; review invitation records and user linkage.
- Audit log gaps: Confirm that sensitive operations invoke the audit logger and that database inserts succeed.

**Section sources**
- [apps/hr-suite/app/auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)
- [apps/hr-suite/app/invite/[token]/actions.ts](file://apps/hr-suite/app/invite/[token]/actions.ts)
- [apps/hr-suite/supabase/tests/user_invitation_isolation.sql](file://apps/hr-suite/supabase/tests/user_invitation_isolation.sql)
- [apps/hr-suite/supabase/tests/multitenancy_isolation.sql](file://apps/hr-suite/supabase/tests/multitenancy_isolation.sql)

## Conclusion
LiquidHR’s authentication and authorization system leverages Supabase Auth, Next.js API routes, and Postgres RLS to provide secure, scalable, and auditable access control. RBAC and administration scoping ensure strict isolation across tenants, while robust invitation workflows and password reset flows maintain security and usability. Continuous monitoring and compliance practices protect sensitive HR data and support regulatory requirements.

## Appendices

### Configuration and Proxy Notes
- Supabase configuration is managed via config files and environment variables.
- Proxy settings may be used for development and testing environments.

**Section sources**
- [apps/hr-suite/supabase/config.toml](file://apps/hr-suite/supabase/config.toml)
- [apps/hr-suite/proxy.ts](file://apps/hr-suite/proxy.ts)