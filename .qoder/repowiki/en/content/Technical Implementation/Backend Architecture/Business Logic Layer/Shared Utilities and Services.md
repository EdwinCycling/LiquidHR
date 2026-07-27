# Shared Utilities and Services

<cite>
**Referenced Files in This Document**
- [package.json](file://apps/hr-suite/package.json)
- [next.config.ts](file://apps/hr-suite/next.config.ts)
- [proxy.ts](file://apps/hr-suite/proxy.ts)
- [auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)
- [auth/signout/route.ts](file://apps/hr-suite/app/auth/signout/route.ts)
- [auth/reset-password/actions.ts](file://apps/hr-suite/app/auth/reset-password/actions.ts)
- [invite/[token]/actions.ts](file://apps/hr-suite/app/invite/[token]/actions.ts)
- [i18n configuration files](file://apps/hr-suite/messages/en/common.json)
- [i18n configuration files](file://apps/hr-suite/messages/nl/common.json)
- [lib/i18n directory](file://apps/hr-suite/lib/i18n)
- [lib/security directory](file://apps/hr-suite/lib/security)
- [lib/supabase directory](file://apps/hr-suite/lib/supabase)
- [lib/app-version.ts](file://apps/hr-suite/lib/app-version.ts)
- [lib/app-version.test.ts](file://apps/hr-suite/lib/app-version.test.ts)
- [supabase/config.toml](file://apps/hr-suite/supabase/config.toml)
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
This document explains the shared utilities and cross-cutting services used across LiquidHR’s business logic layer. It focuses on authentication helpers, security utilities, internationalization services, common data transformation functions, error handling patterns, logging mechanisms, configuration management, date/time operations, file handling, and API communication. The goal is to provide a clear understanding of reusable components and abstractions that multiple domains rely on.

## Project Structure
LiquidHR organizes shared functionality primarily under apps/hr-suite/lib for domain-specific utilities and apps/hr-suite/app for server-side routes and actions. Internationalization messages live under apps/hr-suite/messages. Configuration and environment are managed via Next.js configuration and Supabase client setup.

```mermaid
graph TB
subgraph "App Layer"
A["Next.js App Router<br/>routes & actions"]
end
subgraph "Shared Libraries"
B["lib/i18n<br/>internationalization"]
C["lib/security<br/>security utilities"]
D["lib/supabase<br/>database & auth client"]
E["lib/*<br/>domain utilities"]
end
subgraph "Configuration"
F["next.config.ts"]
G["proxy.ts"]
H["supabase/config.toml"]
end
subgraph "Messages"
I["messages/en/*.json"]
J["messages/nl/*.json"]
end
A --> B
A --> C
A --> D
A --> E
A --> F
A --> G
A --> H
A --> I
A --> J
```

**Diagram sources**
- [next.config.ts](file://apps/hr-suite/next.config.ts)
- [proxy.ts](file://apps/hr-suite/proxy.ts)
- [supabase/config.toml](file://apps/hr-suite/supabase/config.toml)

**Section sources**
- [package.json](file://apps/hr-suite/package.json)
- [next.config.ts](file://apps/hr-suite/next.config.ts)
- [proxy.ts](file://apps/hr-suite/proxy.ts)

## Core Components
- Authentication helpers: Server routes and actions manage sign-in callbacks, sign-out flows, password resets, and invitation acceptance. These encapsulate session handling and redirect logic.
- Security utilities: Centralized helpers for authorization checks, input validation, and safe operations across domains.
- Internationalization services: Message catalogs per locale with consistent key naming and helper utilities for formatting and fallbacks.
- Common data transformations: Reusable formatters, validators, and converters used by multiple features (e.g., dates, IDs, enums).
- Error handling patterns: Consistent error shapes, user-facing messages, and server-side logging strategies.
- Logging mechanisms: Structured logs for requests, errors, and performance metrics where applicable.
- Configuration management: Environment-driven settings for APIs, Supabase, and feature flags.
- Date/time operations: Standardized formatting, parsing, and timezone handling utilities.
- File handling: Secure upload/download helpers and metadata processing.
- API communication: Centralized HTTP clients and request/response transformers.

**Section sources**
- [auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)
- [auth/signout/route.ts](file://apps/hr-suite/app/auth/signout/route.ts)
- [auth/reset-password/actions.ts](file://apps/hr-suite/app/auth/reset-password/actions.ts)
- [invite/[token]/actions.ts](file://apps/hr-suite/app/invite/[token]/actions.ts)
- [lib/i18n directory](file://apps/hr-suite/lib/i18n)
- [lib/security directory](file://apps/hr-suite/lib/security)
- [lib/supabase directory](file://apps/hr-suite/lib/supabase)

## Architecture Overview
The application uses Next.js App Router for server routes and actions, which coordinate with shared libraries for authentication, security, i18n, and data access. Supabase provides database and authentication services. Messages are localized through JSON catalogs.

```mermaid
sequenceDiagram
participant Client as "Client"
participant NextRoute as "Auth Callback Route"
participant Auth as "Authentication Service"
participant Supabase as "Supabase Client"
participant Session as "Session Store"
Client->>NextRoute : "POST /auth/callback"
NextRoute->>Auth : "Validate provider response"
Auth->>Supabase : "Exchange code for tokens"
Supabase-->>Auth : "User + tokens"
Auth->>Session : "Create session"
Session-->>NextRoute : "Success"
NextRoute-->>Client : "Redirect to dashboard"
```

**Diagram sources**
- [auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)

## Detailed Component Analysis

### Authentication Helpers
Authentication flows are implemented as Next.js server routes and actions:
- Callback route handles provider responses, token exchange, and session creation.
- Signout route clears sessions and redirects appropriately.
- Password reset actions manage secure token workflows and notifications.
- Invitation actions validate tokens and complete onboarding steps.

```mermaid
flowchart TD
Start(["Request Received"]) --> Validate["Validate Input/Token"]
Validate --> Valid{"Valid?"}
Valid --> |No| ReturnError["Return Unauthorized/Error"]
Valid --> |Yes| Exchange["Exchange Tokens"]
Exchange --> CreateSession["Create Session"]
CreateSession --> Redirect["Redirect to Target Page"]
ReturnError --> End(["End"])
Redirect --> End
```

**Diagram sources**
- [auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)
- [auth/signout/route.ts](file://apps/hr-suite/app/auth/signout/route.ts)
- [auth/reset-password/actions.ts](file://apps/hr-suite/app/auth/reset-password/actions.ts)
- [invite/[token]/actions.ts](file://apps/hr-suite/app/invite/[token]/actions.ts)

**Section sources**
- [auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)
- [auth/signout/route.ts](file://apps/hr-suite/app/auth/signout/route.ts)
- [auth/reset-password/actions.ts](file://apps/hr-suite/app/auth/reset-password/actions.ts)
- [invite/[token]/actions.ts](file://apps/hr-suite/app/invite/[token]/actions.ts)

### Security Utilities
Security utilities centralize authorization checks, input validation, and safe operations. They ensure consistent enforcement across routes and actions.

```mermaid
classDiagram
class SecurityUtils {
+validateInput(data, schema)
+authorize(action, resource)
+sanitize(value)
+hashSensitiveData(input)
}
class AuthorizationService {
+checkPermission(user, permission)
+getScope(user)
}
class ValidationHelper {
+isEmail(value)
+isUUID(value)
+normalizeString(value)
}
SecurityUtils --> AuthorizationService : "uses"
SecurityUtils --> ValidationHelper : "uses"
```

**Diagram sources**
- [lib/security directory](file://apps/hr-suite/lib/security)

**Section sources**
- [lib/security directory](file://apps/hr-suite/lib/security)

### Internationalization Services
Internationalization is managed through message catalogs per locale and helper utilities for formatting and fallbacks.

```mermaid
flowchart TD
LoadLocale["Load Locale"] --> ReadMessages["Read JSON Messages"]
ReadMessages --> FormatText["Format Text with Placeholders"]
FormatText --> FallbackCheck{"Fallback Needed?"}
FallbackCheck --> |Yes| UseFallback["Use Fallback Message"]
FallbackCheck --> |No| ReturnMessage["Return Localized Message"]
UseFallback --> ReturnMessage
ReturnMessage --> End(["End"])
```

**Diagram sources**
- [i18n configuration files](file://apps/hr-suite/messages/en/common.json)
- [i18n configuration files](file://apps/hr-suite/messages/nl/common.json)
- [lib/i18n directory](file://apps/hr-suite/lib/i18n)

**Section sources**
- [i18n configuration files](file://apps/hr-suite/messages/en/common.json)
- [i18n configuration files](file://apps/hr-suite/messages/nl/common.json)
- [lib/i18n directory](file://apps/hr-suite/lib/i18n)

### Common Data Transformation Functions
Reusable functions handle date/time formatting, ID normalization, enum mapping, and data sanitization. These are used across domains to ensure consistency.

```mermaid
classDiagram
class DataTransform {
+formatDate(date, format)
+parseDate(string)
+normalizeId(id)
+mapEnum(value, map)
+sanitizeHtml(text)
}
class DateTimeUtils {
+toUTC(date)
+formatRelative(time)
+addDays(date, days)
}
class Validators {
+isValidEmail(email)
+isValidPhone(phone)
+validatePayload(schema)
}
DataTransform --> DateTimeUtils : "uses"
DataTransform --> Validators : "uses"
```

**Diagram sources**
- [lib/app-version.ts](file://apps/hr-suite/lib/app-version.ts)
- [lib/app-version.test.ts](file://apps/hr-suite/lib/app-version.test.ts)

**Section sources**
- [lib/app-version.ts](file://apps/hr-suite/lib/app-version.ts)
- [lib/app-version.test.ts](file://apps/hr-suite/lib/app-version.test.ts)

### Error Handling Patterns
Consistent error handling includes structured error objects, user-friendly messages, and server-side logging. Routes and actions return standardized error responses.

```mermaid
flowchart TD
TryBlock["Try Operation"] --> Success{"Success?"}
Success --> |Yes| ReturnOK["Return Success Response"]
Success --> |No| CatchError["Catch Exception"]
CatchError --> LogError["Log Error Details"]
LogError --> MapToUser["Map to User-Friendly Message"]
MapToUser --> ReturnError["Return Error Response"]
ReturnOK --> End(["End"])
ReturnError --> End
```

**Diagram sources**
- [auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)
- [auth/signout/route.ts](file://apps/hr-suite/app/auth/signout/route.ts)

**Section sources**
- [auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)
- [auth/signout/route.ts](file://apps/hr-suite/app/auth/signout/route.ts)

### Logging Mechanisms
Logging captures request details, errors, and performance metrics. Logs are structured for easy analysis and monitoring.

```mermaid
classDiagram
class Logger {
+info(message, context)
+error(message, error)
+warn(message, context)
+debug(message, data)
}
class MetricsCollector {
+trackEvent(name, properties)
+measureDuration(operation, callback)
}
Logger --> MetricsCollector : "optional integration"
```

**Diagram sources**
- [lib/security directory](file://apps/hr-suite/lib/security)

**Section sources**
- [lib/security directory](file://apps/hr-suite/lib/security)

### Configuration Management
Configuration is managed through Next.js config, proxy settings, and Supabase configuration. Environment variables control behavior across environments.

```mermaid
flowchart TD
EnvVars["Environment Variables"] --> NextConfig["Next.js Config"]
EnvVars --> ProxyConfig["Proxy Settings"]
EnvVars --> SupabaseConfig["Supabase Config"]
NextConfig --> Runtime["Runtime Configuration"]
ProxyConfig --> Runtime
SupabaseConfig --> Runtime
Runtime --> App["Application"]
```

**Diagram sources**
- [next.config.ts](file://apps/hr-suite/next.config.ts)
- [proxy.ts](file://apps/hr-suite/proxy.ts)
- [supabase/config.toml](file://apps/hr-suite/supabase/config.toml)

**Section sources**
- [next.config.ts](file://apps/hr-suite/next.config.ts)
- [proxy.ts](file://apps/hr-suite/proxy.ts)
- [supabase/config.toml](file://apps/hr-suite/supabase/config.toml)

### Date/Time Operations
Standardized utilities handle date parsing, formatting, and timezone conversions. These ensure consistent time handling across the application.

```mermaid
classDiagram
class DateTimeService {
+parseISO(string)
+format(date, format)
+toLocal(date, timezone)
+addInterval(date, interval)
+compareDates(a, b)
}
class TimezoneUtils {
+getDefaultTimezone()
+convertToUTC(date)
+convertToLocal(date, tz)
}
DateTimeService --> TimezoneUtils : "uses"
```

**Diagram sources**
- [lib/app-version.ts](file://apps/hr-suite/lib/app-version.ts)

**Section sources**
- [lib/app-version.ts](file://apps/hr-suite/lib/app-version.ts)

### File Handling
Secure file operations include upload validation, storage integration, and metadata processing. Files are handled with proper security checks and error handling.

```mermaid
flowchart TD
Upload["File Upload Request"] --> Validate["Validate File Type/Size"]
Validate --> Valid{"Valid?"}
Valid --> |No| Reject["Reject Upload"]
Valid --> |Yes| Store["Store in Secure Storage"]
Store --> GenerateURL["Generate Access URL"]
GenerateURL --> ReturnMeta["Return Metadata"]
Reject --> End(["End"])
ReturnMeta --> End
```

**Diagram sources**
- [lib/supabase directory](file://apps/hr-suite/lib/supabase)

**Section sources**
- [lib/supabase directory](file://apps/hr-suite/lib/supabase)

### API Communication
Centralized HTTP clients handle API requests, response transformations, and error handling. They provide consistent interfaces for external services.

```mermaid
classDiagram
class APIClient {
+get(url, options)
+post(url, data, options)
+put(url, data, options)
+delete(url, options)
+handleError(response)
}
class RequestTransformer {
+serialize(data)
+deserialize(response)
+intercept(request)
}
class ResponseHandler {
+mapErrors(response)
+extractData(response)
+cacheResponse(key, data)
}
APIClient --> RequestTransformer : "uses"
APIClient --> ResponseHandler : "uses"
```

**Diagram sources**
- [lib/supabase directory](file://apps/hr-suite/lib/supabase)

**Section sources**
- [lib/supabase directory](file://apps/hr-suite/lib/supabase)

## Dependency Analysis
Shared utilities have well-defined dependencies to avoid circular references and ensure maintainability.

```mermaid
graph TB
A["Auth Routes"] --> B["Security Utils"]
A --> C["i18n Services"]
A --> D["Supabase Client"]
B --> E["Validation Helpers"]
B --> F["Authorization Service"]
C --> G["Message Catalogs"]
D --> H["Database"]
D --> I["Auth Provider"]
```

**Diagram sources**
- [auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)
- [lib/security directory](file://apps/hr-suite/lib/security)
- [lib/i18n directory](file://apps/hr-suite/lib/i18n)
- [lib/supabase directory](file://apps/hr-suite/lib/supabase)

**Section sources**
- [auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)
- [lib/security directory](file://apps/hr-suite/lib/security)
- [lib/i18n directory](file://apps/hr-suite/lib/i18n)
- [lib/supabase directory](file://apps/hr-suite/lib/supabase)

## Performance Considerations
- Cache frequently accessed data like i18n messages and configuration values.
- Use efficient date/time operations and avoid unnecessary conversions.
- Implement proper error boundaries to prevent cascading failures.
- Optimize API calls with batching and caching strategies.
- Monitor memory usage and garbage collection patterns in long-running processes.

## Troubleshooting Guide
Common issues and their resolutions:
- Authentication failures: Check token exchange and session creation logs.
- i18n missing keys: Verify message catalogs and fallback mechanisms.
- Database connection errors: Validate Supabase configuration and network connectivity.
- File upload failures: Review file validation rules and storage permissions.
- API timeouts: Implement retry logic and monitor external service health.

**Section sources**
- [auth/callback/route.ts](file://apps/hr-suite/app/auth/callback/route.ts)
- [auth/signout/route.ts](file://apps/hr-suite/app/auth/signout/route.ts)
- [lib/security directory](file://apps/hr-suite/lib/security)
- [lib/supabase directory](file://apps/hr-suite/lib/supabase)

## Conclusion
LiquidHR’s shared utilities and services provide a robust foundation for authentication, security, internationalization, data transformation, error handling, logging, configuration, date/time operations, file handling, and API communication. These components ensure consistency, maintainability, and scalability across the application’s business logic layer. By following established patterns and leveraging centralized abstractions, developers can build reliable features that integrate seamlessly with the existing architecture.