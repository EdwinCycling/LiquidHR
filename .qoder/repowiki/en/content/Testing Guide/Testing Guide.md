# Testing Guide

<cite>
**Referenced Files in This Document**
- [vitest.config.ts](file://apps/hr-suite/vitest.config.ts)
- [package.json](file://apps/hr-suite/package.json)
- [dashboard-progress-model.test.ts](file://apps/hr-suite/components/dashboard/dashboard-progress-model.test.ts)
- [dashboard-workspace-model.test.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.test.ts)
- [widget-picker-model.test.ts](file://apps/hr-suite/components/dashboard/widget-picker-model.test.ts)
- [hera-chat-state.test.ts](file://apps/hr-suite/components/hera/hera-chat-state.test.ts)
- [hera-floating-state.test.ts](file://apps/hr-suite/components/hera/hera-floating-state.test.ts)
- [hera-request.test.ts](file://apps/hr-suite/components/hera/hera-request.test.ts)
- [hera-response-model.test.ts](file://apps/hr-suite/components/hera/hera-response-model.test.ts)
- [app-version.test.ts](file://apps/hr-suite/lib/app-version.test.ts)
- [route.test.ts](file://apps/hr-suite/app/api/organization-chart/route.test.ts)
- [route.test.ts](file://apps/hr-suite/app/api/leave/catalog/route.test.ts)
- [route.test.ts](file://apps/hr-suite/app/api/leave/balance-report/route.test.ts)
- [route.test.ts](file://apps/hr-suite/app/api/hera/preferences/route.test.ts)
- [route.test.ts](file://apps/hr-suite/app/api/hera/memory/route.test.ts)
</cite>

## Update Summary
**Changes Made**
- Added comprehensive test coverage for leave accrual configuration functionality (63 lines of test code)
- Added comprehensive test coverage for overtime configuration functionality (99 lines of test code)
- Updated testing strategy documentation to reflect new leave engine testing patterns
- Enhanced integration testing examples with leave-related API endpoints

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
This guide documents LiquidHR's testing strategy and implementation across unit, integration, and end-to-end (E2E) layers. It explains how React components, service functions, and utility modules are tested with Vitest, how API endpoints and database operations are validated, and how to approach E2E scenarios for complete user workflows. The testing suite has been significantly expanded to include comprehensive coverage for the leave engine functionality, including accrual configuration and overtime management systems.

## Project Structure
LiquidHR uses a Next.js application structure under apps/hr-suite with tests colocated near the code they validate:
- Unit tests live alongside component logic and utilities using .test.ts files.
- API route tests reside next to their corresponding route handlers under app/api.
- The Vitest configuration is centralized at the app level.
- Leave engine tests follow the same pattern, focusing on business logic validation for accrual calculations and overtime rules.

```mermaid
graph TB
subgraph "App"
A["Next.js App<br/>apps/hr-suite/app"]
B["Components<br/>apps/hr-suite/components"]
C["Lib Utilities<br/>apps/hr-suite/lib"]
D["Leave Engine<br/>apps/hr-suite/lib/leave"]
end
subgraph "Tests"
T1["Component Tests<br/>.test.ts near components"]
T2["API Route Tests<br/>next to route.ts"]
T3["Utility Tests<br/>lib/*.test.ts"]
T4["Leave Engine Tests<br/>leave/*.test.ts"]
end
V["Vitest Config<br/>apps/hr-suite/vitest.config.ts"]
P["Package Scripts<br/>apps/hr-suite/package.json"]
A --> T2
B --> T1
C --> T3
D --> T4
V --> T1
V --> T2
V --> T3
V --> T4
P --> V
```

**Diagram sources**
- [vitest.config.ts](file://apps/hr-suite/vitest.config.ts)
- [package.json](file://apps/hr-suite/package.json)

**Section sources**
- [vitest.config.ts](file://apps/hr-suite/vitest.config.ts)
- [package.json](file://apps/hr-suite/package.json)

## Core Components
The testing foundation centers on Vitest as the runner and assertion library, integrated into the Next.js app via the app-level vitest.config.ts and npm scripts defined in package.json. Existing tests demonstrate patterns for:
- Pure model/state logic validation (e.g., dashboard models, hera state).
- API route behavior verification (e.g., organization chart, leave catalog/balance report, hera preferences/memory).
- Utility module assertions (e.g., app version helpers).
- **Updated**: Comprehensive leave engine testing covering accrual calculations, overtime rules, and configuration validation.

Key characteristics:
- Colocated tests for discoverability and maintainability.
- Clear separation between unit tests (fast, isolated) and integration tests (API routes with mocked dependencies).
- Consistent naming conventions (.test.ts) and file placement.
- **Updated**: Specialized testing patterns for complex business logic like leave accrual algorithms and overtime calculation engines.

**Section sources**
- [vitest.config.ts](file://apps/hr-suite/vitest.config.ts)
- [package.json](file://apps/hr-suite/package.json)
- [dashboard-progress-model.test.ts](file://apps/hr-suite/components/dashboard/dashboard-progress-model.test.ts)
- [dashboard-workspace-model.test.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.test.ts)
- [widget-picker-model.test.ts](file://apps/hr-suite/components/dashboard/widget-picker-model.test.ts)
- [hera-chat-state.test.ts](file://apps/hr-suite/components/hera/hera-chat-state.test.ts)
- [hera-floating-state.test.ts](file://apps/hr-suite/components/hera/hera-floating-state.test.ts)
- [hera-request.test.ts](file://apps/hr-suite/components/hera/hera-request.test.ts)
- [hera-response-model.test.ts](file://apps/hr-suite/components/hera/hera-response-model.test.ts)
- [app-version.test.ts](file://apps/hr-suite/lib/app-version.test.ts)
- [route.test.ts](file://apps/hr-suite/app/api/organization-chart/route.test.ts)
- [route.test.ts](file://apps/hr-suite/app/api/leave/catalog/route.test.ts)
- [route.test.ts](file://apps/hr-suite/app/api/leave/balance-report/route.test.ts)
- [route.test.ts](file://apps/hr-suite/app/api/hera/preferences/route.test.ts)
- [route.test.ts](file://apps/hr-suite/app/api/hera/memory/route.test.ts)

## Architecture Overview
The testing architecture follows a layered approach:
- Unit layer: Fast, deterministic tests for pure functions, state machines, and UI logic.
- Integration layer: API route tests that validate request/response contracts, authorization, and error handling by mocking external services and database calls.
- E2E layer: Browser-based flows covering multi-step user journeys across components and services.
- **Updated**: Specialized leave engine testing layer for complex business logic validation.

```mermaid
graph TB
U["Unit Tests<br/>Vitest + React Testing Library"]
I["Integration Tests<br/>API Routes + Mocks"]
E["E2E Tests<br/>Browser Automation"]
L["Leave Engine Tests<br/>Accrual & Overtime Logic"]
N["Next.js App"]
DB["Database / Supabase"]
Ext["External Services"]
U --> N
I --> N
E --> N
L --> N
N --> DB
N --> Ext
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

## Detailed Component Analysis

### Unit Testing Strategy for React Components and State Logic
- Scope: Pure logic, state transitions, and rendering expectations without network or DOM side effects.
- Patterns observed:
  - Model/state tests validate transformations and invariants (e.g., dashboard progress/workspace models).
  - Hera state and response models ensure correct state machine behavior and payload shapes.
  - **Updated**: Leave engine tests validate accrual calculations, overtime rules, and configuration validation logic.
- Best practices:
  - Keep tests focused on one behavior per file.
  - Use minimal mocks for external dependencies.
  - Assert both happy paths and edge cases.
  - **Updated**: For leave engine logic, test boundary conditions like year-end rollovers, partial periods, and rule conflicts.

```mermaid
flowchart TD
Start(["Test Entry"]) --> Arrange["Arrange inputs and mocks"]
Arrange --> Act["Act: invoke function/component"]
Act --> Assert["Assert outputs and side effects"]
Assert --> Cleanup["Cleanup mocks and state"]
Cleanup --> End(["Test Exit"])
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

**Section sources**
- [dashboard-progress-model.test.ts](file://apps/hr-suite/components/dashboard/dashboard-progress-model.test.ts)
- [dashboard-workspace-model.test.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.test.ts)
- [widget-picker-model.test.ts](file://apps/hr-suite/components/dashboard/widget-picker-model.test.ts)
- [hera-chat-state.test.ts](file://apps/hr-suite/components/hera/hera-chat-state.test.ts)
- [hera-floating-state.test.ts](file://apps/hr-suite/components/hera/hera-floating-state.test.ts)
- [hera-request.test.ts](file://apps/hr-suite/components/hera/hera-request.test.ts)
- [hera-response-model.test.ts](file://apps/hr-suite/components/hera/hera-response-model.test.ts)
- [app-version.test.ts](file://apps/hr-suite/lib/app-version.test.ts)

### Integration Testing Strategy for API Endpoints
- Scope: Validate HTTP contracts, authorization checks, input validation, and error responses.
- Patterns observed:
  - API route tests assert status codes, headers, and JSON payloads.
  - External dependencies (database, AI agent, third-party APIs) are mocked to isolate behavior.
  - **Updated**: Leave engine API endpoints are thoroughly tested for accrual calculations, overtime processing, and configuration management.
- Recommendations:
  - Create fixtures for common payloads and edge cases.
  - Test both success and failure branches explicitly.
  - Verify RBAC and tenant scoping where applicable.
  - **Updated**: Include comprehensive test cases for leave engine business rules and validation constraints.

```mermaid
sequenceDiagram
participant Client as "Test Client"
participant Route as "API Route Handler"
participant Service as "Service Layer"
participant LeaveEngine as "Leave Engine"
participant DB as "Database/Supabase"
participant Ext as "External Service"
Client->>Route : "HTTP Request"
Route->>Route : "Validate & Authorize"
Route->>Service : "Call business logic"
Service->>LeaveEngine : "Process accrual/overtime"
LeaveEngine-->>Service : "Calculated results"
Service->>DB : "Query/Mutate"
DB-->>Service : "Result"
Service->>Ext : "Optional call"
Ext-->>Service : "Response"
Service-->>Route : "Normalized result"
Route-->>Client : "HTTP Response"
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

**Section sources**
- [route.test.ts](file://apps/hr-suite/app/api/organization-chart/route.test.ts)
- [route.test.ts](file://apps/hr-suite/app/api/leave/catalog/route.test.ts)
- [route.test.ts](file://apps/hr-suite/app/api/leave/balance-report/route.test.ts)
- [route.test.ts](file://apps/hr-suite/app/api/hera/preferences/route.test.ts)
- [route.test.ts](file://apps/hr-suite/app/api/hera/memory/route.test.ts)

### E2E Testing Methodology for Complete User Workflows
- Scope: Multi-step interactions spanning authentication, navigation, form submissions, real-time updates, and cross-component state synchronization.
- Approach:
  - Use a browser automation framework (e.g., Playwright) to simulate real users.
  - Seed deterministic test data before each scenario.
  - Assert UI states, network requests, and downstream effects.
- Coverage areas:
  - Authorization flows (login, role-based access).
  - HR admin workflows (employee creation, employment lifecycle).
  - **Updated**: Leave request and approval processes with accrual validation.
  - **Updated**: Overtime configuration and rule management workflows.
  - Hera AI agent interactions (chat sessions, memory persistence).

```mermaid
flowchart TD
S(["Start E2E Scenario"]) --> Seed["Seed Test Data"]
Seed --> Auth["Authenticate User"]
Auth --> Navigate["Navigate to Feature"]
Navigate --> Interact["Interact with UI"]
Interact --> Verify["Verify UI and Backend State"]
Verify --> Cleanup["Cleanup Test Data"]
Cleanup --> E(["End Scenario"])
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

### Testing Complex Scenarios
- Authorization Flows:
  - Validate role-based access control and tenant isolation at both API and UI levels.
  - Ensure unauthorized actions return appropriate errors and UI denies access.
- Real-Time Updates:
  - Mock WebSocket/SSE events or use controlled channels in tests.
  - Assert state changes propagate correctly across components.
- AI Agent Interactions (Hera):
  - Stub LLM responses deterministically.
  - Validate conversation state, memory writes, and tool execution outcomes.
- **Updated**: Leave Engine Business Logic:
  - Test accrual calculation algorithms with various employment types and work patterns.
  - Validate overtime rule precedence and conflict resolution.
  - Ensure year-end rollover calculations and carry-forward logic accuracy.

**Section sources**
- [hera-chat-state.test.ts](file://apps/hr-suite/components/hera/hera-chat-state.test.ts)
- [hera-floating-state.test.ts](file://apps/hr-suite/components/hera/hera-floating-state.test.ts)
- [hera-request.test.ts](file://apps/hr-suite/components/hera/hera-request.test.ts)
- [hera-response-model.test.ts](file://apps/hr-suite/components/hera/hera-response-model.test.ts)

### Testing Utilities, Mock Strategies, and Test Data Management
- Utilities:
  - Centralized helpers for creating fixtures, asserting responses, and resetting mocks.
  - **Updated**: Specialized utilities for leave engine test data generation and accrual calculation validation.
- Mocking:
  - Network: Intercept fetch/XHR or use Next.js route mocks.
  - Database: Mock Supabase client methods to avoid real queries.
  - External APIs: Stub HTTP clients and time-dependent functions.
  - **Updated**: Mock leave engine services to isolate business logic testing from database operations.
- Test Data:
  - Use factories/fixtures for consistent datasets.
  - Isolate test runs with transactional cleanup or dedicated test tenants.
  - **Updated**: Comprehensive leave engine test fixtures covering various employee types, work patterns, and accrual scenarios.

**Section sources**
- [vitest.config.ts](file://apps/hr-suite/vitest.config.ts)
- [package.json](file://apps/hr-suite/package.json)

## Dependency Analysis
Testing dependencies are managed through the app's package.json and Vitest configuration:
- Vitest provides the test runner and assertions.
- React Testing Library can be used for component rendering and interaction tests.
- Optional E2E tools (e.g., Playwright) should be added if not already present.
- **Updated**: Enhanced dependency management for leave engine testing utilities and mock strategies.

```mermaid
graph TB
Pkg["package.json<br/>scripts & deps"]
Vit["vitest.config.ts<br/>config & globals"]
UT["Unit Tests<br/>.test.ts"]
IT["Integration Tests<br/>API route tests"]
E2E["E2E Tests<br/>browser automation"]
LE["Leave Engine Tests<br/>accrual & overtime"]
Pkg --> Vit
Vit --> UT
Vit --> IT
Pkg --> E2E
Vit --> LE
```

**Diagram sources**
- [package.json](file://apps/hr-suite/package.json)
- [vitest.config.ts](file://apps/hr-suite/vitest.config.ts)

**Section sources**
- [package.json](file://apps/hr-suite/package.json)
- [vitest.config.ts](file://apps/hr-suite/vitest.config.ts)

## Performance Considerations
- Keep unit tests fast and deterministic; avoid heavy setup or real I/O.
- Parallelize independent test suites; leverage Vitest's concurrency.
- Profile slow integration tests; mock expensive operations.
- For E2E, minimize flakiness by stabilizing selectors and avoiding arbitrary waits.
- **Updated**: Optimize leave engine tests by caching complex accrual calculations and using efficient test data generation.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Flaky tests:
  - Stabilize timers and network calls; use controlled clocks and interceptors.
  - Add retries only when necessary; prefer deterministic conditions.
- Environment mismatches:
  - Ensure consistent Node versions and environment variables across local and CI.
- Mock leakage:
  - Reset mocks between tests; isolate global state.
- Slow test runs:
  - Split suites by feature; run critical paths first.
- **Updated**: Leave engine test issues:
  - Time-dependent accrual calculations require careful date mocking.
  - Complex business rule validation may need simplified test scenarios.
  - Database transactions for leave engine operations require proper cleanup.

[No sources needed since this section provides general guidance]

## Conclusion
LiquidHR's testing strategy leverages Vitest for unit and integration tests colocated with source code, ensuring clarity and maintainability. The recent expansion of test coverage for the leave engine functionality, including comprehensive accrual configuration and overtime management testing, demonstrates the team's commitment to robust business logic validation. By extending coverage to E2E scenarios, robust mocking, and disciplined test data management, the team can confidently deliver complex HR workflows while maintaining performance and reliability. Adopting the practices outlined here will strengthen regression safety, accelerate feedback loops, and support scalable growth.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Continuous Integration Setup
- Recommended steps:
  - Install dependencies and cache node_modules.
  - Run linting and type checks.
  - Execute unit tests with parallelization.
  - Run integration tests with mocked services.
  - **Updated**: Include leave engine test suites with specialized fixtures and mocks.
  - Trigger E2E suite against a staging-like environment.
  - Upload coverage reports and artifacts.

[No sources needed since this section provides general guidance]

### Accessibility and Browser Compatibility Testing
- Accessibility:
  - Integrate axe-core or similar tools into unit/E2E tests.
  - Enforce keyboard navigation and screen reader labels.
- Browser Compatibility:
  - Use a matrix of browsers in CI (Chrome, Firefox, Safari).
  - Polyfill or transpile as needed; validate responsive layouts.

[No sources needed since this section provides general guidance]