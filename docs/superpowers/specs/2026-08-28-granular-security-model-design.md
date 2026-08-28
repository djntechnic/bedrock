# Design Specification: Granular Security Model & Admin Management Hub

- **Date:** 2026-08-28
- **Status:** Approved for Implementation
- **Target Systems:** `djntechnic/bedrock` (Platform), `djntechnic/MLBTracker`, `djntechnic/CollectIt`

---

## 1. Executive Summary & Core Requirements

This specification establishes a robust, granular authorization engine, dynamic navigation configuration system, and administrative management hub across the Bedrock platform and its downstream consumers (`MLBTracker` and `CollectIt`).

### Key Capabilities
1. **Dual-Axis Capability Matrix**:
   - **Modules (`auth_modules`)**: Define functional domain boundaries and licensing feature sets (e.g. `dashboard`, `inventory`, `leaderboards`, `listings`, `admin`, `health`).
   - **Roles (`auth_roles`)**: Define user privilege tiers (`anon`, `viewer`, `member`, `admin`, plus custom dynamic roles).
   - **Granular Actions**: Four fundamental action flags per module: `can_view`, `can_update`, `can_delete`, and `can_execute`.
2. **Tri-State User Overrides**:
   - Per-user overrides in `auth_user_module_overrides` supporting `NULL` (inherit from role), `1` (force grant), and `0` (force deny) per action flag.
3. **Dynamic Role Support**:
   - System allows creation of arbitrary roles (e.g. `collector`, `analyst`, `seller`) purely through database configuration with zero Python code changes required.
4. **Dynamic Navigation & Screen-Level Protection**:
   - Navigation tree supports dynamic administrative customization (custom ordering, label overrides, icon overrides, tooltip overrides) stored in `app_nav_item_settings`.
   - Security layers strictly on top: items for unauthorized pages are completely hidden from navigation menus and command palettes when a user lacks the required permission.
   - Unauthorized direct URL navigation renders an in-place `<PermissionDenied>` visual guard without leaking data.
5. **Full Admin Security & Navigation Management Hub**:
   - Interactive Role $\times$ Module Permissions Matrix editor.
   - User account role assignments and granular user overrides drawer.
   - Dynamic Menu Navigation Editor panel.
   - Module registry manager.
   - Read-only **Compiled User Access Profile Inspector** showing the complete computed permission tree per user.
   - Security activity log with IP address tracking for both authenticated and anonymous attempts.
6. **Module & Screen Catalog Deliverable Gate**:
   - Includes a preliminary first-pass catalog of all modules, screens, and functions for Bedrock, MLBTracker, and CollectIt, requiring explicit human partner approval before downstream implementation.

---

## 2. Architecture & Data Model

### 2.1 Entity Relationship Diagram

```mermaid
erDiagram
    auth_users ||--o{ auth_user_roles : "assigned"
    auth_roles ||--o{ auth_user_roles : "holds"
    auth_roles ||--o{ auth_role_modules : "defines permissions"
    auth_modules ||--o{ auth_role_modules : "granted to role"
    auth_users ||--o{ auth_user_module_overrides : "has overrides"
    auth_modules ||--o{ auth_user_module_overrides : "overridden for user"
    auth_users ||--o{ auth_sessions : "has"
    auth_users ||--o{ auth_activity_log : "audited"

    app_nav_item_settings {
        int nav_setting_id PK
        string nav_key UK "unique route path or identifier"
        string parent_key "null for top-level"
        int sort_order
        string label_override
        string icon_override
        string tooltip_override
        int is_hidden_override "1 = force hidden"
        string created_at
        string modified_at
    }

    auth_roles {
        int role_id PK
        string slug UK "anon | viewer | member | admin | custom"
        string label
        string description
        string created_at
    }

    auth_modules {
        int module_id PK
        string slug UK "inventory | dashboard | admin | listings | etc"
        string label
        string description
        int sort_order
        int is_core "1 = platform protected"
        string created_at
    }

    auth_role_modules {
        int role_id PK, FK
        int module_id PK, FK
        int can_view "1 or 0 (default 1)"
        int can_update "1 or 0 (default 0)"
        int can_delete "1 or 0 (default 0)"
        int can_execute "1 or 0 (default 0)"
        string created_at
    }

    auth_user_module_overrides {
        int user_id PK, FK
        int module_id PK, FK
        int can_view "NULL=inherit, 1=grant, 0=deny"
        int can_update "NULL=inherit, 1=grant, 0=deny"
        int can_delete "NULL=inherit, 1=grant, 0=deny"
        int can_execute "NULL=inherit, 1=grant, 0=deny"
        int granted_by FK "admin user_id"
        string granted_at
    }
```

### 2.2 Schema Definitions

```sql
-- Migration 005_granular_security_and_nav_model.sql

-- 1. Ensure auth_roles supports description column
ALTER TABLE auth_roles ADD COLUMN description TEXT;

-- 2. Granular capability matrix for roles
CREATE TABLE IF NOT EXISTS auth_role_modules_new (
    role_id     INTEGER NOT NULL REFERENCES auth_roles(role_id) ON DELETE CASCADE,
    module_id   INTEGER NOT NULL REFERENCES auth_modules(module_id) ON DELETE CASCADE,
    can_view    INTEGER NOT NULL DEFAULT 1,
    can_update  INTEGER NOT NULL DEFAULT 0,
    can_delete  INTEGER NOT NULL DEFAULT 0,
    can_execute INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (role_id, module_id)
);

INSERT INTO auth_role_modules_new (role_id, module_id, can_view, can_update, can_delete, can_execute)
SELECT role_id, module_id, 1, 0, 0, 0 FROM auth_role_modules;

DROP TABLE auth_role_modules;
ALTER TABLE auth_role_modules_new RENAME TO auth_role_modules;

-- 3. Granular tri-state user overrides
CREATE TABLE IF NOT EXISTS auth_user_module_overrides_new (
    user_id     INTEGER NOT NULL REFERENCES auth_users(user_id) ON DELETE CASCADE,
    module_id   INTEGER NOT NULL REFERENCES auth_modules(module_id) ON DELETE CASCADE,
    can_view    INTEGER,  -- NULL=inherit, 1=grant, 0=deny
    can_update  INTEGER,
    can_delete  INTEGER,
    can_execute INTEGER,
    granted_by  INTEGER REFERENCES auth_users(user_id),
    granted_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, module_id)
);

INSERT INTO auth_user_module_overrides_new (user_id, module_id, can_view, granted_by, granted_at)
SELECT user_id, module_id, granted, granted_by, granted_at FROM auth_user_module_overrides;

DROP TABLE auth_user_module_overrides;
ALTER TABLE auth_user_module_overrides_new RENAME TO auth_user_module_overrides;

-- 4. Dynamic Menu Navigation Customizations
CREATE TABLE IF NOT EXISTS app_nav_item_settings (
    nav_setting_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    nav_key             TEXT    NOT NULL UNIQUE,  -- route path e.g. '/inventory'
    parent_key          TEXT,                     -- parent route path if child
    sort_order          INTEGER NOT NULL DEFAULT 0,
    label_override      TEXT,
    icon_override       TEXT,                     -- Lucide icon name string
    tooltip_override    TEXT,
    is_hidden_override  INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    modified_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

---

## 3. Backend Implementation (`bedrock-api`)

### 3.1 Permission Resolution Logic (`security_service.py`)

A user's effective permissions map is computed as follows:
```python
def resolve_user_permissions(user_id: int | None, *, is_superuser: bool = False) -> dict[str, dict[str, bool]]:
    """
    Returns mapping of { module_slug: { 'view': bool, 'update': bool, 'delete': bool, 'execute': bool } }.
    - If is_superuser or holds 'admin' role: all registered modules have True for all 4 actions.
    - If user_id is None (anonymous): evaluates the 'anon' role's auth_role_modules.
    - Otherwise:
        1. Base capabilities = Bitwise OR across all roles assigned in auth_user_roles.
        2. Apply non-null overrides from auth_user_module_overrides.
    """
```

### 3.2 Dynamic Navigation Settings Service (`nav_service.py`)

Merges code-registered navigation trees with database customizations:
```python
def get_effective_navigation_settings() -> dict[str, dict[str, Any]]:
    """Return dictionary of nav overrides keyed by nav_key (path)."""

def update_nav_item_setting(nav_key: str, payload: dict) -> dict:
    """Insert or update custom ordering, label, icon, or tooltip for a nav route."""
```

### 3.3 FastAPI Authorization Dependency (`dependencies.py`)

```python
ActionType = Literal["view", "update", "delete", "execute"]

def require_permission(
    module: str,
    action: ActionType = "view",
    *,
    allow_anon: bool = False,
):
    """
    FastAPI endpoint dependency.
    Raises 401 if unauthenticated and not allowed anon.
    Raises 403 with structured JSON envelope if action capability is missing.
    Logs denials to auth_activity_log with actor IP.
    """
```

### 3.4 Security & Navigation API Endpoints (`routes/security.py` & `routes/navigation.py`)

| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/security/me` | Public | Return caller's compiled permissions map & roles |
| `GET` | `/api/v1/security/roles` | Admin | List all roles, descriptions, and assigned user counts |
| `POST` | `/api/v1/security/roles` | Admin | Create custom application role |
| `PATCH` | `/api/v1/security/roles/{role_id}` | Admin | Update role label/description |
| `DELETE` | `/api/v1/security/roles/{role_id}` | Admin | Delete custom role (core roles protected) |
| `GET` | `/api/v1/security/matrix` | Admin | Full Roles $\times$ Modules capability matrix |
| `PUT` | `/api/v1/security/matrix` | Admin | Bulk-update capabilities for (role, module) |
| `GET` | `/api/v1/security/modules` | Admin | List all registered modules & core flags |
| `POST` | `/api/v1/security/modules` | Admin | Register/update domain module metadata |
| `GET` | `/api/v1/security/users/{user_id}/profile` | Admin / Self | Compiled read-only access profile breakdown |
| `PUT` | `/api/v1/security/users/{user_id}/roles` | Admin | Update assigned roles for a user |
| `PUT` | `/api/v1/security/users/{user_id}/overrides`| Admin | Bulk-update tri-state granular overrides |
| `GET` | `/api/v1/navigation/settings` | Public / Auth | Return merged nav ordering & appearance overrides |
| `PUT` | `/api/v1/navigation/settings` | Admin | Bulk-update nav ordering, labels, icons, tooltips |

---

## 4. Frontend Platform Contract (`@djntechnic/bedrock-ui`)

### 4.1 React Security Hook (`useSecurity.ts`)

```typescript
export interface ModulePermissions {
  view: boolean;
  update: boolean;
  delete: boolean;
  execute: boolean;
}

export interface SecurityContext {
  authenticated: boolean;
  roles: string[];
  permissions: Record<string, ModulePermissions>;
  can: (module: string, action?: "view" | "update" | "delete" | "execute") => boolean;
  hasRole: (role: string) => boolean;
  isAdmin: boolean;
  isLoading: boolean;
}
```

### 4.2 Dynamic Navigation Tree & Rail Gating (`navRegistry.ts` & `AppSidebar.tsx`)

1. **Appearance Customization Layer**:
   - Navigation tree is registered in code via `registerNavItems()`.
   - `AppSidebar` fetches navigation settings (`/api/v1/navigation/settings`) to apply dynamic sort ordering, label overrides, icon overrides, and tooltip text.
2. **Security Gating Layer (Strict Filter)**:
   - Evaluates `isNavItemVisible(item)`:
     - If `item.role` is set and caller lacks the role $\to$ `false` (hidden).
     - If `item.module` is set and `can(item.module, item.action ?? "view")` is false $\to$ `false` (**completely hidden from sidebar and command palette**).
     - If a parent item has children, any unauthorized children are removed; if all children are hidden and parent route itself is unauthorized $\to$ parent is hidden.

### 4.3 Route Guard (`ProtectedRoute.tsx`)

- Validates authentication state, roles, and granular action requirements.
- If unauthorized for direct navigation, renders `<PermissionDenied module={module} action={action} />` in place of page content.

### 4.4 In-Page UI Guards (`<Can>` and `<PermissionButton>`)

- `<Can module="inventory" action="update">` conditionally mounts UI elements.
- `<PermissionButton module="inventory" action="execute">` renders buttons disabled with descriptive tooltips when permission is absent.

---

## 5. Admin Security & Navigation UI Hub Specifications

The Bedrock Admin Console provides 5 integrated panels:

1. **Role Permissions Matrix Panel (`RoleMatrixPanel.tsx`)**:
   - Interactive grid of Modules (rows) $\times$ Roles (columns).
   - 4-way toggle buttons `[V] [U] [D] [E]` per cell.
   - `+ Add Custom Role` modal for creating dynamic application roles without code changes.
   - Protected `admin` column.
2. **User Accounts & Permissions Panel (`UsersSecurityPanel.tsx`)**:
   - User account list with role tags, activation toggle, and session revoker.
   - **Granular User Overrides Drawer (`UserPermissionsDrawer.tsx`)**:
     - Tri-state toggles: `Inherit (Role Default)` / `Force Grant` / `Force Deny`.
     - Live effective permission indicator badges.
3. **Compiled User Access Profile Inspector (`UserAccessProfileView.tsx`)**:
   - Read-only inspection dialog showing every registered screen and route with `ALLOWED` / `DENIED` status and the underlying reason (Role vs. User Override vs. Public).
   - Embedded on `/profile` for self-service transparency.
4. **Dynamic Menu Navigation Editor Panel (`NavEditorPanel.tsx`)**:
   - Visual reordering tree of registered menu and submenu items.
   - Reorder items via drag-and-drop or order inputs.
   - Edit display labels, select icon overrides from Lucide icon picker, and customize tooltips.
   - Toggle visibility overrides (`is_hidden_override`).
5. **Module Registry Panel (`ModulesPanel.tsx`)**:
   - Overview of domain and core modules, descriptions, sort orders, and licensing flags.
6. **Security Log & IP Tracker (`SecurityLogViewer.tsx`)**:
   - Stream of security events capturing `event_type`, `actor_ip` (resolving proxies), `user_agent`, `path`, and target resource.

---

## 6. Preliminary Module & Screen Catalog (First-Pass Deliverable)

> [!IMPORTANT]
> **Human Approval Gate**: This section constitutes the first-pass catalog of all modules, screens, and functions across the ecosystem. Implementation of downstream route and navigation changes will begin only after your explicit approval of this mapping.

### 6.1 Bedrock Platform Core
| Module Slug | Label | Screen / Route / Feature | Required Action | Default Roles Allowed | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `admin` | Admin Console | `/admin` (all tabs & sub-tabs) | `view` | `admin` | System admin console base |
| `admin` | Admin Users | `/admin?tab=users` | `update` | `admin` | Edit roles, active state, invite users |
| `admin` | Admin Security | `/admin?tab=security` | `view` | `admin` | View security log & audit stream |
| `admin` | Admin Config | `/admin?tab=settings` | `update` | `admin` | Edit system app configuration |
| `admin` | Admin Grids | `/admin?tab=grids` | `update` | `admin` | Edit grid column configurations |
| `health` | System Health | `/health`, `/admin?tab=health` | `view` | `anon`, `viewer`, `member`, `admin` | Backend diagnostics & counters |

---

### 6.2 MLBTracker Domain Catalog
| Module Slug | Label | Screen / Route / Feature | Required Action | Default Roles Allowed | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `dashboard` | Dashboard | `/` (Main Overview) | `view` | `anon`, `viewer`, `member`, `admin` | Public performance KPIs & summaries |
| `leaderboards`| Leaderboards | `/leaderboards?view=batting`, `pitching` | `view` | `anon`, `viewer`, `member`, `admin` | Historical stats leaderboards |
| `rankings` | Rankings | `/rankings`, `/rankings/compare` | `view` | `anon`, `viewer`, `member`, `admin` | Player ranking calculations |
| `trends` | Trends | `/trends?view=batting`, `pitching` | `view` | `anon`, `viewer`, `member`, `admin` | Multi-season performance trends |
| `players` | Players | `/players`, `/players/:id` | `view` | `anon`, `viewer`, `member`, `admin` | Player profiles & stats history |
| `inventory` | Collection | `/collection`, `/collection/sets` | `view` | `member`, `admin` | User's owned cards & set checklists |
| `inventory` | Transactions | `/transactions` | `view` | `member`, `admin` | Transaction ledger & flip tracking |
| `inventory` | Record Tx | `/transactions/record` | `update` | `member`, `admin` | Record buy/sell/trade entry |
| `inventory` | Catalog Sets | `/catalog/sets` | `view` | `anon`, `viewer`, `member`, `admin` | Reference card sets directory |
| `inventory` | Submit Set | `/catalog/sets/submit` | `update` | `member`, `admin` | Submit new card set to catalog |
| `inventory` | Imports | `/inventory?tab=imports` | `execute` | `member`, `admin` | Run CSV data imports & batch uploads |
| `inventory` | Purge / Del | `/inventory/delete` | `delete` | `admin` | Delete cards / transaction records |

---

### 6.3 CollectIt Domain Catalog
| Module Slug | Label | Screen / Route / Feature | Required Action | Default Roles Allowed | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `dashboard` | Dashboard | `/` (Activity & Stats) | `view` | `viewer`, `member`, `admin` | Marketplace activity summary |
| `listings` | Listings | `/listings`, `/listings/:id` | `view` | `viewer`, `member`, `admin` | View items & studio editor |
| `listings` | Edit Listing | `/listings/create`, `/listings/:id/edit` | `update` | `member`, `admin` | Create & edit listing details |
| `listings` | Delete Item | `/listings/:id/delete` | `delete` | `admin` | Delete item from catalog |
| `photos` | Photos Inbox | `/photos` | `view` | `member`, `admin` | Staging photos management |
| `photos` | Upload Photo| `/photos/upload` | `update` | `member`, `admin` | Upload and crop photos |
| `vault` | Photo Vault | `/vault` | `view` | `viewer`, `member`, `admin` | Immutable master photo archive |
| `export` | Exporter | `/export` | `execute` | `member`, `admin` | Generate & download eBay CSVs |
| `templates` | Templates | `/templates` | `update` | `admin` | Edit listing description HTML |
| `libraries` | Content Lib | `/libraries` | `update` | `admin` | Manage standing copy snippets |

---

## 7. Downstream Consumer Rework Plan

### 7.1 MLBTracker Full Implementation
1. **Schema & Seed Migration**:
   - Seed `auth_modules` (`dashboard`, `leaderboards`, `rankings`, `trends`, `players`, `inventory`).
   - Populate `auth_role_modules` with granular default permissions (`anon` can view public analytics; `member` can view/update collection & execute imports; `admin` has all).
2. **Navigation Definition Rework (`navigation.ts`)**:
   - Update `MLBTRACKER_NAV_ITEMS` and `MLBTRACKER_COMMAND_ROUTES` to declare `module` and granular `action` tags.
3. **Router Protection (`App.tsx`)**:
   - Wrap routes with `<ProtectedRoute module="..." action="...">`.
4. **Backend Route Dependencies**:
   - Update API routers (`api/routes/inventory.py`, `api/routes/transactions.py`, `api/routes/imports.py`, etc.) to enforce `dependencies=[require_permission(module, action)]`.

### 7.2 CollectIt Full Implementation
1. **Schema & Seed Migration**:
   - Seed `auth_modules` (`dashboard`, `listings`, `photos`, `vault`, `export`, `templates`, `libraries`).
   - Populate `auth_role_modules` with domain permissions.
2. **Navigation Definition Rework (`navigation.ts`)**:
   - Replace hardcoded `role: "admin"` tags with granular module actions (e.g. `{ to: "/export", module: "export", action: "execute" }`, `{ to: "/templates", module: "templates", action: "update" }`).
3. **Router Protection (`App.tsx`)**:
   - Wrap routes in `<ProtectedRoute>`.
4. **Backend Route Dependencies**:
   - Update API endpoints (`api/routes/listings.py`, `api/routes/export.py`, `api/routes/templates.py`) to enforce `dependencies=[require_permission(module, action)]`.

---

## 8. Error Handling, Logging & Security Auditing

- **401 Unauthorized**: Intercepted by `apiClient`; redirects to `/login` preserving target path.
- **403 Forbidden**: Returns structured error envelope; triggers toast notification for actions or renders `<PermissionDenied>` for page routes.
- **Audit Logging**: Every permission denial, role change, matrix update, nav setting update, and user override mutation is logged to `auth_activity_log` with IP address and user-agent context.
- **Anonymous Tracking**: Public access and failed attempts by unauthenticated users log `user_id = NULL` with real client IP from `X-Forwarded-For`.

---

## 9. Testing & Verification Plan

1. **Unit & Matrix Tests (`test_security_service.py` & `test_nav_service.py`)**:
   - Multi-role union resolution.
   - Tri-state override precedence (`NULL`, `1`, `0`).
   - Superuser and admin bypass rules.
   - Anonymous role permissions.
   - Navigation settings merge and inheritance.
2. **API Endpoint Tests (`test_security_routes.py` & `test_nav_routes.py`)**:
   - Role creation, matrix update, user override, and nav settings endpoints.
   - 401/403 status code and error payload validation.
   - Denied access audit logging verification.
3. **Frontend Component & Hook Tests (`useSecurity.test.ts`, `ProtectedRoute.test.tsx`, `navRegistry.test.ts`, `NavEditorPanel.test.tsx`)**:
   - Menu item hiding when `can_view = false`.
   - Route guard blocking unauthorized navigation.
   - Role matrix panel batch updates.
   - Navigation customization persistence and display.
4. **End-to-End Consumer Verification**:
   - Test MLBTracker and CollectIt with multi-user personas (Reader, Importer, Full Admin) verifying navigation visibility, menu customizations, and API gating.
