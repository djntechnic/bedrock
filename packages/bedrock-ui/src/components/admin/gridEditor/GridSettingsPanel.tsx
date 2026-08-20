/**
 * @file GridSettingsPanel.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description Grid-level settings editor (app_grid_settings). Every card is a
 *              persisted CollapsibleSection so admins can focus on one group at
 *              a time; open/close state persists to localStorage. Phase 7 F1
 *              retired the legacy "Not yet wired" section — every field on this
 *              panel now round-trips into a live `<DataGrid>` display consumer
 *              (sticky_first_column plumbs into TanStack column pinning; the
 *              rest were wired in prior phases).
 */

import type { GridSetting } from "../../../hooks/useAdminPlatform";
import { SwitchRow, NumberRow, TextRow, SelectRow, ColorRow } from "./editorFields";
import CollapsibleSection from "./CollapsibleSection";

interface GridSettingsPanelProps {
  draftGrid: GridSetting;
  columnIds: string[];
  setGridField: <K extends keyof GridSetting>(field: K, value: GridSetting[K]) => void;
}

export default function GridSettingsPanel({
  draftGrid,
  columnIds,
  setGridField,
}: GridSettingsPanelProps) {
  const g = draftGrid;
  const bool = (v: boolean | number | null | undefined) => (typeof v === 'boolean' ? v : v === 1);

  return (
    <div className="space-y-3">
      <CollapsibleSection storageKey="grid.pagination" title="Pagination">
        <SwitchRow label="Pagination enabled" checked={bool(g.pagination_enabled)}
          onChange={(v) => setGridField("pagination_enabled", v)} />
        <NumberRow label="Default page size" value={g.default_page_size}
          onChange={(v) => setGridField("default_page_size", v)} />
        <TextRow label="Page size options" value={g.page_size_options}
          placeholder="25,50,100,250"
          onChange={(v) => setGridField("page_size_options", v)} />
      </CollapsibleSection>

      <CollapsibleSection storageKey="grid.display" title="Display">
        <SwitchRow label="Sticky header" checked={bool(g.sticky_header)}
          onChange={(v) => setGridField("sticky_header", v)} />
        <SwitchRow label="Sticky first column" checked={bool(g.sticky_first_column)}
          onChange={(v) => setGridField("sticky_first_column", v)} />
        <SwitchRow label="Allow column reorder (drag)" checked={bool(g.allow_column_reorder ?? true)}
          onChange={(v) => setGridField("allow_column_reorder", v)} />
        <SwitchRow label="Allow row expansion" checked={bool(g.allow_expansion ?? false)}
          onChange={(v) => setGridField("allow_expansion", v)} />
        <SwitchRow label="Row striping" checked={bool(g.row_striping)}
          onChange={(v) => setGridField("row_striping", v)} />
        <SwitchRow label="Dense mode" checked={bool(g.dense_mode)}
          onChange={(v) => setGridField("dense_mode", v)} />
        <SwitchRow label="Wrap text" checked={bool(g.wrap_text)}
          onChange={(v) => setGridField("wrap_text", v)} />
        <NumberRow label="Min column width (px)" value={g.min_column_width}
          onChange={(v) => setGridField("min_column_width", v)} />
        <SelectRow label="Default sort column" value={g.default_sort_column ?? ""}
          options={[{ value: "", label: "— none —" }, ...columnIds.map((c) => ({ value: c, label: c }))]}
          onChange={(v) => setGridField("default_sort_column", v || null)} />
        <SelectRow label="Default sort direction" value={g.default_sort_direction ?? ""}
          options={[{ value: "", label: "— none —" }, { value: "asc", label: "Ascending" }, { value: "desc", label: "Descending" }]}
          onChange={(v) => setGridField("default_sort_direction", v || null)} />
      </CollapsibleSection>

      <CollapsibleSection storageKey="grid.header" title="Header controls"
        subtitle="Toolbar affordances at the top of the grid.">
        <SwitchRow label="Column toggle" checked={bool(g.allow_column_toggle)}
          onChange={(v) => setGridField("allow_column_toggle", v)} />
        <SwitchRow label="CSV export" checked={bool(g.allow_export)}
          onChange={(v) => setGridField("allow_export", v)} />
        <SwitchRow label="Print / PDF" checked={bool(g.allow_print)}
          onChange={(v) => setGridField("allow_print", v)} />
        <SwitchRow label="Row count" checked={bool(g.show_row_count)}
          onChange={(v) => setGridField("show_row_count", v)} />
        <SwitchRow label="Ranking column" checked={bool(g.show_ranking)}
          onChange={(v) => setGridField("show_ranking", v)} />
        <SwitchRow label="Medal / podium toggles" checked={bool(g.show_medal_toggles)}
          onChange={(v) => setGridField("show_medal_toggles", v)} />
        <SwitchRow label="Selection checkbox column" checked={bool(g.allow_selection)}
          onChange={(v) => setGridField("allow_selection", v)} />
        <SelectRow label="Selection column position" value={g.selection_position ?? "end"}
          options={[{ value: "end", label: "Right (last column)" }, { value: "start", label: "Left (first column)" }]}
          onChange={(v) => setGridField("selection_position", v)} />
        <SwitchRow label="Inline search" checked={bool(g.show_search)}
          onChange={(v) => setGridField("show_search", v)} />
        <SwitchRow label="Density toggle" checked={bool(g.show_density_toggle)}
          onChange={(v) => setGridField("show_density_toggle", v)} />
        <NumberRow label="Tooltip delay (ms)" value={g.tooltip_delay_duration ?? undefined}
          placeholder="150"
          onChange={(v) => setGridField("tooltip_delay_duration", Number.isNaN(v) ? null : v)} />
      </CollapsibleSection>

      <CollapsibleSection storageKey="grid.colors" title="Sort & hover colors">
        <ColorRow label="Sort ascending" value={g.sort_asc_color}
          onChange={(v) => setGridField("sort_asc_color", v)} />
        <ColorRow label="Sort descending" value={g.sort_desc_color}
          onChange={(v) => setGridField("sort_desc_color", v)} />
        <ColorRow label="Row hover" value={g.hover_color}
          onChange={(v) => setGridField("hover_color", v)} />
      </CollapsibleSection>

      <CollapsibleSection storageKey="grid.liveStyle" title="Live data & styling"
        subtitle="§S9 scoreboard tokens — condensed numerals, changed-cell flash, team-accent rows.">
        <SelectRow label="Numeral style" value={g.numeral_style ?? "default"}
          options={[{ value: "default", label: "Default" }, { value: "tabular", label: "Tabular (condensed)" }]}
          onChange={(v) => setGridField("numeral_style", v)} />
        <SwitchRow label="Live update highlight" checked={bool(g.live_update_highlight ?? false)}
          onChange={(v) => setGridField("live_update_highlight", v)} />
        <SwitchRow label="Team accent reactive" checked={bool(g.team_accent_reactive ?? false)}
          onChange={(v) => setGridField("team_accent_reactive", v)} />
      </CollapsibleSection>

      <CollapsibleSection storageKey="grid.assignment" title="Screen assignment"
        defaultOpen={false}>
        <TextRow label="Page / screen" value={g.page ?? ""}
          placeholder="e.g. Rankings"
          onChange={(v) => setGridField("page", v || null)} />
        <TextRow label="Title" value={g.title ?? ""}
          onChange={(v) => setGridField("title", v || null)} />
        <TextRow label="Sub-header" value={g.sub_header ?? ""}
          onChange={(v) => setGridField("sub_header", v || null)} />
        <TextRow label="Footer note" value={g.footer ?? ""}
          onChange={(v) => setGridField("footer", v || null)} />
        <TextRow label="Caption (a11y)" value={g.caption ?? ""}
          placeholder="Semantic <caption> text for screen readers"
          onChange={(v) => setGridField("caption", v || null)} />
      </CollapsibleSection>

      <CollapsibleSection storageKey="grid.rowKey" title="Row identity"
        subtitle="Field that uniquely identifies each row — drives the selection column.">
        <TextRow label="Row key column" value={g.row_key_column ?? ""}
          placeholder="e.g. player_id, mlb_id, card_id"
          onChange={(v) => setGridField("row_key_column", v || null)} />
      </CollapsibleSection>

    </div>
  );
}
