"""
Module:  admin.py
Layer:   api/schemas
Desc:    Pydantic models for Admin Console features. Defines schemas for
         system KPIs, database summary, grid configuration, and sync logs.
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class ConfigSettingSchema(BaseModel):
    """Schema for a dynamic application configuration setting."""
    key: str
    value: Optional[str]
    value_type: str
    description: Optional[str]
    category: str
    modified_at: Optional[str] = None
    model_config = {"from_attributes": True}

class ConfigUpdateSchema(BaseModel):
    """Request schema for updating any fields on a configuration setting."""
    value: Optional[str] = None
    value_type: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    key: Optional[str] = None

class ConfigCreateSchema(BaseModel):
    """Request schema for creating a new configuration setting."""
    key: str
    value: str
    value_type: str = "string"
    description: Optional[str] = None
    category: str = "system"

class GridSettingSchema(BaseModel):
    """High-level configuration schema for a data grid UI component.

    Phase 2.c / invariant I11: every 0/1 storage field is `bool` here so this
    is the single coercion boundary. SQLite/Postgres continue to store as
    INTEGER (0/1). Pydantic v2 coerces on read (int → bool) so responses ship
    JSON true/false; inbound admin writes accept int or bool during migration.
    """
    grid_setting_id: Optional[int] = None
    grid_id: str
    grid_label: str
    title: Optional[str] = None
    sub_header: Optional[str] = None
    footer: Optional[str] = None
    allow_column_toggle: bool = True
    allow_export: bool = True
    read_only: bool = False
    # New fields 12.07.06
    default_page_size: int = 50
    page_size_options: str = "25,50,100,250"
    pagination_enabled: bool = True
    sticky_header: bool = True
    sticky_first_column: bool = False
    row_striping: bool = True
    dense_mode: bool = False
    default_sort_column: Optional[str] = None
    default_sort_direction: Optional[str] = None
    show_row_count: bool = True
    show_ranking: bool = False
    wrap_text: bool = False
    min_column_width: int = 80
    sort_asc_color: Optional[str] = None
    sort_desc_color: Optional[str] = None
    hover_color: Optional[str] = None
    allow_selection: bool = False
    # Which side of the grid the selection checkbox column sits on
    # ('start' | 'end'). Defaults to 'end' so every grid seeded before the
    # setting existed keeps the layout it already had.
    selection_position: str = "end"
    allow_print: bool = False
    # Screen/page a grid renders on (drives the admin Screen dropdown)
    page: Optional[str] = None
    # Unified GridHeader controls (previously declared only in the frontend)
    tooltip_delay_duration: Optional[int] = None
    show_search: bool = True
    show_density_toggle: bool = True
    show_medal_toggles: bool = False
    # Phase 4d Q1: name of the row-object field that carries each row's
    # stable ID (e.g. "player_id", "mlb_id", "card_id"). Drives the
    # config-driven selection column on <DataGrid>. Null → engine falls
    # back to the caller's `rowKey` prop during the migration window.
    row_key_column: Optional[str] = None
    # Semantic <caption> element rendered inside the <Table> (accessibility surface).
    caption: Optional[str] = None
    # Phase 5: drag-and-drop column reordering. Session-local for end users;
    # persisted through the admin editor by renumbering column_order on drop.
    allow_column_reorder: bool = True
    # Phase 10 B2: expander column + `renderSubRow` slot on <DataGrid>.
    # When true (and the consumer supplies renderSubRow), the engine
    # prepends a chevron cell that toggles a caller-owned detail row
    # beneath the expanded row.
    allow_expansion: bool = False
    # Phase 3 §S9: condensed tabular-numeral style for cell_type="number"
    # cells ('default' | 'tabular'). Consumed by cellRenderers.renderCell().
    numeral_style: str = "default"
    # Phase 3 §S9: flash changed cells with the --live-pulse token cue.
    live_update_highlight: bool = False
    # Phase 3 §S9: tint each row with its player's --team-accent color.
    team_accent_reactive: bool = False
    model_config = {"from_attributes": True}


class GridColumnSettingSchema(BaseModel):
    """Detailed metadata schema for a single column within a data grid.

    Phase 2.c / invariant I11: bool-typed at the Pydantic boundary — see the
    class docstring on GridSettingSchema for the coercion contract.
    """
    column_setting_id: Optional[int] = None
    grid_setting_id: int
    column_id: str
    label_override: Optional[str] = None
    tooltip_override: Optional[str] = None
    default_visible: bool = True
    default_sort: Optional[str] = None
    default_filter: Optional[str] = None
    column_order: int = 0
    format_string: Optional[str] = None
    null_display: str = "—"
    allow_sort: bool = True
    # Phase 2: 4-state sort mode enum (none|asc|desc|both). Supersedes the
    # legacy allow_sort boolean; the two are kept in parallel for one release.
    allow_sort_mode: str = "both"
    allow_filter: bool = True
    read_only: bool = False
    # New fields 12.07.06
    width: Optional[int] = None
    min_width: int = 60
    max_width: Optional[int] = None
    pinned: Optional[str] = None
    text_align: str = "left"
    wrap_text: bool = False
    resizable: bool = True
    cell_type: str = "text"
    aggregate_function: Optional[str] = None
    conditional_format: Optional[str] = None
    link_target: Optional[str] = None
    group_by: bool = False
    sort_asc_color: Optional[str] = None
    sort_desc_color: Optional[str] = None
    gradient_from_color: Optional[str] = None
    gradient_to_color: Optional[str] = None
    # Phase 8 H3: opt-in inline editing via <EditableCell>.
    editable: bool = False
    model_config = {"from_attributes": True}

class ExportLogSchema(BaseModel):
    """Schema for logging a user export event."""
    export_type: str = Field(..., pattern="^(csv|pdf)$")
    page: str
    row_count: Optional[int] = None
    user_note: Optional[str] = None

class ExportRunSchema(BaseModel):
    """Schema for a historical record of a file export."""
    export_id: int
    export_type: str
    page: str
    row_count: Optional[int]
    user_note: Optional[str]
    exported_at: str
    exported_by: str
    model_config = {"from_attributes": True}

class DatabaseTableSchema(BaseModel):
    """Schema for database table inventory and row count summary."""
    table_name: str
    row_count: int
    table_size: Optional[int] = None

class DatabaseSummarySchema(BaseModel):
    """Schema for overall database summary including sizes."""
    overall_size: int
    tables: List[DatabaseTableSchema]


class ActivityLogSchema(BaseModel):
    """Schema for a single entry in the system activity/audit log."""
    activity_id: int
    event_type: str
    description: str
    event_ts: str
    model_config = {"from_attributes": True}

class SyncRunSchema(BaseModel):
    """Schema for a single data ingestion or sync pipeline run."""
    import_run_id: str
    source: str
    run_type: str
    status: str
    started_ts: str
    completed_ts: Optional[str] = None
    duration_seconds: Optional[float] = None
    total_rows: int = 0
    error_message: Optional[str] = None
    model_config = {"from_attributes": True}

class SyncStatusSchema(BaseModel):
    """Comprehensive schema for the current state of data synchronisation."""
    last_sync_ts: Optional[str] = None
    last_sync_error: Optional[str] = None
    is_running: bool = False
    recent_runs: List[SyncRunSchema] = []


class SeasonSchema(BaseModel):
    season_year: int
    season_type: str = "regular"
    is_current: int = 0
    data_source: str = "lahman"
    lahman_available: int = 0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    notes: Optional[str] = None
    modified_at: Optional[str] = None
    modified_by: str = "Admin"
    model_config = {"from_attributes": True}


class InventoryStatusSchema(BaseModel):
    status_key: str
    display_label: str
    is_default: int = 0
    aliases: Optional[str] = None
    sort_order: int = 0
    color_class: str = "bg-muted text-muted-foreground"
    modified_at: Optional[str] = None
    modified_by: str = "Admin"
    model_config = {"from_attributes": True}


class UiQueryConfigSchema(BaseModel):
    hook_name: str
    stale_time_ms: int = 300000
    refetch_interval_ms: Optional[int] = None
    refetch_on_window_focus: int = 0
    description: Optional[str] = None
    modified_at: Optional[str] = None
    modified_by: str = "Admin"
    model_config = {"from_attributes": True}
