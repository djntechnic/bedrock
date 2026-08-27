/**
 * @file CustomColumnsPanel.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description "Custom Columns" tab — surfaces the grid-injected meta columns
 *              (Selection, Ranking, Rank highlight) that are **not** rows in
 *              app_grid_column_settings but are still governed by
 *              app_grid_settings flags. Each toggle writes the draft, so the
 *              live preview updates immediately.
 *
 *              Field mapping (already-existing GridSetting fields, no schema
 *              changes):
 *                • Selection column   → allow_selection
 *                • Ranking column     → show_ranking
 *                • Rank highlight     → show_rank_highlight
 *              Related header affordance (visibility of the rank-highlight
 *              toolbar toggle on the live grid header) is not a separate flag
 *              today — the same show_rank_highlight field drives both. Kept
 *              explicit in the copy so admins understand the paired behavior.
 */

import { Badge } from "../../ui/badge";
import type { GridSetting } from "../../../hooks/useAdminPlatform";
import { SwitchRow } from "./editorFields";
import CollapsibleSection from "./CollapsibleSection";

interface CustomColumnsPanelProps {
  draftGrid: GridSetting;
  setGridField: <K extends keyof GridSetting>(field: K, value: GridSetting[K]) => void;
}

/** Coerce a SQLite 0/1 or JS boolean into a boolean for the Switch primitives. */
const bool = (v: boolean | number | null | undefined): boolean =>
  typeof v === "boolean" ? v : v === 1;

export default function CustomColumnsPanel({
  draftGrid,
  setGridField,
}: CustomColumnsPanelProps) {
  const g = draftGrid;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground px-1">
        These columns are <em>injected</em> by the grid runtime — they don't have
        a row in <code>app_grid_column_settings</code>. Toggling any of them
        updates the live preview.
      </p>

      <CollapsibleSection
        storageKey="custom.selection"
        title="Selection column"
        subtitle="Prepends checkboxes so admins can pick rows for comparison."
        badge={
          <Badge variant={bool(g.allow_selection) ? "default" : "outline"} className="text-[10px]">
            {bool(g.allow_selection) ? "On" : "Off"}
          </Badge>
        }
      >
        <SwitchRow
          label="Enable selection column"
          checked={bool(g.allow_selection)}
          onChange={(v) => setGridField("allow_selection", v)}
        />
        <p className="text-[11px] text-muted-foreground">
          Wired via <code>prependSelectionColumn()</code> in{" "}
          <code>lib/gridUtils</code>. Not a React prop — this flag is the source
          of truth for every consumer.
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        storageKey="custom.ranking"
        title="Ranking column"
        subtitle="Numeric rank based on the current sort order."
        badge={
          <Badge variant={bool(g.show_ranking) ? "default" : "outline"} className="text-[10px]">
            {bool(g.show_ranking) ? "On" : "Off"}
          </Badge>
        }
      >
        <SwitchRow
          label="Show ranking column"
          checked={bool(g.show_ranking)}
          onChange={(v) => setGridField("show_ranking", v)}
        />
        <p className="text-[11px] text-muted-foreground">
          Wired via <code>prependRankColumn()</code> in{" "}
          <code>utils/gridUtils</code>. Shows numeric row rank. Enable Rank highlight below to add rank icons for top 3 positions.
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        storageKey="custom.rankHighlight"
        title="Rank highlight"
        subtitle="Highlights the top three rows with gold / silver / bronze accents."
        badge={
          <Badge variant={bool(g.show_rank_highlight) ? "default" : "outline"} className="text-[10px]">
            {bool(g.show_rank_highlight) ? "On" : "Off"}
          </Badge>
        }
      >
        <SwitchRow
          label="Show rank highlight"
          checked={bool(g.show_rank_highlight)}
          onChange={(v) => setGridField("show_rank_highlight", v)}
        />
        <p className="text-[11px] text-muted-foreground">
          Drives both the row-styling via <code>getRankRowClass()</code> and the
          rank-highlight toggle in <code>GridHeader</code>.
        </p>
      </CollapsibleSection>
    </div>
  );
}
