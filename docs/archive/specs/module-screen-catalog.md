# Module, Screen & Functional Security Catalog

- **Date:** 2026-08-28
- **Status:** Pending Human Approval (Checkpoint 0 Deliverable)
- **Scope:** `Bedrock Platform`, `MLBTracker`, `CollectIt`

---

## 1. Overview & Action Taxonomy

Every application screen, navigation route, and backend API endpoint belongs to a specific **Module** and demands a specific **Action Capability**:

- **`view`**: Read-only browsing of data, pages, records, and search results.
- **`update`**: Creation, editing, modification, and saving of records, profiles, and settings.
- **`delete`**: Permanent or soft removal, deletion, or purging of records.
- **`execute`**: Running operational workflows, background jobs, batch imports, data exports, synchronization triggers, and automated audits.

---

## 2. Bedrock Platform Core Catalog

The Bedrock platform provides system infrastructure, administrative management, diagnostic utilities, and configuration engines.

| Module Slug | Label | Screen / Route / Feature | Action | API Endpoints Bound | Default Role Grants | Functional Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `admin` | Admin Console | `/admin` | `view` | `GET /api/v1/admin/*`, `GET /api/v1/database/summary` | `admin` | Core system administrative dashboard & navigation |
| `admin` | User Accounts | `/admin?tab=users` | `update` | `GET/PATCH /api/v1/admin/users`, `POST /api/v1/admin/users/invite`, `DELETE /api/v1/admin/sessions/*` | `admin` | Manage user accounts, activation, invitations, and session revocations |
| `admin` | Security & Matrix | `/admin?tab=security` | `view` | `GET /api/v1/security/*`, `GET /api/v1/admin/security/events` | `admin` | View security log, audit stream, and user access profiles |
| `admin` | Matrix Editor | `/admin?tab=security&sub=matrix` | `update` | `PUT /api/v1/security/matrix`, `POST/PATCH/DELETE /api/v1/security/roles/*`, `PUT /api/v1/security/users/*/overrides` | `admin` | Modify role permissions matrix, add custom roles, set user overrides |
| `admin` | Menu Navigation | `/admin?tab=navigation` | `update` | `GET/PUT /api/v1/navigation/settings` | `admin` | Reorder navigation tree, set custom labels, icons, tooltips, and visibility overrides |
| `admin` | App Settings | `/admin?tab=settings` | `update` | `GET/POST/PATCH/DELETE /api/v1/admin/config/*` | `admin` | Configure application system and domain settings |
| `admin` | Grid Editor | `/admin?tab=grids` | `update` | `GET/POST/PATCH/DELETE /api/v1/admin/grids/*` | `admin` | Customize DataGrid columns, formats, widths, and visibility defaults |
| `admin` | System Audit | `/admin?tab=audit` | `execute` | `GET /api/v1/admin/audit`, `GET /api/v1/admin/audit/history` | `admin` | Trigger automated project audits and inspect integrity findings |
| `health` | System Health | `/health`, `/admin?tab=health` | `view` | `GET /health`, `GET /api/v1/health`, `GET /api/v1/admin/api-health` | `anon`, `viewer`, `member`, `admin` | Public/internal backend health checks, uptime counters, and route latency |

---

## 3. MLBTracker Domain Catalog

MLBTracker is the baseball analytics, historical player statistics, card inventory, and collection tracking domain.

| Module Slug | Label | Screen / Route / Feature | Action | API Endpoints Bound | Default Role Grants | Functional Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `dashboard` | Dashboard | `/` | `view` | `GET /api/v1/dashboard/*`, `GET /api/v1/stats/summary` | `anon`, `viewer`, `member`, `admin` | High-level performance KPIs, top performers, and summary charts |
| `leaderboards`| Leaderboards | `/leaderboards`, `/leaderboards?view=batting`, `pitching` | `view` | `GET /api/v1/leaderboards/*` | `anon`, `viewer`, `member`, `admin` | Historical batting and pitching leaderboards |
| `rankings` | Rankings | `/rankings`, `/rankings/compare` | `view` | `GET /api/v1/rankings/*` | `anon`, `viewer`, `member`, `admin` | Composite player rankings and head-to-head comparison tool |
| `trends` | Trends | `/trends`, `/trends?view=batting`, `pitching` | `view` | `GET /api/v1/trends/*` | `anon`, `viewer`, `member`, `admin` | Multi-season performance trend analysis grids |
| `players` | Players | `/players`, `/players/:id` | `view` | `GET /api/v1/players/*` | `anon`, `viewer`, `member`, `admin` | Player directory, bio information, and career statistics |
| `inventory` | My Collection | `/collection`, `/collection/sets` | `view` | `GET /api/v1/collection/*`, `GET /api/v1/inventory/cards` | `member`, `admin` | User's personal card collection portfolio and set completion checklists |
| `inventory` | Card Details | `/inventory?tab=cards` | `view` | `GET /api/v1/inventory/cards/*` | `member`, `admin` | Detailed view of inventory card items, grades, and values |
| `inventory` | Transactions Ledger| `/transactions` | `view` | `GET /api/v1/transactions/*` | `member`, `admin` | Buy/sell/trade ledger, financial ROI, and transaction history |
| `inventory` | Record Tx | `/transactions/record` | `update` | `POST /api/v1/transactions`, `PUT /api/v1/transactions/*` | `member`, `admin` | Form wizard to record a new buy, sell, or trade transaction |
| `inventory` | Catalog Sets | `/catalog/sets` | `view` | `GET /api/v1/catalog/sets/*` | `anon`, `viewer`, `member`, `admin` | Public reference catalog of official baseball card sets |
| `inventory` | Submit Card Set| `/catalog/sets/submit` | `update` | `POST /api/v1/catalog/sets` | `member`, `admin` | Submit a newly discovered or custom card set to the catalog |
| `inventory` | Data Imports | `/inventory?tab=imports` | `execute` | `POST /api/v1/imports/run`, `GET /api/v1/imports/runs/*` | `member`, `admin` | Execute CSV batch card imports and inspect staging run ledger |
| `inventory` | Sync Schedule | `/admin?tab=sync` | `execute` | `GET/POST /api/v1/sync/*` | `admin` | View MLB API sync schedule and trigger manual data refresh |
| `inventory` | Purge Data | `/inventory/delete` | `delete` | `DELETE /api/v1/inventory/*`, `DELETE /api/v1/transactions/*` | `admin` | Permanently delete inventory holdings or void transactions |

---

## 4. CollectIt Domain Catalog

CollectIt is the collectibles marketplace, eBay draft generation, image pipeline, and listing studio domain.

| Module Slug | Label | Screen / Route / Feature | Action | API Endpoints Bound | Default Role Grants | Functional Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `dashboard` | Dashboard | `/` | `view` | `GET /api/v1/dashboard/summary` | `viewer`, `member`, `admin` | Overview of draft listings count, photo staging queue, and sync status |
| `listings` | Listings List | `/listings` | `view` | `GET /api/v1/listings` | `viewer`, `member`, `admin` | DataGrid of active draft listings, status filters, and SKU search |
| `listings` | Listing Studio | `/listings/:id` | `view` | `GET /api/v1/listings/:id` | `viewer`, `member`, `admin` | Full listing preview, token attributes, and description layout |
| `listings` | Edit Listing | `/listings/create`, `/listings/:id/edit` | `update` | `POST /api/v1/listings`, `PUT/PATCH /api/v1/listings/:id` | `member`, `admin` | Edit item specific tokens, title formula, eBay category, and price |
| `listings` | Delete Listing | `/listings/:id/delete` | `delete` | `DELETE /api/v1/listings/:id` | `admin` | Delete draft listing item |
| `photos` | Photo Inbox | `/photos` | `view` | `GET /api/v1/photos/staged` | `member`, `admin` | View staged photos awaiting association with listing SKUs |
| `photos` | Upload Photo | `/photos/upload` | `update` | `POST /api/v1/photos/upload`, `POST /api/v1/photos/reorder` | `member`, `admin` | Upload raw item images, crop, reorder sequence, and assign SKUs |
| `vault` | Photo Vault | `/vault` | `view` | `GET /api/v1/vault/*` | `viewer`, `member`, `admin` | Permanent immutable master image archive inspection |
| `export` | File Exchange | `/export` | `execute` | `POST /api/v1/export/generate`, `GET /api/v1/export/download/*` | `member`, `admin` | Generate and export official eBay File Exchange CSV batch files |
| `templates` | Description HTML| `/templates` | `update` | `GET/PUT /api/v1/templates/*` | `admin` | Edit master HTML eBay listing description templates and tokens |
| `libraries` | Content Lib | `/libraries` | `update` | `GET/POST/PUT/DELETE /api/v1/libraries/*` | `admin` | Manage reusable brand voice copy snippets, terms, and policies |

---

## 5. Summary Matrix: Roles vs. Modules

| Module | Anonymous (`anon`) | Viewer (`viewer`) | Member (`member`) | Administrator (`admin`) | Custom Roles (Configurable) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`admin`** | None | None | None | `view`, `update`, `delete`, `execute` | Configurable |
| **`health`** | `view` | `view` | `view` | `view`, `update`, `delete`, `execute` | Configurable |
| **`dashboard`** | `view` | `view` | `view` | `view`, `update`, `delete`, `execute` | Configurable |
| **`leaderboards`**| `view` | `view` | `view` | `view`, `update`, `delete`, `execute` | Configurable |
| **`rankings`** | `view` | `view` | `view` | `view`, `update`, `delete`, `execute` | Configurable |
| **`trends`** | `view` | `view` | `view` | `view`, `update`, `delete`, `execute` | Configurable |
| **`players`** | `view` | `view` | `view` | `view`, `update`, `delete`, `execute` | Configurable |
| **`inventory`** | Public Catalog (`view`) | Public Catalog (`view`) | `view`, `update`, `execute` | `view`, `update`, `delete`, `execute` | Configurable |
| **`listings`** | None | `view` | `view`, `update` | `view`, `update`, `delete`, `execute` | Configurable |
| **`photos`** | None | None | `view`, `update` | `view`, `update`, `delete`, `execute` | Configurable |
| **`vault`** | None | `view` | `view` | `view`, `update`, `delete`, `execute` | Configurable |
| **`export`** | None | None | `execute` | `view`, `update`, `delete`, `execute` | Configurable |
| **`templates`** | None | None | None | `view`, `update`, `delete`, `execute` | Configurable |
| **`libraries`** | None | None | None | `view`, `update`, `delete`, `execute` | Configurable |
