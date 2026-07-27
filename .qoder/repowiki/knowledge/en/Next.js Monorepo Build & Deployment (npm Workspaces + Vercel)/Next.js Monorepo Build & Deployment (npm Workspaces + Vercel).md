---
kind: build_system
name: Next.js Monorepo Build & Deployment (npm Workspaces + Vercel)
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - apps/hr-suite/package.json
    - vercel.json
    - apps/hr-suite/next.config.ts
    - apps/hr-suite/vitest.config.ts
    - packages/db/package.json
---

The project uses an npm workspaces monorepo to build and deploy a single Next.js application (`apps/hr-suite`) alongside a shared TypeScript types package (`packages/db`). There is no Dockerfile, Makefile, or CI pipeline checked into the repository; deployment targets Vercel via `vercel.json`.

**Build toolchain**
- **Package manager**: npm workspaces (`workspaces: ["apps/*", "packages/*"]`). Root scripts delegate to workspace members using `-w` / `--workspace` flags.
- **Application builder**: Next.js (`next build`), configured in `apps/hr-suite/next.config.ts` with Turbopack enabled for development and `transpilePackages` set so the local `@scope/db` package is compiled during the build.
- **Testing**: Vitest (`vitest run`) configured per-app in `apps/hr-suite/vitest.config.ts` with `tsconfigPaths` resolution and a Node test environment.
- **Linting**: ESLint via `eslint .` in the app workspace.
- **Type checking**: `tsc --noEmit` per workspace.
- **Database migrations**: Supabase CLI (`supabase db push`) invoked through the `migrate` script.

**Workspace layout**
- Root `package.json` defines top-level scripts (`dev`, `build`, `lint`, `test`, `type-check`, `migrate`) that forward to workspaces. Only `@liquid-hr/hr-suite` implements these commands; `packages/db` is a private types-only package exported as `@scope/db`.
- The app depends on `@scope/db` at version `0.1.0` and declares all runtime/dev dependencies inline.

**Deployment**
- `vercel.json` declares the project as a Next.js app, sets the install/build commands to operate on the `@liquid-hr/hr-suite` workspace, and outputs the `.next` directory. Regions are pinned to `cdg1`.
- No containerization or multi-environment CI configuration is present in the repository; Vercel handles build and deployment.

**Conventions observed**
- Each workspace owns its own `package.json`, `next.config.ts` / `vitest.config.ts`, and lint/type scripts — there is no shared build script beyond the root forwarding layer.
- Shared code is kept minimal and typed-only (`packages/db/types.ts`), consumed via `transpilePackages` rather than published to a registry.
- Database schema lives under `apps/hr-suite/supabase/migrations/` and is pushed with the Supabase CLI; tests live alongside SQL files in `apps/hr-suite/supabase/tests/`.