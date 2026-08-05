/**
 * @file cellRenderers.tsx
 * @module frontend/src/components/grids
 * @description Shared cell renderer registry for consistent column display across all grids.
 *
 * Usage: call resolveCell(columnId, value, row) in any grid's cell definition.
 * Returns a ReactNode if the column has a registered renderer, undefined otherwise.
 *
 * renderCell() is the shared cell-content renderer that applies:
 *  - null_display fallback
 *  - format_string / cell_type formatting
 *  - conditional_format class (threshold-based)
 *  - gradient backgroundColor style (takes visual priority over conditional_format)
 *  - link_target navigation
 */

import type { ReactNode, CSSProperties } from "react";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { StatBadge } from "../ui/stat-badge";
import { getConditionalClass, getConditionalVariant } from "../../utils/conditionalFormat";
import { getRankIcon } from "../../utils/rankStyle";
import {
  getMediaCellTypes,
  resolveColumnRenderer,
  resolveMediaRenderer,
  type CellRenderOptions,
} from "./cellRegistry";
import type { GridColumnSetting } from "../../hooks/useAdminPlatform";

// ─── Phase 4 composite cell payload ────────────────────────────────────────────
// Endpoints that route or render richer than a flat scalar can emit a payload
// shaped { value, meta } — `value` is what the cell displays; `meta` carries
// routing/identity fields (mlb_id, team_id, card_id) that renderers and
// link_target resolution consume without hunting sibling columns.

/** Composite payload envelope — a flat scalar or `{ value, meta }`. */
export type GridCellPayload<T = unknown> =
  | T
  | { value: T; meta: Record<string, unknown> };

/** Type guard for the composite envelope. */
export function isCompositeCellPayload<T = unknown>(
  v: unknown,
): v is { value: T; meta: Record<string, unknown> } {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    "value" in v &&
    "meta" in v &&
    typeof (v as { meta: unknown }).meta === "object"
  );
}

/**
 * Unwrap a cell payload into its display value and (optional) meta object.
 * Flat scalars pass through with `meta = {}`. Consumers should always route
 * value/meta through this helper before dispatching to any renderer so the
 * composite shape is transparent to the rest of the pipeline.
 */
export function unwrapCellPayload<T = unknown>(
  v: unknown,
): { value: T; meta: Record<string, unknown> } {
  if (isCompositeCellPayload<T>(v)) return { value: v.value, meta: v.meta };
  return { value: v as T, meta: {} };
}

// ─── Phase 4 link_target routing ───────────────────────────────────────────────
// The link_target enum values (player_page | team_page | set_page | card_page)
// map to router paths through a single lookup table. Renderers consult meta
// (from the composite payload) first, then fall back to sibling row fields,
// mirroring the pre-composite convention so existing endpoints continue to
// work without a data-shape change.

/** Parameters available to link_target resolution. */
export interface LinkResolveCtx {
  meta: Record<string, unknown>;
  row: Record<string, unknown>;
}

/**
 * Resolve a router path for a given link_target. Returns null when the
 * required identifier isn't available (e.g. team_page called without a
 * team id in meta/row) — callers then render the plain display value.
 */
export function resolveLinkPath(
  linkTarget: string | null | undefined,
  ctx: LinkResolveCtx,
): string | null {
  if (!linkTarget) return null;
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (ctx.meta[k] != null) return ctx.meta[k];
      if (ctx.row[k] != null) return ctx.row[k];
    }
    return null;
  };
  switch (linkTarget) {
    case "player_page": {
      const id = pick("player_id", "mlb_id");
      return id == null ? null : `/players/${id}`;
    }
    case "team_page": {
      const id = pick("team_id", "mlb_team_id");
      return id == null ? null : `/teams/${id}`;
    }
    case "set_page": {
      const id = pick("set_id");
      return id == null ? null : `/inventory/sets/${id}`;
    }
    case "card_page": {
      const id = pick("card_id");
      return id == null ? null : `/inventory/cards/${id}`;
    }
    default:
      return null;
  }
}

// The level/position class helpers and the PositionBadge / LevelBadge /
// TrendingBadge components moved to components/domain/cellRenderers — they
// encode baseball categories (MLB/AAA levels, fielding positions) and so sit
// on the application side of the framework boundary.

// ─── Rank cell ─────────────────────────────────────────────────────────────────

/** Renders the rank column cell: medal icon (ranks 1–3) + numeric position. */
export function renderRankCell(rank: number): ReactNode {
  const icon = getRankIcon(rank);
  return (
    <span className="flex items-center gap-1 text-muted-foreground tabular-nums">
      {icon}
      {rank}
    </span>
  );
}

// ─── Media cell dispatch ──────────────────────────────────────────────────────
// `cell_type` values whose renderers need sibling row fields (a headshot needs
// row.mlb_team_id, not just the display name) are supplied by the host app via
// registerMediaRenderer(). The engine only dispatches. See ./cellRegistry.

/** The `cell_type` values that require the full row and are handled by the
 *  engine before delegating to `renderCell`. This is a function rather than a
 *  constant because registration is a boot-time side-effect: the set is only
 *  complete once the host app's renderer module has been imported. */
export { getMediaCellTypes };

/** Dispatch entry point used by `<DataGrid>` when a column's `cell_type` is
 *  one of the media renderers. Returns undefined when no renderer is
 *  registered for the cell_type — `cell_type` is admin-editable, so an unknown
 *  value must fall through to plain-text rendering rather than throw. */
export function renderMediaCell(
  cellType: string | null | undefined,
  value: unknown,
  row: Record<string, unknown>,
): ReactNode | undefined {
  const render = resolveMediaRenderer(cellType);
  return render ? render(value, row) : undefined;
}

// ─── Shared renderCell ─────────────────────────────────────────────────────────

/**
 * Shared cell content renderer for all grids. Applies formatting, conditional
 * classes, gradient background, and link targets uniformly.
 *
 * Gradient takes visual priority over conditional_format when both are set.
 *
 * @param value      - Raw cell value from the accessor.
 * @param col        - Column config (format_string, cell_type, null_display, etc.).
 * @param columnId   - The column_id string (used for rate column detection).
 * @param gradientStyle - Optional pre-computed inline style from getGradientCellStyle().
 * @param navigate   - Optional router navigate function (required for link_target).
 * @param playerId   - Optional player_id for link_target="player_page".
 * @param linkCtx    - Meta/row context for config-driven link_target resolution.
 * @param numeralStyle - Grid-level `config.numeralStyle` (§S9 Phase 3). `"tabular"`
 *                       applies the shared `.tabular-nums` utility to numeric cells.
 */
export function renderCell(
  value: unknown,
  col: Pick<
    GridColumnSetting,
    | "null_display"
    | "cell_type"
    | "format_string"
    | "conditional_format"
    | "link_target"
    | "wrap_text"
  > & { column_id?: string },
  columnId: string,
  gradientStyle?: CSSProperties,
  navigate?: (path: string) => void,
  playerId?: number,
  linkCtx?: LinkResolveCtx,
  numeralStyle?: "default" | "tabular",
): ReactNode {
  if (value == null) return col?.null_display ?? "—";

  const conditionalClass = getConditionalClass(value as number, col?.conditional_format);
  const conditionalVariant = getConditionalVariant(value as number, col?.conditional_format);
  const numeralClass =
    col?.cell_type === "number" && numeralStyle === "tabular" ? "tabular-nums" : undefined;
  let content: ReactNode = value as ReactNode;

  switch (col?.cell_type) {
    case "number": {
      const n = Number(value);
      if (isNaN(n)) {
        content = String(value);
      } else {
        const rateCols = [
          "ba", "obp", "slg", "ops",
          "b_ba", "b_obp", "b_slg", "b_ops",
          "delta_ba", "delta_obp", "delta_slg", "delta_ops",
        ];
        const fmt = col.format_string;
        if (rateCols.includes(columnId)) {
          content = n.toFixed(3);
        } else if (fmt === ".3f" || fmt === "0.000") {
          content = n.toFixed(3);
        } else if (fmt === ".2f" || fmt === "0.00") {
          content = n.toFixed(2);
        } else if (fmt === ".1f" || fmt === "0.0") {
          content = n.toFixed(1);
        } else {
          content = Math.round(n).toLocaleString();
        }
      }
      break;
    }
    case "badge":
      return <Badge variant="outline" className="font-normal">{String(value)}</Badge>;
    case "boolean": {
      // Phase 10 B1: read-only boolean display. Truthy values (1, true,
      // "1", "true") render a check glyph; falsy values render an em dash.
      // When the column is editable, <EditableCell> replaces this output
      // with an interactive <Switch> — see DataGrid's cell pipeline.
      const truthy =
        value === true ||
        value === 1 ||
        value === "1" ||
        (typeof value === "string" && value.toLowerCase() === "true");
      return (
        <span
          aria-label={truthy ? "true" : "false"}
          className={truthy ? "text-positive font-semibold" : "text-muted-foreground"}
        >
          {truthy ? "✓" : "—"}
        </span>
      );
    }
    case "currency": {
      const c = Number(value);
      content = isNaN(c)
        ? String(value)
        : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c);
      break;
    }
    case "date":
      try {
        content = new Date(String(value)).toLocaleDateString();
      } catch {
        content = String(value);
      }
      break;
    case "text":
    default:
      content = String(value);
  }

  if (col?.link_target && navigate) {
    // Prefer the config-driven resolver so team_page / set_page / card_page
    // route without needing a bespoke renderCell branch per target. Fall back
    // to the legacy player_page + playerId path so callers that haven't
    // adopted linkCtx yet keep working.
    let path: string | null = null;
    if (linkCtx) {
      path = resolveLinkPath(col.link_target, linkCtx);
    }
    if (!path && col.link_target === "player_page" && playerId) {
      path = `/players/${playerId}`;
    }
    if (path) {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(path);
          }}
          className={cn("text-left hover:underline text-primary font-medium", conditionalClass, numeralClass)}
          style={gradientStyle}
        >
          {content}
        </button>
      );
    }
  }

  // Gradient takes priority over conditional_format; when both are set, gradient wins.
  if (gradientStyle) {
    return <span className={numeralClass} style={gradientStyle}>{content}</span>;
  }

  // Pill badge for conditional-formatted cells (no gradient).
  if (conditionalVariant) {
    return <StatBadge value={String(content)} variant={conditionalVariant} />;
  }

  return <span className={cn(conditionalClass, numeralClass)}>{content}</span>;
}

/** Options threaded into a column renderer. Re-exported from the registry so
 *  existing consumers keep importing it from this module. */
export type ResolveCellOptions = CellRenderOptions;

/**
 * Resolves a cell renderer registered against a `column_id`.
 *
 * The engine owns no column conventions of its own: the host application
 * registers renderers via `registerColumnRenderer()` (MLBTracker does so in
 * components/domain/cellRenderers). Returns undefined when nothing is
 * registered, so the caller falls through to its own logic.
 *
 * @param columnId - The grid column_id string.
 * @param value    - The raw cell value from the accessor.
 * @param row      - The full row object (for sibling fields like mlb_team_id).
 * @param options  - Optional navigate fn and linkTarget for link rendering.
 */
export function resolveCell(
  columnId: string,
  value: unknown,
  row: Record<string, unknown>,
  options?: ResolveCellOptions,
): ReactNode | undefined {
  const render = resolveColumnRenderer(columnId);
  return render ? render(value, row, options) : undefined;
}
