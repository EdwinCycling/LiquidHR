---
kind: configuration_system
name: Environment Variables and Supabase Configuration
category: configuration_system
scope:
    - '**'
source_files:
    - apps/hr-suite/.env.example
    - apps/hr-suite/.env.local
    - apps/hr-suite/supabase/config.toml
    - apps/hr-suite/lib/supabase/client.ts
    - apps/hr-suite/lib/supabase/server.ts
    - apps/hr-suite/lib/supabase/admin.ts
    - apps/hr-suite/lib/security/pii-crypto.ts
    - apps/hr-suite/lib/security/bsn-fingerprint.ts
    - apps/hr-suite/lib/hera/gemini.ts
    - vercel.json
---

This repository uses a straightforward environment-variable-based configuration system centered around Next.js `process.env` and Supabase's local development config. There is no centralized configuration loader or schema validation for runtime settings; instead, each module reads the specific env vars it needs directly from `process.env`, with validation performed at the point of use.

**Configuration sources and hierarchy**
- `.env.example` documents all required variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`, `BSN_HASH_KEY`, `EMPLOYEE_PII_ENCRYPTION_KEY`, `GEMINI_KEY`, and `GEMINI_MODEL`.
- `.env.local` holds actual secrets for local development and is gitignored (not committed).
- Vercel deployment (`vercel.json`) targets the `@liquid-hr/hr-suite` workspace and expects these same env vars to be configured in the Vercel project settings.
- Supabase local development is configured via `apps/hr-suite/supabase/config.toml`, which defines API, database (Postgres 17), auth, storage, realtime, studio, email, SMS, external OAuth providers, edge runtime, analytics, and experimental features. Secrets within this file are injected via `env(...)` substitution.

**How env vars are consumed**
- Supabase clients are created in `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server/SSR) using `@supabase/ssr`, reading `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The server client also binds cookies via Next.js `cookies()`.
- Admin Supabase access reads `SUPABASE_SECRET_KEY` from `lib/supabase/admin.ts` and throws if missing.
- PII encryption uses `EMPLOYEE_PII_ENCRYPTION_KEY` (base64-encoded 32-byte AES-256-GCM key) via `lib/security/pii-crypto.ts`, with explicit length/format validation.
- BSN hashing uses `BSN_HASH_KEY` (minimum 32 chars) via `lib/security/bsn-fingerprint.ts`, validated before HMAC-SHA256 usage.
- Gemini AI integration reads `GEMINI_KEY` and `GEMINI_MODEL` from `lib/hera/gemini.ts`, with defaults overridable per call.
- App URL fallback logic uses `NEXT_PUBLIC_APP_URL` in invitation and login flows.

**Supabase config structure**
The `config.toml` is comprehensive, enabling:
- API on port 54321 with `public` and `graphql_public` schemas exposed
- Database on port 54322 (Postgres 17) with migrations enabled and seed files
- Auth with JWT expiry 3600s, refresh token rotation, signup enabled, rate limiting
- Storage with S3 protocol support and vector buckets
- Realtime and Studio interfaces
- Edge Runtime with Deno 2
- Local SMTP for email testing
- External OAuth providers (Apple, etc.) with secret injection via `env(...)`

**Conventions and constraints**
- Public vs secret keys are separated by the `NEXT_PUBLIC_` prefix convention used by Next.js.
- All sensitive keys must be provided at runtime; code explicitly throws descriptive errors when required env vars are missing (e.g., `PII_ENCRYPTION_KEY_MISSING`, `BSN_HASH_KEY_MISSING`, `SUPABASE_SECRET_KEY is niet geconfigureerd`).
- Encryption keys have strict format requirements: base64-encoded 32 bytes for AES-256-GCM, minimum 32 characters for HMAC keys.
- The `.env.local` file contains real production-like credentials and should never be committed — it serves as the authoritative local configuration source.