-- bedrock platform seed data
--
-- Reference rows the platform's own code requires. Applied after baseline.sql
-- and before an application's migrations.
--
-- This is not optional. The auth chain resolves a user's role by slug, so a
-- database with no roles rejects every registration with "unknown role" — the
-- platform does not work without these rows. In MLBTracker they were seeded
-- from its application migrations, which meant bedrock's auth system depended
-- on the application half to function.
--
-- The split is drawn where ownership actually lies:
--
--   Roles are the platform's. The four-tier anon/viewer/member/admin model
--   is baked into dependencies.py and the admin console, so every bedrock app
--   inherits it.
--
--   Modules are mostly the application's. Only `admin` and `health` ship here,
--   because those are the platform's own surfaces. MLBTracker's leaderboards,
--   rankings, trends, players and inventory modules belong in MLBTracker, and
--   another app registers its own.

-- ── Roles ───────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO auth_roles (slug, label, description) VALUES
  ('anon',      'Anonymous',     'Unauthenticated public visitor'),
  ('viewer',    'Viewer',        'Read-only access to licensed modules'),
  ('member',    'Member',        'Full member access with creation/update capabilities'),
  ('admin',     'Administrator', 'Full system administrative access across all modules');

-- ── Platform modules ────────────────────────────────────────────────────────
-- sort_order leaves room below: an application's own modules are expected to
-- sort ahead of these, which is why they start at 90.
INSERT OR IGNORE INTO auth_modules (slug, label, sort_order, is_core, description) VALUES
  ('admin',  'Admin',  90, 1, 'System administration console'),
  ('health', 'Health', 99, 0, 'Backend health diagnostics');

-- ── Role grants ─────────────────────────────────────────────────────────────
-- Administrators get every capability on every module that exists at seed time.
INSERT OR IGNORE INTO auth_role_modules (role_id, module_id, can_view, can_update, can_delete, can_execute)
SELECT r.role_id, m.module_id, 1, 1, 1, 1
  FROM auth_roles r, auth_modules m
 WHERE r.slug = 'admin';

-- Everyone else can view health; nobody but admin gets the admin console.
INSERT OR IGNORE INTO auth_role_modules (role_id, module_id, can_view, can_update, can_delete, can_execute)
SELECT r.role_id, m.module_id, 1, 0, 0, 0
  FROM auth_roles r, auth_modules m
 WHERE r.slug IN ('anon', 'viewer', 'member')
   AND m.slug = 'health';

