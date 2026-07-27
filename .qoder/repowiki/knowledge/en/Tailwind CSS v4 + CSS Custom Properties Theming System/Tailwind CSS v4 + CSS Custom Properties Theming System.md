---
kind: frontend_style
name: Tailwind CSS v4 + CSS Custom Properties Theming System
category: frontend_style
scope:
    - '**'
source_files:
    - apps/hr-suite/app/globals.css
    - apps/hr-suite/app/layout.tsx
    - apps/hr-suite/postcss.config.mjs
    - apps/hr-suite/package.json
---

The Liquid HR frontend uses Tailwind CSS v4 (via `@tailwindcss/postcss`) with a design-token-driven theming system built entirely on CSS custom properties. There is no separate `tailwind.config.js` file — configuration is done inline through the `@theme` directive in `globals.css`, and PostCSS is configured to use `@tailwindcss/postcss` as the only plugin.

**Theming architecture:**
- All visual tokens are defined as CSS custom properties under an `@theme inline` block, mapping semantic names (`--color-background`, `--color-primary`, `--color-surface`, etc.) to CSS variables.
- Six complete themes are provided as `[data-theme="..."]` selectors: `liquid-navy` (default), `noordzee`, `bos`, `warm-zand`, `aubergine`, and `nacht` (dark mode). Each theme redefines every token consistently, including sidebar-specific variables (`--color-sidebar*`) and chart palette variables (`--chart-1` through `--chart-5`).
- The active theme is applied server-side by setting `data-theme` on the `<html>` element in `app/layout.tsx`, read from user preferences via `getUserPreferences()`, preventing flash-of-wrong-theme.
- Theme switching is exposed through UI components (`settings-modal.tsx`, `personal-settings-form.tsx`) that optimistically update the DOM before persisting to `user_preferences`.

**Component styling approach:**
- Shared component styles live in `@layer components` within `globals.css`, using Tailwind's `@apply` directive for reusable patterns like `.form-field`, `.button-primary`, `.button-secondary`, `.button-danger`, `.eyebrow`, `.status-chip`, and `.filter-chip`.
- Components rely exclusively on semantic color tokens rather than hardcoded colors, ensuring theme consistency across all screens.
- Global resets and base styles (body font, focus rings, selection colors) are defined directly in `globals.css`.

**Responsive and accessibility:**
- A `prefers-reduced-motion` media query disables animations and transitions for users who prefer reduced motion.
- Focus management uses `:focus-visible` with a consistent outline style tied to the `--focus` token.
- Minimum body width of `20rem` provides a mobile baseline.

**Design system conventions observed:**
- Color usage follows semantic roles: primary/foreground/surface/muted/accent/border/focus for core UI, success/warning/destructive for status messaging, and sidebar-specific tokens for navigation surfaces.
- Chart colors are isolated to the `--chart-*` variable set, enabling per-theme palettes without affecting application UI.
- Border radius tokens (`--radius-sm` through `--radius-2xl`) derive from a single `--radius` base value.
- Glassmorphism effects are used consistently on buttons and panels via `backdrop-filter: blur()` combined with semi-transparent backgrounds.