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
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

if sys.version_info >= (3, 11):
    import tomllib
else:  # pragma: no cover - project requires Python 3.11+
    import tomli as tomllib

# Paths every audit tool ignores regardless of what a consumer declares.
_PLATFORM_BASELINE_EXEMPTIONS: tuple[str, ...] = (
    "**/node_modules/**",
    "**/__pycache__/**",
    "**/.venv/**",
)

_AUDIT_SECTIONS: tuple[str, ...] = tuple(f"s{i:03d}" for i in range(1, 13))


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
    exemptions: list[str] = field(default_factory=list)


@dataclass
class AuditS007Config:
    exemptions: list[str] = field(default_factory=list)


@dataclass
class AuditS008Config:
    guidance_docs: list[str] = field(default_factory=lambda: ["CLAUDE.md", "GEMINI.md"])
    max_lines: int = 200
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
    nav_config: str = "packages/bedrock-ui/src/navigation/navConfig.ts"
    exemptions: list[str] = field(default_factory=list)


@dataclass
class AuditS012Config:
    requirements: str = "packages/bedrock-api/requirements.txt"
    package_json: str = "packages/bedrock-ui/package.json"
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

    kwargs = dict(raw_section)
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
