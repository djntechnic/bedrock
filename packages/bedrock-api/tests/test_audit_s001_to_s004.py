"""Unit tests for the S001-S004 platform audit CLI tools."""
from pathlib import Path

from bedrock.tools import (
    audit_s001_duplicates,
    audit_s002_grids,
    audit_s003_logging,
    audit_s004_config,
)


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _write_toml(tmp_path: Path, section: str = "") -> None:
    _write(tmp_path / "bedrock.toml", f"[tool.bedrock]\n{section}")


# ---------------------------------------------------------------------------
# audit_s001_duplicates
# ---------------------------------------------------------------------------


def test_s001_returns_zero_when_no_duplicates(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s001]\nexemptions = []\n")
    _write(tmp_path / "components" / "Button.tsx", "export function Button() { return null; }")
    _write(tmp_path / "components" / "Input.tsx", "export function Input() { return null; }")

    assert audit_s001_duplicates.main(["--root", str(tmp_path)]) == 0


def test_s001_returns_zero_when_duplicate_is_exempted(tmp_path: Path):
    _write_toml(
        tmp_path,
        "[tool.bedrock.audit.s001]\nexemptions = [\"legacy/*.tsx\"]\n",
    )
    _write(tmp_path / "components" / "Button.tsx", "export function Button() { return null; }")
    _write(tmp_path / "legacy" / "Button.tsx", "export function Button() { return null; }")

    assert audit_s001_duplicates.main(["--root", str(tmp_path)]) == 0


def test_s001_returns_one_on_unexempted_twin_component(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s001]\nexemptions = []\n")
    _write(tmp_path / "components" / "Button.tsx", "export function Button() { return null; }")
    _write(tmp_path / "pages" / "Button.tsx", "export function Button() { return null; }")

    assert audit_s001_duplicates.main(["--root", str(tmp_path)]) == 1


def test_s001_returns_two_on_missing_bedrock_toml(tmp_path: Path):
    assert audit_s001_duplicates.main(["--root", str(tmp_path)]) == 2


# ---------------------------------------------------------------------------
# audit_s002_grids
# ---------------------------------------------------------------------------


def test_s002_returns_zero_when_grid_consumes_use_grid_config(tmp_path: Path):
    _write_toml(
        tmp_path,
        "[tool.bedrock.audit.s002]\npresentational_tables = []\nexemptions = []\n",
    )
    _write(
        tmp_path / "components" / "PlayerGrid.tsx",
        """
        import { DataGrid, useGridConfig } from "@djntechnic/bedrock-ui";
        export function PlayerGrid() {
          const config = useGridConfig("player_grid");
          return <DataGrid gridId="player_grid" />;
        }
        """,
    )

    assert audit_s002_grids.main(["--root", str(tmp_path)]) == 0


def test_s002_respects_presentational_tables_exemption(tmp_path: Path):
    _write_toml(
        tmp_path,
        '[tool.bedrock.audit.s002]\npresentational_tables = ["components/ReadOnlyReport.tsx"]\nexemptions = []\n',
    )
    _write(
        tmp_path / "components" / "ReadOnlyReport.tsx",
        "export function ReadOnlyReport() { return <table><tbody /></table>; }",
    )

    assert audit_s002_grids.main(["--root", str(tmp_path)]) == 0


def test_s002_returns_one_on_unexempted_raw_table(tmp_path: Path):
    _write_toml(
        tmp_path,
        "[tool.bedrock.audit.s002]\npresentational_tables = []\nexemptions = []\n",
    )
    _write(
        tmp_path / "components" / "RawReport.tsx",
        "export function RawReport() { return <table><tbody /></table>; }",
    )

    assert audit_s002_grids.main(["--root", str(tmp_path)]) == 1


def test_s002_returns_one_on_grid_missing_use_grid_config(tmp_path: Path):
    _write_toml(
        tmp_path,
        "[tool.bedrock.audit.s002]\npresentational_tables = []\nexemptions = []\n",
    )
    _write(
        tmp_path / "components" / "PlayerGrid.tsx",
        """
        import { DataGrid } from "@djntechnic/bedrock-ui";
        export function PlayerGrid() {
          return <DataGrid gridId="player_grid" />;
        }
        """,
    )

    assert audit_s002_grids.main(["--root", str(tmp_path)]) == 1


def test_s002_returns_two_on_missing_bedrock_toml(tmp_path: Path):
    assert audit_s002_grids.main(["--root", str(tmp_path)]) == 2


# ---------------------------------------------------------------------------
# audit_s003_logging
# ---------------------------------------------------------------------------


def test_s003_returns_zero_when_structured_logging_used(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s003]\nexemptions = []\n")
    _write(
        tmp_path / "components" / "Grid.tsx",
        'import { log } from "@djntechnic/bedrock-ui";\nlog.info({ gridId }, "loaded");\n',
    )
    _write(
        tmp_path / "services" / "pipeline.py",
        "from loguru import logger\n\nlogger.info('pipeline started')\n",
    )

    assert audit_s003_logging.main(["--root", str(tmp_path)]) == 0


def test_s003_returns_one_on_bare_console_call(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s003]\nexemptions = []\n")
    _write(
        tmp_path / "components" / "Grid.tsx",
        'console.log("loaded grid " + gridId);\n',
    )

    assert audit_s003_logging.main(["--root", str(tmp_path)]) == 1


def test_s003_returns_one_on_bare_print_call(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s003]\nexemptions = []\n")
    _write(tmp_path / "services" / "pipeline.py", "print('pipeline started')\n")

    assert audit_s003_logging.main(["--root", str(tmp_path)]) == 1


def test_s003_exempts_configured_paths(tmp_path: Path):
    _write_toml(
        tmp_path,
        '[tool.bedrock.audit.s003]\nexemptions = ["scripts/**"]\n',
    )
    _write(tmp_path / "scripts" / "one_off.py", "print('human-readable status')\n")

    assert audit_s003_logging.main(["--root", str(tmp_path)]) == 0


def test_s003_returns_two_on_missing_bedrock_toml(tmp_path: Path):
    assert audit_s003_logging.main(["--root", str(tmp_path)]) == 2


# ---------------------------------------------------------------------------
# audit_s004_config
# ---------------------------------------------------------------------------


def test_s004_returns_zero_when_config_surface_used(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s004]\nexemptions = []\n")
    _write(
        tmp_path / "services" / "settings.py",
        "from bedrock.core.database import db\n\nlive_cycle = db.get_config('live_cycle', 2026)\n",
    )

    assert audit_s004_config.main(["--root", str(tmp_path)]) == 0


def test_s004_returns_one_on_raw_os_environ(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s004]\nexemptions = []\n")
    _write(
        tmp_path / "services" / "settings.py",
        "import os\n\nlive_cycle = int(os.environ.get('LIVE_CYCLE', '2026'))\n",
    )

    assert audit_s004_config.main(["--root", str(tmp_path)]) == 1


def test_s004_returns_one_on_hardcoded_secret(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s004]\nexemptions = []\n")
    _write(
        tmp_path / "services" / "settings.py",
        'API_SECRET_KEY = "sk-hardcoded-value"\n',
    )

    assert audit_s004_config.main(["--root", str(tmp_path)]) == 1


def test_s004_exempts_configured_paths(tmp_path: Path):
    _write_toml(
        tmp_path,
        '[tool.bedrock.audit.s004]\nexemptions = ["deploy/**"]\n',
    )
    _write(
        tmp_path / "deploy" / "entrypoint.py",
        "import os\n\nport = os.environ.get('PORT', '8000')\n",
    )

    assert audit_s004_config.main(["--root", str(tmp_path)]) == 0


def test_s004_returns_two_on_missing_bedrock_toml(tmp_path: Path):
    assert audit_s004_config.main(["--root", str(tmp_path)]) == 2
