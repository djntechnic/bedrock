"""Unit tests for the S009-S012 platform audit CLI tools."""
from pathlib import Path

from bedrock.tools import (
    s009_audit_design_tokens,
    audit_s010_security,
    audit_s011_navigation,
    audit_s012_pins,
)


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _write_toml(tmp_path: Path, section: str = "") -> None:
    _write(tmp_path / "bedrock.toml", f"[tool.bedrock]\n{section}")


# ---------------------------------------------------------------------------
# s009_audit_design_tokens
# ---------------------------------------------------------------------------


def test_s009_returns_zero_for_token_based_component(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s009]\nexemptions = []\n")
    _write(
        tmp_path / "packages" / "bedrock-ui" / "src" / "components" / "Card.tsx",
        'export function Card() {\n  return <div className="bg-primary text-foreground" '
        'style={{ boxShadow: "hsl(var(--foreground) / 0.1)" }} />;\n}\n',
    )
    _write(
        tmp_path / "packages" / "bedrock-ui" / "styles" / "tokens.css",
        ":root {\n  --brand-accent: 38 92% 55%;\n}\n",
    )

    assert s009_audit_design_tokens.main(["--root", str(tmp_path)]) == 0


def test_s009_returns_one_on_raw_hex_literal(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s009]\nexemptions = []\n")
    _write(
        tmp_path / "packages" / "bedrock-ui" / "src" / "components" / "Card.tsx",
        'export function Card() {\n  return <div style={{ color: "#f59e0b" }} />;\n}\n',
    )

    assert s009_audit_design_tokens.main(["--root", str(tmp_path)]) == 1


def test_s009_returns_one_on_hardcoded_tailwind_color_utility(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s009]\nexemptions = []\n")
    _write(
        tmp_path / "packages" / "bedrock-ui" / "src" / "components" / "Card.tsx",
        'export function Card() {\n  return <div className="bg-blue-500" />;\n}\n',
    )

    assert s009_audit_design_tokens.main(["--root", str(tmp_path)]) == 1


def test_s009_returns_one_on_wrapped_hsl_css_variable(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s009]\nexemptions = []\n")
    _write(
        tmp_path / "packages" / "bedrock-ui" / "styles" / "tokens.css",
        ":root {\n  --color-accent: hsl(38, 92%, 55%);\n}\n",
    )

    assert s009_audit_design_tokens.main(["--root", str(tmp_path)]) == 1


def test_s009_returns_zero_when_violation_is_exempted(tmp_path: Path):
    _write_toml(
        tmp_path,
        '[tool.bedrock.audit.s009]\nexemptions = ["packages/bedrock-ui/src/components/Card.tsx"]\n',
    )
    _write(
        tmp_path / "packages" / "bedrock-ui" / "src" / "components" / "Card.tsx",
        'export function Card() {\n  return <div style={{ color: "#f59e0b" }} />;\n}\n',
    )

    assert s009_audit_design_tokens.main(["--root", str(tmp_path)]) == 0


def test_s009_returns_two_on_missing_bedrock_toml(tmp_path: Path):
    assert s009_audit_design_tokens.main(["--root", str(tmp_path)]) == 2


# ---------------------------------------------------------------------------
# audit_s010_security
# ---------------------------------------------------------------------------


def test_s010_returns_zero_when_mutating_route_declares_permission(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s010]\nexemptions = []\n")
    _write(
        tmp_path / "bedrock" / "routes" / "users.py",
        "from bedrock.core.security import require_permission\n\n"
        '@router.delete("/admin/users/{user_id}")\n'
        "def delete_user(user_id: int, ctx=Depends(require_permission(\"users:delete\"))):\n"
        "    return user_service.delete(user_id)\n",
    )

    assert audit_s010_security.main(["--root", str(tmp_path)]) == 0


def test_s010_returns_zero_when_mutating_route_declares_current_user(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s010]\nexemptions = []\n")
    _write(
        tmp_path / "bedrock" / "routes" / "users.py",
        '@router.post("/admin/users")\n'
        "def create_user(payload: dict, current_user=Depends(get_current_user)):\n"
        "    return user_service.create(payload)\n",
    )

    assert audit_s010_security.main(["--root", str(tmp_path)]) == 0


def test_s010_returns_one_on_unauthenticated_mutating_route(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s010]\nexemptions = []\n")
    _write(
        tmp_path / "bedrock" / "routes" / "users.py",
        '@router.delete("/admin/users/{user_id}")\n'
        "def delete_user(user_id: int):\n"
        "    return user_service.delete(user_id)\n",
    )

    assert audit_s010_security.main(["--root", str(tmp_path)]) == 1


def test_s010_returns_zero_when_unauthenticated_route_is_exempted(tmp_path: Path):
    _write_toml(
        tmp_path,
        '[tool.bedrock.audit.s010]\nexemptions = ["bedrock/routes/health.py"]\n',
    )
    _write(
        tmp_path / "bedrock" / "routes" / "health.py",
        '@router.post("/health/ping")\n'
        "def ping():\n"
        "    return {\"status\": \"ok\"}\n",
    )

    assert audit_s010_security.main(["--root", str(tmp_path)]) == 0


def test_s010_returns_two_on_missing_bedrock_toml(tmp_path: Path):
    assert audit_s010_security.main(["--root", str(tmp_path)]) == 2


# ---------------------------------------------------------------------------
# audit_s011_navigation
# ---------------------------------------------------------------------------


def test_s011_returns_zero_for_config_driven_navigation(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s011]\nexemptions = []\n")
    _write(
        tmp_path / "packages" / "bedrock-ui" / "src" / "navigation" / "navConfig.ts",
        "export const navConfig = [\n"
        '  { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: "Home", permission: "dashboard:view" },\n'
        "];\n",
    )
    _write(
        tmp_path / "packages" / "bedrock-ui" / "src" / "components" / "AppSidebar.tsx",
        'import { navRegistry } from "@djntechnic/bedrock-ui";\n\n'
        "export function AppSidebar() {\n"
        "  const items = navRegistry.getVisibleItems(currentUser);\n"
        "  return <nav>{items.map((item) => <NavLink key={item.id} to={item.route} />)}</nav>;\n"
        "}\n",
    )

    assert audit_s011_navigation.main(["--root", str(tmp_path)]) == 0


def test_s011_returns_one_on_missing_nav_config(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s011]\nexemptions = []\n")

    assert audit_s011_navigation.main(["--root", str(tmp_path)]) == 1


def test_s011_returns_one_on_incomplete_nav_config_schema(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s011]\nexemptions = []\n")
    _write(
        tmp_path / "packages" / "bedrock-ui" / "src" / "navigation" / "navConfig.ts",
        "export const navConfig = [\n"
        '  { id: "dashboard", label: "Dashboard", path: "/dashboard" },\n'
        "];\n",
    )

    assert audit_s011_navigation.main(["--root", str(tmp_path)]) == 1


def test_s011_returns_one_on_hardcoded_nav_link(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s011]\nexemptions = []\n")
    _write(
        tmp_path / "packages" / "bedrock-ui" / "src" / "navigation" / "navConfig.ts",
        "export const navConfig = [\n"
        '  { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: "Home", permission: "dashboard:view" },\n'
        "];\n",
    )
    _write(
        tmp_path / "packages" / "bedrock-ui" / "src" / "components" / "AppSidebar.tsx",
        "export function AppSidebar() {\n"
        '  return <nav><a href="/dashboard">Dashboard</a></nav>;\n'
        "}\n",
    )

    assert audit_s011_navigation.main(["--root", str(tmp_path)]) == 1


def test_s011_returns_zero_when_hardcoded_link_is_exempted(tmp_path: Path):
    _write_toml(
        tmp_path,
        '[tool.bedrock.audit.s011]\nexemptions = ['
        '"packages/bedrock-ui/src/components/AppSidebar.tsx"]\n',
    )
    _write(
        tmp_path / "packages" / "bedrock-ui" / "src" / "navigation" / "navConfig.ts",
        "export const navConfig = [\n"
        '  { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: "Home", permission: "dashboard:view" },\n'
        "];\n",
    )
    _write(
        tmp_path / "packages" / "bedrock-ui" / "src" / "components" / "AppSidebar.tsx",
        "export function AppSidebar() {\n"
        '  return <nav><a href="/dashboard">Dashboard</a></nav>;\n'
        "}\n",
    )

    assert audit_s011_navigation.main(["--root", str(tmp_path)]) == 0


def test_s011_returns_two_on_missing_bedrock_toml(tmp_path: Path):
    assert audit_s011_navigation.main(["--root", str(tmp_path)]) == 2


# ---------------------------------------------------------------------------
# audit_s012_pins
# ---------------------------------------------------------------------------


_S012_TOML_SECTION = (
    '[tool.bedrock.audit.s012]\nrequirements = "requirements.txt"\n'
    'package_json = "package.json"\nexemptions = []\n'
)


def test_s012_returns_zero_when_pins_match(tmp_path: Path):
    _write_toml(tmp_path, _S012_TOML_SECTION)
    _write(
        tmp_path / "requirements.txt",
        "bedrock-api @ git+https://github.com/djntechnic/bedrock@v0.10.0"
        "#subdirectory=packages/bedrock-api\n",
    )
    _write(
        tmp_path / "package.json",
        '{\n  "dependencies": {\n'
        '    "@djntechnic/bedrock-ui": "github:djntechnic/bedrock#v0.10.0"\n'
        "  }\n}\n",
    )

    assert audit_s012_pins.main(["--root", str(tmp_path)]) == 0


def test_s012_returns_one_when_pins_diverge(tmp_path: Path):
    _write_toml(tmp_path, _S012_TOML_SECTION)
    _write(
        tmp_path / "requirements.txt",
        "bedrock-api @ git+https://github.com/djntechnic/bedrock@v0.10.0"
        "#subdirectory=packages/bedrock-api\n",
    )
    _write(
        tmp_path / "package.json",
        '{\n  "dependencies": {\n'
        '    "@djntechnic/bedrock-ui": "github:djntechnic/bedrock#v0.9.2"\n'
        "  }\n}\n",
    )

    assert audit_s012_pins.main(["--root", str(tmp_path)]) == 1


def test_s012_returns_one_on_non_tag_ref(tmp_path: Path):
    _write_toml(tmp_path, _S012_TOML_SECTION)
    _write(
        tmp_path / "requirements.txt",
        "bedrock-api @ git+https://github.com/djntechnic/bedrock@master"
        "#subdirectory=packages/bedrock-api\n",
    )
    _write(
        tmp_path / "package.json",
        '{\n  "dependencies": {\n'
        '    "@djntechnic/bedrock-ui": "github:djntechnic/bedrock#master"\n'
        "  }\n}\n",
    )

    assert audit_s012_pins.main(["--root", str(tmp_path)]) == 1


_S012_SELF_REPO_TOML_SECTION = (
    '[tool.bedrock.audit.s012]\npackage_json = "package.json"\nexemptions = []\n'
)


def test_s012_returns_zero_for_matching_self_repo_versions(tmp_path: Path):
    _write_toml(tmp_path, _S012_SELF_REPO_TOML_SECTION)
    _write(
        tmp_path / "packages" / "bedrock-api" / "pyproject.toml",
        '[project]\nname = "bedrock-api"\nversion = "0.10.0"\n',
    )
    _write(tmp_path / "package.json", '{\n  "name": "@djntechnic/bedrock-ui",\n  "version": "0.10.0"\n}\n')

    assert audit_s012_pins.main(["--root", str(tmp_path)]) == 0


def test_s012_returns_one_for_mismatched_self_repo_versions(tmp_path: Path):
    _write_toml(tmp_path, _S012_SELF_REPO_TOML_SECTION)
    _write(
        tmp_path / "packages" / "bedrock-api" / "pyproject.toml",
        '[project]\nname = "bedrock-api"\nversion = "0.10.0"\n',
    )
    _write(tmp_path / "package.json", '{\n  "name": "@djntechnic/bedrock-ui",\n  "version": "0.9.2"\n}\n')

    assert audit_s012_pins.main(["--root", str(tmp_path)]) == 1


def test_s012_returns_zero_when_divergence_is_exempted(tmp_path: Path):
    _write_toml(
        tmp_path,
        '[tool.bedrock.audit.s012]\nrequirements = "requirements.txt"\n'
        'package_json = "package.json"\nexemptions = ["package.json"]\n',
    )
    _write(
        tmp_path / "requirements.txt",
        "bedrock-api @ git+https://github.com/djntechnic/bedrock@v0.10.0"
        "#subdirectory=packages/bedrock-api\n",
    )
    _write(
        tmp_path / "package.json",
        '{\n  "dependencies": {\n'
        '    "@djntechnic/bedrock-ui": "github:djntechnic/bedrock#v0.9.2"\n'
        "  }\n}\n",
    )

    assert audit_s012_pins.main(["--root", str(tmp_path)]) == 0


def test_s012_returns_two_on_missing_bedrock_toml(tmp_path: Path):
    assert audit_s012_pins.main(["--root", str(tmp_path)]) == 2
