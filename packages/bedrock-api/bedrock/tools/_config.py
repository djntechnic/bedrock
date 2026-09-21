"""
Module:  _config.py
Layer:   bedrock/tools
Desc:    Declarative manifest loader for `bedrock.toml`. Every `bedrock.tools
         .audit_*` module sources its exemptions and tunables from here
         instead of hardcoding them, so a consumer changes audit behavior by
         editing a settings file rather than editing platform code.

         Exemptions merge additively: whatever the platform always exempts
         (`_PLATFORM_BASELINE_EXEMPTIONS`) is present in every section's
         `exemptions` list no matter what the consumer's `bedrock.toml`
         declares, deduplicated against whatever the consumer adds on top.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass, field, fields
from pathlib import Path
from typing import Any

from loguru import logger

if sys.version_info >= (3, 11):
    import tomllib
else:  # pragma: no cover - project requires Python 3.11+
    import tomli as tomllib

DEFAULT_IGNORED_DIRS: frozenset[str] = frozenset(
    {
        ".venv",
        "node_modules",
        "dist",
        "build",
        "__pycache__",
        ".git",
        ".pytest_cache",
        ".agents",
        ".claude",
    }
)

# Directories holding vendored or generated data assets (imported stylesheets,
# exported reports), not authored source. Scoped to the audits that scan asset
# content (S009) rather than added to DEFAULT_IGNORED_DIRS, which every audit
# shares - ignoring `exports/` globally would blind S010 to a `routes/exports/`.
DATA_ASSET_DIRS: frozenset[str] = frozenset({"data", "imports", "exports"})

# Paths every audit tool ignores regardless of what a consumer declares.
_PLATFORM_BASELINE_EXEMPTIONS: tuple[str, ...] = tuple(
    f"**/{d}/**" for d in sorted(DEFAULT_IGNORED_DIRS)
)

_AUDIT_SECTIONS: tuple[str, ...] = tuple(f"s{i:03d}" for i in range(1, 15))
_AUDIT_SECTIONS: tuple[str, ...] = tuple(f"s{i:03d}" for i in range(1, 15)) + ("s100",)


# Where an audit looks when `bedrock.toml` does not name a file. Consumer
# layouts come first; the bedrock monorepo's own layout is the last resort.
NAV_CONFIG_CANDIDATES: tuple[str, ...] = (
    "frontend/src/components/domain/navigation.ts",
    "frontend/src/navigation.ts",
    "packages/bedrock-ui/src/navigation/navConfig.ts",
)
REQUIREMENTS_CANDIDATES: tuple[str, ...] = (
    "requirements.txt",
    "packages/bedrock-api/requirements.txt",
)
PACKAGE_JSON_CANDIDATES: tuple[str, ...] = (
    "frontend/package.json",
    "package.json",
    "packages/bedrock-ui/package.json",
)


def resolve_candidate_path(
    root: Path, explicit: str | None, candidates: tuple[str, ...]
) -> str | None:
    """An explicit `bedrock.toml` value always wins, even when the file is
    missing, so a typo is reported instead of masked by a fallback. With no
    explicit value, return the first candidate that exists under `root`, or
    None when none does."""
    if explicit is not None:
        return explicit
    return next((c for c in candidates if (root / c).exists()), None)


def _merge_exemptions(consumer_exemptions: list[str]) -> list[str]:
    merged: list[str] = list(_PLATFORM_BASELINE_EXEMPTIONS)
    for item in consumer_exemptions:
        if item not in merged:
            merged.append(item)
    return merged


@dataclass
class AuditS001Config:
    exemptions: list[str] = field(default_factory=list)


@dataclass
class AuditS002Config:
    presentational_tables: list[str] = field(default_factory=list)
    exemptions: list[str] = field(default_factory=list)


@dataclass
class AuditS003Config:
    exemptions: list[str] = field(default_factory=list)


@dataclass
class AuditS004Config:
    config_module: str = "bedrock.core.config"
    exemptions: list[str] = field(default_factory=list)


@dataclass
class AuditS005Config:
    exemptions: list[str] = field(default_factory=list)


@dataclass
class AuditS006Config:
    ledger_files: list[str] = field(default_factory=list)
    exemptions: list[str] = field(default_factory=list)


@dataclass
class AuditS007Config:
    domain_prefixes: list[str] = field(default_factory=list)
    grandfathered_tables: list[str] = field(default_factory=list)
    exemptions: list[str] = field(default_factory=list)


@dataclass
class AuditS008Config:
    guidance_docs: list[str] = field(default_factory=lambda: ["CLAUDE.md", "GEMINI.md"])
    max_lines: int = 200
    allowed_root_docs: list[str] = field(default_factory=list)
    exemptions: list[str] = field(default_factory=list)


@dataclass
class AuditS009Config:
    theme_palettes: str = "packages/bedrock-ui/src/theme/palettes.ts"
    exemptions: list[str] = field(default_factory=list)


@dataclass
class AuditS010Config:
    exemptions: list[str] = field(default_factory=list)


@dataclass
class AuditS011Config:
    nav_config: str | None = None
    exemptions: list[str] = field(default_factory=list)


@dataclass
class AuditS012Config:
    requirements: str | None = None
    package_json: str | None = None
    exemptions: list[str] = field(default_factory=list)


@dataclass
class AuditS013Config:
    doc: str = "docs/guide/api-reference.md"
    prefix: str = "/api/v1"
    app: str = "api.main:app"
    exempt_paths: list[str] = field(default_factory=list)
    exemptions: list[str] = field(default_factory=list)


@dataclass
class AuditS014Config:
    ledger_path: str = "docs/reference/bedrock-issues-to-file.md"
    exemptions: list[str] = field(default_factory=list)


@dataclass
class AuditS100Config:
    exemptions: list[str] = field(default_factory=list)


_SECTION_CLASSES: dict[str, type] = {
    "s001": AuditS001Config,
    "s002": AuditS002Config,
    "s003": AuditS003Config,
    "s004": AuditS004Config,
    "s005": AuditS005Config,
    "s006": AuditS006Config,
    "s007": AuditS007Config,
    "s008": AuditS008Config,
    "s009": AuditS009Config,
    "s010": AuditS010Config,
    "s011": AuditS011Config,
    "s012": AuditS012Config,
    "s013": AuditS013Config,
    "s014": AuditS014Config,
    "s100": AuditS100Config,
}


@dataclass
class BedrockConfig:
    schema_catalog: Path
    grids_dir: Path
    audit_s001: AuditS001Config
    audit_s002: AuditS002Config
    audit_s003: AuditS003Config
    audit_s004: AuditS004Config
    audit_s005: AuditS005Config
    audit_s006: AuditS006Config
    audit_s007: AuditS007Config
    audit_s008: AuditS008Config
    audit_s009: AuditS009Config
    audit_s010: AuditS010Config
    audit_s011: AuditS011Config
    audit_s012: AuditS012Config
    audit_s013: AuditS013Config
    audit_s014: AuditS014Config
    audit_s100: AuditS100Config


def _find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for candidate in (current, *current.parents):
        if (candidate / ".git").exists():
            return candidate
    raise FileNotFoundError(
        f"Could not auto-detect a git repository root above {start}; "
        "pass repo_root explicitly to load_bedrock_config()."
    )


def _build_section(section_key: str, raw_sections: dict) -> Any:
    section_cls = _SECTION_CLASSES[section_key]
    raw_section = raw_sections.get(section_key)

    if raw_section is None:
        kwargs: dict = {"exemptions": _merge_exemptions([])}
        return section_cls(**kwargs)

    if "exemptions" not in raw_section:
        raise ValueError(
            f"[tool.bedrock.audit.{section_key}] is missing a required "
            "`exemptions = [...]` list."
        )

    valid_fields = {f.name for f in fields(section_cls)}
    kwargs = {}
    for key, value in raw_section.items():
        if key in valid_fields:
            kwargs[key] = value
        else:
            logger.warning(
                "Ignoring unrecognized key {key} in [tool.bedrock.audit.{section}]",
                key=key,
                section=section_key,
            )
    kwargs["exemptions"] = _merge_exemptions(list(raw_section["exemptions"]))
    return section_cls(**kwargs)


def load_bedrock_config(repo_root: Path | None = None) -> BedrockConfig:
    """Load and validate `bedrock.toml` from `repo_root` (or the auto-detected
    git repository root when `repo_root` is None)."""
    root = Path(repo_root) if repo_root is not None else _find_repo_root(Path.cwd())

    toml_path = root / "bedrock.toml"
    if not toml_path.exists():
        raise FileNotFoundError(f"No bedrock.toml found at {toml_path}")

    with toml_path.open("rb") as fh:
        data = tomllib.load(fh)

    tool_bedrock = data.get("tool", {}).get("bedrock", {})
    raw_sections = tool_bedrock.get("audit", {})

    section_kwargs = {
        f"audit_{key}": _build_section(key, raw_sections) for key in _AUDIT_SECTIONS
    }

    return BedrockConfig(
        schema_catalog=Path(
            tool_bedrock.get(
                "schema_catalog", "packages/bedrock-api/bedrock/core/schema_catalog.py"
            )
        ),
        grids_dir=Path(
            tool_bedrock.get("grids_dir", "packages/bedrock-ui/src/components/DataGrid")
        ),
        **section_kwargs,
    )
