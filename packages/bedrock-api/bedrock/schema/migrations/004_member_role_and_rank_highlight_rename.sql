-- Platform migration 004 — rename the `collector` role slug and two grid
-- flags that carried the same MLBTracker-specific vocabulary.
--
-- `collector` was baseball-card language baked into a supposedly generic
-- four-tier role ladder (anon/viewer/collector/admin). It is now
-- anon/viewer/member/admin. `show_medal_toggles` and `team_accent_reactive`
-- had the same problem on app_grid_settings: "medal" presumed a
-- podium/ranking domain and "team" presumed team-based rows, neither of
-- which the platform can assume. They become `show_rank_highlight` and
-- `row_accent_reactive`.
--
-- baseline.sql and seed.sql already ship the new names for apps created
-- fresh; this migration carries an existing database across the same
-- rename. SQLite's `ALTER TABLE ... RENAME COLUMN` (supported since
-- 3.25.0; this platform targets a version well past that) is used directly
-- rather than the create/copy/drop/rename dance — no column type, default,
-- or constraint changes, only names.

UPDATE auth_roles
   SET slug = 'member', label = 'Member'
 WHERE slug = 'collector';

ALTER TABLE app_grid_settings RENAME COLUMN show_medal_toggles TO show_rank_highlight;
ALTER TABLE app_grid_settings RENAME COLUMN team_accent_reactive TO row_accent_reactive;
