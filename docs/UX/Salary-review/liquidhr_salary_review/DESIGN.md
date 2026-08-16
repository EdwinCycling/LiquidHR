---
name: LiquidHR Salary Review
colors:
  surface: '#faf8ff'
  surface-dim: '#d9d9e4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fd'
  surface-container: '#ededf8'
  surface-container-high: '#e7e7f2'
  surface-container-highest: '#e1e2ec'
  on-surface: '#191b23'
  on-surface-variant: '#434654'
  inverse-surface: '#2e3038'
  inverse-on-surface: '#f0f0fb'
  outline: '#737685'
  outline-variant: '#c3c6d6'
  surface-tint: '#0c56d0'
  primary: '#003d9b'
  on-primary: '#ffffff'
  primary-container: '#0052cc'
  on-primary-container: '#c4d2ff'
  inverse-primary: '#b2c5ff'
  secondary: '#5c5f60'
  on-secondary: '#ffffff'
  secondary-container: '#dee0e2'
  on-secondary-container: '#606365'
  tertiary: '#7b2600'
  on-tertiary: '#ffffff'
  tertiary-container: '#a33500'
  on-tertiary-container: '#ffc6b2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001848'
  on-primary-fixed-variant: '#0040a2'
  secondary-fixed: '#e1e2e4'
  secondary-fixed-dim: '#c5c6c8'
  on-secondary-fixed: '#191c1e'
  on-secondary-fixed-variant: '#444749'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59b'
  on-tertiary-fixed: '#380d00'
  on-tertiary-fixed-variant: '#812800'
  background: '#faf8ff'
  on-background: '#191b23'
  surface-variant: '#e1e2ec'
  status-draft: '#6B778C'
  status-preparing: '#0052CC'
  status-open: '#00875A'
  status-finalized: '#172B4D'
  status-error: '#DE350B'
  status-warning: '#FFAB00'
  budget-meter-track: '#EBECF0'
  budget-meter-fill: '#36B37E'
  budget-meter-overage: '#DE350B'
typography:
  headline-xl:
    fontFamily: Work Sans
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
  headline-lg:
    fontFamily: Work Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Work Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Work Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Work Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  data-mono:
    fontFamily: jetbrainsMono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
  label-caps:
    fontFamily: Work Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Work Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  desktop-margin: 2rem
  mobile-margin: 1rem
  gutter: 1.5rem
  row-padding-dense: 0.5rem
  row-padding-standard: 1rem
---

## Brand & Style
The design system for the salary review module is built upon a foundation of **Professionalism, Rigidity, and Financial Integrity**. It is an authoritative tool designed for high-stakes HR decision-making where accuracy and auditability are paramount. The aesthetic follows a **Corporate / Modern** approach, seamlessly integrating with the existing LiquidHR/Exact ecosystem while providing the high information density required for salary administration.

The UI evokes a sense of "Human-in-the-loop" control—avoiding "black-box" automation in favor of transparent, data-driven decision layers.

**Key Design Principles:**
- **Immutable Transparency:** Data layers (HR-Start, Manager-Advice, HR-Final) are visually distinct to ensure an audit trail of intent.
- **Role-Based Density:** A "Desktop-Rich" experience for HR Admins (high-density tables, multi-column comparisons) and a "Focused-Mobile" experience for Managers (clarity, large tap targets, guided flows).
- **Subdued Authority:** Use of a professional blue palette and neutral grays to keep the focus on financial figures, avoiding "gamified" or overly vibrant elements.

## Colors
The color palette is functional and semantic, prioritizing clarity of status and financial health over decoration.

- **Primary Blue:** Used for navigation, primary actions (CTAs), and active states. It signals the "official" path.
- **Neutral Grays:** Used for the "Exact shell" background, borders, and secondary text to maintain a calm, professional HR SaaS environment.
- **Semantic Statuses:** 
    - **Draft/Concept:** Neutral gray, signaling an incomplete state.
    - **Open/Submitted:** Success green, signaling progress and completion.
    - **HR Final/Finalized:** Deep navy, signaling authority and immutability.
    - **Alerts:** Red and Amber are used sparingly for budget overages and failed saves.
- **Budget Meters:** A high-contrast combination of a neutral track with a success green fill, transitioning to error red when the discretion limit is exceeded.

## Typography
The system uses **Work Sans** for its professional, grounded, and highly legible characteristics. It strikes a balance between a modern SaaS feel and the seriousness of a financial tool.

- **Data Tables:** Use `body-md` for standard text and `data-mono` (JetBrains Mono) for financial amounts and percentages to ensure digits align vertically and are easily comparable across rows.
- **Authority Values:** The "New Salary" input should be styled with higher weight/size to emphasize it as the business truth.
- **Derived Values:** Percentages and increase amounts use `body-sm` or a lighter weight to show their secondary relationship to the base salary.
- **Status Badges:** Use `label-caps` for high-visibility categorization without occupying excessive vertical space.

## Layout & Spacing
The design system employs a dual-strategy layout:

- **HR Admin (Desktop-Rich):** A fluid-grid layout that prioritizes horizontal real estate. It uses a 12-column system to support wide data tables with 15+ columns. Dense row padding (`0.5rem`) is used in "Worktables" to allow comparison of multiple employees on one screen.
- **Manager (Mobile-Optimized):** A single-column flow for 390 × 844 px. Content is contained in high-contrast cards. Navigation relies on a sticky footer for "Submit" actions and full-height drawers for detail editing.
- **Grid Models:**
    - **Step-based Wizard:** A centered, fixed-width layout (max 1200px) for HR preparation steps.
    - **Dashboard/Review:** Full-bleed fluid layouts for heavy data grids.
- **Spacing Rhythm:** Based on an 8px scale. `1.5rem` (24px) is the standard gap between cards and major layout sections.

## Elevation & Depth
Depth is used to represent the "Layered Decision" model of the salary review process.

- **Base Layer:** Subdued gray background (`secondary_color_hex`) representing the system "shell."
- **Card Layer:** White, flat surfaces with a subtle `1px` border (`#EBECF0`) and a soft, low-opacity shadow (4px blur, 0.05 opacity). This is the primary container for data.
- **Detail Drawers:** These slide in from the right with a higher elevation (16px shadow) and a backdrop dimming effect. Drawers are the primary editing environment for individual employee records.
- **Tonal Tiers:** Used in tables to distinguish between "Reviewable" (white), "Read-Only/Locked" (light gray tint), and "System Managed" (soft border) rows.

## Shapes
Following the LiquidHR/Exact standard, the system uses a **Rounded** shape language (`0.5rem` / 8px).

- **Standard Elements:** Input fields, buttons, and cards use the 8px radius.
- **Status Badges:** Use a fully rounded (pill-shaped) style to distinguish them from interactive buttons.
- **KPI Cards:** Maintain the standard 8px radius but use a thicker `2px` left-border for semantic emphasis (e.g., a green bar for "Submitted").
- **Budget Meters:** Use a pill-shaped track with rounded ends for the progress fill.

## Components
- **Data Tables:**
    - **HR Admin:** Dense, sortable, with sticky "Employee Name" and "Action" columns.
    - **Comparison Cells:** Show "Huidig," "Manager Advice," and "HR Final" in distinct vertical or horizontal groupings within the cell.
- **Budget Meters:** A linear progress bar featuring a "Budget" label on the left and a "Remaining/Overage" label on the right. If overage occurs, the fill changes to `status-error`.
- **Linked Salary Inputs:** A tripartite input group (Percentage, Amount, Final Salary). Changing one instantly recalculates the others.
- **Status Badges:** Standardized tags with text and icons (e.g., a lock icon for `Forced Zero`).
- **Autosave Indicator:** A small, discreet label in the top right or sticky footer showing `Opgeslagen`, `Opslaan...`, or `Fout`.
- **KPI Cards:** Large-format metric displays used in headers to show population counts (Reviewable, Excluded, etc.).
- **Manager Mobile Cards:** Summary cards with a "Tap-to-Edit" affordance, replacing the horizontal row interaction on mobile.