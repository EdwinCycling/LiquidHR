---
kind: dependency_management
name: npm Workspaces Monorepo with Lockfile-Based Dependency Management
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - apps/hr-suite/package.json
    - packages/db/package.json
    - apps/hr-suite/next.config.ts
---

The Liquid HR monorepo uses npm workspaces to manage dependencies across a Next.js application and shared packages. The root `package.json` declares workspaces for `apps/*` and `packages/*`, enabling unified dependency resolution and script execution across the monorepo.

**Package Structure:**
- Root workspace orchestrates shared scripts (`dev`, `build`, `lint`, `test`, `type-check`, `migrate`) that propagate to all workspaces using `--workspaces --if-present`
- `apps/hr-suite` is the main Next.js application (`@liquid-hr/hr-suite`) containing the UI, API routes, and business logic
- `packages/db` (`@scope/db`) is a private package exposing only TypeScript types via `exports` field

**Dependency Resolution Strategy:**
- Uses `package-lock.json` as the lockfile for deterministic builds (confirmed by documentation references)
- Dependencies are declared with flexible version ranges including `latest` tags for core frameworks (Next.js, React, Supabase SDKs) and specific versions for libraries like Zod (^4.4.3), Recharts (^3.9.2), and X/Y Flow (@xyflow/react ^12.11.2)
- Internal workspace packages use exact version pinning (`"@scope/db": "0.1.0"`)

**Workspace Integration:**
- The Next.js app imports internal packages using the `@scope/db` alias
- `next.config.ts` explicitly transpiles the `@scope/db` package via `transpilePackages` configuration
- Turbopack is configured with the correct root path for monorepo awareness

**Development Workflow:**
- Scripts are centralized at the root level but executed per-workspace
- Database migrations use Supabase CLI (`supabase db push`) through npm scripts
- Testing uses Vitest with workspace-aware script execution
- Documentation indicates `package-lock.json` changes should be preserved during automated processes

**Key Constraints:**
- Private monorepo structure with no public registry publishing
- All packages marked as `private: true` preventing accidental publication
- TypeScript strict mode enabled across workspaces for type safety