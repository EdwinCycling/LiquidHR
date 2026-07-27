---
kind: error_handling
name: Error Handling in Liquid HR (Next.js + Supabase)
category: error_handling
scope:
    - '**'
source_files:
    - apps/hr-suite/lib/auth/permissions.ts
    - apps/hr-suite/lib/context/server-context.ts
    - apps/hr-suite/lib/context/administration-context.ts
    - apps/hr-suite/lib/context/context-response.ts
    - apps/hr-suite/lib/address/address-suggestions.ts
    - apps/hr-suite/lib/auth/invitation-rules.ts
    - apps/hr-suite/messages/en/errors.json
    - apps/hr-suite/app/api/address-suggestions/route.ts
    - apps/hr-suite/app/api/context/administration/route.ts
---

## System Overview

Liquid HR uses a layered error-handling approach built around **custom Error subclasses**, **per-route try/catch blocks**, and a centralized `permissionErrorResponse` helper that converts domain-specific errors into standardized JSON responses. Errors flow from business logic through API routes to the client via consistent `{ error: string }` payloads with appropriate HTTP status codes.

## Core Error Types

The codebase defines several custom Error classes, each carrying an HTTP status:
- `AuthenticationError` (401) — thrown when a user is not logged in (`lib/auth/permissions.ts`)
- `AuthorizationError` (403) — thrown when a user lacks required permissions (`lib/auth/permissions.ts`)
- `ContextAuthenticationError` (401) — authentication failure during context resolution (`lib/context/server-context.ts`)
- `ContextAccessError` (403) — tenant/administration access denied (`lib/context/administration-context.ts`)
- `ContextSelectionError` (400|403) — invalid or unauthorized administration selection (`lib/context/context-response.ts`)
- `AddressProviderError` — external address provider failure (`lib/address/address-suggestions.ts`)
- `InvitationError` — invitation lifecycle errors with typed codes and status (`lib/auth/invitation-rules.ts`)

These classes extend `Error` and attach a `status` property so downstream handlers can map them directly to HTTP responses.

## Centralized Permission & Context Error Mapping

`lib/auth/permissions.ts` exports `permissionErrorResponse(error)` which recognizes `AuthenticationError`, `AuthorizationError`, `ContextAuthenticationError`, and `ContextAccessError`, returning a `NextResponse.json({ error }, { status })`. Every API route calls this helper in its catch block before falling back to a generic 5xx response.

## Route-Level Error Handling Pattern

Each Next.js API route follows a consistent shape:
```ts
try {
  await requirePermission('employee:read')
  // ... business logic
} catch (error) {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  // domain-specific mapping (e.g. AddressProviderError → 503)
  return NextResponse.json({ error: 'ADDRESS_SEARCH_UNAVAILABLE' }, { status: 503 })
}
```

Routes use `requirePermission()` to short-circuit authorization early; validation failures return explicit error codes like `ADDRESS_SEARCH_INPUT_INVALID` (400). External service failures are mapped to stable 503 codes rather than leaking raw messages.

## Domain-Specific Error Codes

Business logic throws typed errors with machine-readable codes:
- Dashboard operations throw `DASHBOARD_LAYOUT_INVALID` (400), `DASHBOARD_LAST_DELETE_FORBIDDEN` (409), or `DASHBOARD_OPERATION_FAILED` (500)
- Hera metadata validation throws `HERA_METADATA_INVALID`
- Invitation flow uses `InvitationError` with codes like `INVITATION_ALREADY_PENDING` (409), `INVITATION_DELIVERY_FAILED` (502)

These codes appear both in catch blocks and in i18n message files under `messages/en/errors.json` (`generic`, `unauthorized`, `configuration`, `notFound`).

## Validation Strategy

Input validation is performed with Zod schemas (e.g. `administrationSelectionSchema`) and throws `ContextSelectionError` with a human-readable Dutch message plus the correct HTTP status. This keeps validation errors separate from authorization and infrastructure errors.

## Client-Facing Error Presentation

On the frontend, components consume the `{ error }` field from API responses and display localized messages via the i18n system. There is no global error boundary or toast library observed in the scanned routes; error presentation appears to be handled per-component based on the returned error code.

## Key Files

- `apps/hr-suite/lib/auth/permissions.ts` — core auth/authorization error types and `permissionErrorResponse`
- `apps/hr-suite/lib/context/server-context.ts` — `ContextAuthenticationError`
- `apps/hr-suite/lib/context/administration-context.ts` — `ContextAccessError`
- `apps/hr-suite/lib/context/context-response.ts` — `ContextSelectionError` + Zod validation
- `apps/hr-suite/lib/address/address-suggestions.ts` — `AddressProviderError`
- `apps/hr-suite/lib/auth/invitation-rules.ts` — `InvitationError` with typed codes
- `apps/hr-suite/messages/en/errors.json` — i18n error messages
- `apps/hr-suite/app/api/address-suggestions/route.ts` — example route error handling pattern
- `apps/hr-suite/app/api/context/administration/route.ts` — context selection error handling