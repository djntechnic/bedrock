-- Platform migration 003 — which side of the grid the selection checkbox sits on.
--
-- `<DataGrid>` appended the selection column after the data columns and there
-- was no way to say otherwise: the position was a string literal in the engine.
-- Every spreadsheet, mail client and file manager puts the checkbox first, and
-- a grid whose selection column is off the right-hand edge of a wide table is a
-- selection nobody finds.
--
-- Default 'end' on purpose: every grid already seeded keeps the layout it has,
-- and moving one is a config change rather than a release.

ALTER TABLE app_grid_settings ADD COLUMN selection_position TEXT NOT NULL DEFAULT 'end';
