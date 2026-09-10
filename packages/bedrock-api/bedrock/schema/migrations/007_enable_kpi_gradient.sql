-- Platform migration 007 — enable_kpi_gradient column in app_grid_column_settings (#67)
--
-- Enables automated directional KPI gradients with admin override on numeric grid columns.

ALTER TABLE app_grid_column_settings ADD COLUMN enable_kpi_gradient INTEGER NOT NULL DEFAULT 0;
