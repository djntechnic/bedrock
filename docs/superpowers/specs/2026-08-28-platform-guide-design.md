# Design Specification: Bedrock Cross-Repository Platform Guide

**Date:** 2026-08-28  
**Target Document:** `docs/platform_guide.md` in `djntechnic/bedrock`  
**Audience:** Development teams working across Bedrock, CollectIt, and MLBTracker  

---

## 1. Overview & Objectives

Bedrock is a foundational application framework providing standardized, non-business infrastructure (FastAPI app factory, auth & RBAC, grid engine, app config, database migration runner, schema drift detection, media/mail providers, and admin management panels).

This design defines the architecture and full content structure of `docs/platform_guide.md`, a technical handbook owned by Bedrock that establishes:
1. Core platform boundaries and the invariants governing what belongs in Bedrock vs. consumer applications.
2. A formal evaluation rubric and decision tree for routing changes, additions, and enhancements.
3. Mechanical contracts across backend and frontend boundaries, extension points, and build systems.
4. The dual-pin git-tag dependency model and package layout.
5. Local development workflows, release orchestration, and automated cascade issue tracking.
6. Comparative consumer profiles (CollectIt vs. MLBTracker) highlighting specific integration decisions and legacy status.
7. Architectural guardrails, common pitfalls, and CI audit gates.

---

## 2. Document Architecture (`docs/platform_guide.md`)

The handbook is structured into 9 comprehensive sections:

### Section 1: Introduction & The Core Platform Invariant
- **Fundamental Rule:** Bedrock contains **zero business domain logic or vocabulary** (no cards, listings, players, teams, leagues, or pricing).
- **The Table-Ownership Boundary Test:**
  - A backend service/endpoint belongs to the consumer app if and only if it accesses application tables.
  - A service/component belongs in Bedrock if it operates exclusively against platform tables (`app_grid_settings`, `auth_users`, `app_config_settings`) or abstract interfaces.
- **Consumer Independence:** Bedrock must always boot and operate with zero registered domain contributions (all extension points degrade gracefully to safe defaults).

### Section 2: The Repository Ecosystem
- **Upstream Foundation:** `djntechnic/bedrock` (monorepo producing `bedrock-api` and `@djntechnic/bedrock-ui`).
- **Consumer 1:** `djntechnic/MLBTracker` (historical origin of the extracted platform; baseball analytics domain).
- **Consumer 2:** `djntechnic/CollectIt` (collectibles marketplace domain; proves complete decoupling).
- **Extraction Context:** History of the platform extraction and why shared abstractions live in Bedrock to eliminate code duplication across consumers.

### Section 3: Change Evaluation Rubric & Decision Framework
- **Evaluation Decision Tree:** Step-by-step visual routing flowchart from idea $\to$ domain vs platform $\to$ app-local vs Bedrock.
- **The Rule of Two (Anti-Premature Generalization):** Capabilities needed by only one consumer remain app-local. Generalization occurs only when a second consumer requires the capability.
- **Extension Point Selection Matrix:**
  - **Registry (Additive / All Win / Code-Driven):** For *"What else should the platform include?"* (e.g. `register_health_counter`, `register_canonical_tables`, `register_schema_objects`, `navRegistry`).
  - **Provider (Swappable / Exactly One Wins / Config-Driven):** For *"Who performs this capability?"* (e.g. `mail_provider`, `storage_provider`).
  - **Dotted-Path (Early Boot Additive):** When registrations must be loaded prior to standard app imports (e.g. `APP_CATEGORIES`, `ADD_COLUMN_MIGRATIONS`).

### Section 4: Backend Platform Contract & Lifecycle
- **App Factory Pattern:** `bedrock.core.app_factory.create_app()` lifecycle, mounting order, CORS, error handling (`DatabaseQueryError`), rate-limiting.
- **Lifespan Sequence:**
  1. `validate_connection()`
  2. `before_migrations` hooks
  3. `apply_migrations()`
  4. `warn_on_drift()`
  5. `assert_database_healthy()`
  6. `after_bootstrap` hooks
  7. Serving requests
  8. `on_shutdown` hooks
  9. `close_pool()`
- **Hard Invariant:** Extension point registration must be an **eager module-import side-effect** (`import api.domain`), never inside lifespan hooks (since ASGI test transports do not execute lifespan).

### Section 5: Frontend Platform Contract & Build System
- **Barrel Import Rule:** All platform components imported strictly via `@djntechnic/bedrock-ui`; deep path imports are unsupported.
- **Grid Subsystem:** `<DataGrid>` and `useGridConfig` as the single location for `useReactTable`. Custom column/media rendering registered through `cellRegistry` and `rowAccentRegistry`.
- **Design Tokens & Theme Contract:** `styles/tokens.css` defines token contract names; consumers supply values in `index.css`.
- **Build Configurations:**
  - `vite.config.ts`: `esbuild.jsx`, `optimizeDeps.exclude`, `test.server.deps.inline`.
  - `src/index.css`: `@source` directive scanning Bedrock package so Tailwind v4 compiles platform UI classes.

### Section 6: The Dual-Pin Dependency Contract
- **Tag Parity Rule:** `bedrock-api` (in `requirements.txt`) and `@djntechnic/bedrock-ui` (in `frontend/package.json`) must always pin the exact same git release tag (e.g. `v0.8.1`).
- **Repo-Root Manifest Layout:** Why `package.json` sits at Bedrock's root rather than `packages/bedrock-ui/` (npm git URL limitation) and how the `prepare` script builds `dist/` on install.
- **Install Gotchas:** Never use `--ignore-scripts`; forcing lockfile updates when moving tags.

### Section 7: Cross-Repository Development & Release Lifecycle
- **Local Dev Loop:** Editable python install (`pip install -e ../bedrock/packages/bedrock-api`) for immediate feedback in consumer dev server.
- **Release Choreography (Bedrock First):**
  1. Bedrock PR merged to `master`.
  2. `/cut-release <tag>` creates release notes with `## For consumers` adoption section.
  3. Tag pushed with full 40-char SHA.
  4. GitHub Action `.github/workflows/cascade.yml` opens `cascade:pending` issues in CollectIt and MLBTracker.
  5. Consumers run `/bump-bedrock-pin <tag>` in their repos and resolve issues as `boarded` or `declined-with-reason`.

### Section 8: Consumer Profiles & Implementation Nuances
- **Detailed comparison table:** Domain, current season resolver, dashboard pin host (`registerDashboardPinHost`), storage provider customizations, and migration status.
- **Intentional Absences as Features:** Explanation of why CollectIt omits season and dashboard pin registrations to preserve clean behavior.

### Section 9: Guardrails, Common Pitfalls & Audit Gates
- **SQL `%s` Rule:** Using `%s` parameter syntax across all SQLite queries.
- **Schema Drift Protection:** Union catalog verification between Bedrock and app schema.
- **CI Audit Gates:** Overview of `audit_bedrock_pins.py`, `audit_s1_duplicates.py`, `audit_design_tokens.py`, and `audit_api_docs.py`.

---

## 3. Implementation Steps

1. Create `docs/platform_guide.md` containing the exhaustive handbook following this specification.
2. Update Bedrock's `CLAUDE.md` and `README.md` to reference `docs/platform_guide.md`.
3. Verify all code snippets, module paths, table references, and markdown links.
