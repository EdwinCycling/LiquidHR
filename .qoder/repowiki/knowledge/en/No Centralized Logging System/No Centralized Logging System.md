---
kind: logging_system
name: No Centralized Logging System
category: logging_system
scope:
    - '**'
source_files:
    - apps/hr-suite/lib/hera/gemini.ts
    - apps/hr-suite/lib/hera/orchestrator.ts
    - apps/hr-suite/scripts/check-i18n.mjs
---

This repository does not implement a centralized logging system. There is no dedicated logging framework, logger utility module, or structured logging configuration anywhere in the codebase.

The only logging observed is ad-hoc use of Node.js `console` methods:
- `console.error('HERA_PROVIDER_HTTP_ERROR', {...})` in `apps/hr-suite/lib/hera/gemini.ts` for provider HTTP errors
- `console.warn('HERA_TOOL_SELECTION_REJECTED', {...})` in `apps/hr-suite/lib/hera/orchestrator.ts` for tool selection failures
- A single `console.log(...)` in `apps/hr-suite/scripts/check-i18n.mjs` for i18n validation output

No logging packages (pino, winston, bunyan, debug, @sentry, etc.) are declared as dependencies in `package.json`. There is no `lib/logger`, `lib/logging`, or similar shared module. Error handling in API routes uses try/catch with `NextResponse.json` responses rather than log statements. The project relies entirely on built-in console output and Next.js/Vercel runtime logs without any structured logging, log levels, or sinks configured.