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
--   Roles are the platform's. The four-tier anon/viewer/collector/admin model
--   is baked into dependencies.py and the admin console, so every bedrock app
--   inherits it.
--
--   Modules are mostly the application's. Only `admin` and `health` ship here,
--   because those are the platform's own surfaces. MLBTracker's leaderboards,
--   rankings, trends, players and inventory modules belong in MLBTracker, and
--   another app registers its own.

-- ── Roles ───────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO auth_roles (slug, label) VALUES
  ('anon',      'Anonymous'),
  ('viewer',    'Viewer'),
  ('collector', 'Collector'),
  ('admin',     'Administrator');

-- ── Platform modules ────────────────────────────────────────────────────────
-- sort_order leaves room below: an application's own modules are expected to
-- sort ahead of these, which is why they start at 90.
INSERT OR IGNORE INTO auth_modules (slug, label, sort_order, is_core, description) VALUES
  ('admin',  'Admin',  90, 1, 'System administration console'),
  ('health', 'Health', 99, 0, 'Backend health diagnostics');

-- ── Role grants ─────────────────────────────────────────────────────────────
-- Administrators get every module that exists at seed time.
--
-- Note for applications: this is a snapshot, not a rule. A migration that adds
-- a module must also grant it to admin, or the console will not show it. The
-- same statement re-run after the insert does the job, since it is an
-- INSERT OR IGNORE cross join.
INSERT OR IGNORE INTO auth_role_modules (role_id, module_id)
SELECT r.role_id, m.module_id
  FROM auth_roles r, auth_modules m
 WHERE r.slug = 'admin';

-- Everyone else can reach health; nobody but admin gets the console.
INSERT OR IGNORE INTO auth_role_modules (role_id, module_id)
SELECT r.role_id, m.module_id
  FROM auth_roles r, auth_modules m
 WHERE r.slug IN ('viewer', 'collector')
   AND m.slug = 'health';
