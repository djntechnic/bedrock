"""Tests for the §S1 no-duplicate-UI-code gate."""
import json
import pathlib

import pytest

from bedrock.tools import audit_s1_duplicates as gate


def _make_package(tmp_path: pathlib.Path, exports: list[str]) -> None:
    """Build a fake `@scope/pkg` under tmp_path/frontend/node_modules.

    Mirrors the real bedrock-ui layout closely enough to exercise the
    `package.json` `exports["."]` resolution: a scoped package directory
    with a manifest pointing at a `src/index.ts` barrel that declares the
    given export names.
    """
    package_dir = tmp_path / "frontend" / "node_modules" / "@scope" / "pkg"
    src_dir = package_dir / "src"
    src_dir.mkdir(parents=True)

    (package_dir / "package.json").write_text(
        json.dumps({"name": "@scope/pkg", "exports": {".": "./src/index.ts"}}),
        encoding="utf-8",
    )

    barrel_body = "\n".join(f"export const {name} = 1;" for name in exports)
    (src_dir / "index.ts").write_text(barrel_body, encoding="utf-8")


def _write(tmp_path: pathlib.Path, rel: str, content: str) -> pathlib.Path:
    path = tmp_path / "frontend" / "src" / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def _run(tmp_path: pathlib.Path) -> list[str]:
    return gate.audit(
        repo_root=tmp_path,
        source_root=pathlib.Path("frontend/src"),
        collision_roots=[
            pathlib.Path("frontend/src/components"),
            pathlib.Path("frontend/src/pages"),
        ],
        package="@scope/pkg",
    )


def _seed_minimum(tmp_path: pathlib.Path) -> None:
    """A tree that already satisfies rules 2 (exactly one owner each)."""
    _write(tmp_path, "hooks/queryKeys.ts", "export const queryKeys = {};\n")
    _write(tmp_path, "api/routes.ts", "export const API_ROUTES = {};\n")


def test_a_clean_tree_produces_no_findings(tmp_path):
    """The baseline: nothing collides, one factory, one route map, no axios."""
    _make_package(tmp_path, ["Button"])
    _seed_minimum(tmp_path)
    _write(tmp_path, "components/Card.tsx", "export const Card = () => null;\n")

    assert _run(tmp_path) == []


def test_a_colliding_component_is_a_finding(tmp_path):
    """A local component with the same name as a platform export is the
    exact defect this gate exists to catch: an accidental twin."""
    _make_package(tmp_path, ["Button"])
    _seed_minimum(tmp_path)
    _write(tmp_path, "components/Button.tsx", "export const Button = () => null;\n")

    problems = _run(tmp_path)
    assert any("Button" in p for p in problems)


def test_a_shadows_marker_exempts_the_named_collision(tmp_path):
    """§S1 option 3: a deliberate fork, declared with `@shadows <Name>`, is
    not the same thing as an accidental twin and must not be flagged."""
    _make_package(tmp_path, ["Button"])
    _seed_minimum(tmp_path)
    _write(
        tmp_path,
        "components/Button.tsx",
        "// @shadows Button - deliberate fork, see PR #1\n"
        "export const Button = () => null;\n",
    )

    assert _run(tmp_path) == []


def test_a_shadows_marker_for_a_different_name_does_not_exempt(tmp_path):
    """A marker only exempts the name it names — otherwise any comment
    anywhere would silence every collision in the file."""
    _make_package(tmp_path, ["Button"])
    _seed_minimum(tmp_path)
    _write(
        tmp_path,
        "components/Button.tsx",
        "// @shadows Card - unrelated fork\n"
        "export const Button = () => null;\n",
    )

    problems = _run(tmp_path)
    assert any("Button" in p for p in problems)


def test_two_query_keys_declarations_is_a_finding(tmp_path):
    """Two query-key factories is the same defect as a duplicate component,
    wearing a different hat."""
    _make_package(tmp_path, [])
    _write(tmp_path, "hooks/queryKeys.ts", "export const queryKeys = {};\n")
    _write(tmp_path, "hooks/queryKeys2.ts", "export const queryKeys = {};\n")
    _write(tmp_path, "api/routes.ts", "export const API_ROUTES = {};\n")

    problems = _run(tmp_path)
    assert any("queryKeys" in p for p in problems)


def test_zero_query_keys_declarations_is_a_finding(tmp_path):
    """There must be exactly one factory — zero is also wrong, not just two."""
    _make_package(tmp_path, [])
    _write(tmp_path, "api/routes.ts", "export const API_ROUTES = {};\n")

    problems = _run(tmp_path)
    assert any("queryKeys" in p for p in problems)


def test_two_api_routes_declarations_is_a_finding(tmp_path):
    """Same rule, the route-map half."""
    _make_package(tmp_path, [])
    _write(tmp_path, "hooks/queryKeys.ts", "export const queryKeys = {};\n")
    _write(tmp_path, "api/routesA.ts", "export const API_ROUTES = {};\n")
    _write(tmp_path, "api/routesB.ts", "export const API_ROUTES = {};\n")

    problems = _run(tmp_path)
    assert any("API_ROUTES" in p for p in problems)


def test_a_direct_axios_import_is_a_finding(tmp_path):
    """A bare axios import bypasses the platform's apiClient (base URL, auth
    header, refresh interceptor) silently — that is worth flagging on its
    own, unconditional on the other two rules."""
    _make_package(tmp_path, [])
    _seed_minimum(tmp_path)
    _write(
        tmp_path,
        "api/legacy.ts",
        'import axios from "axios";\nexport const fetchThing = () => axios.get("/x");\n',
    )

    problems = _run(tmp_path)
    assert any("axios" in p for p in problems)


def test_a_missing_package_raises_a_resolution_error_not_a_false_clean(tmp_path):
    """An uninstalled or unresolvable bedrock-ui package must surface as an
    environment error, never silently pass the audit as if nothing exists to
    collide with — that would make `npm install` failing look like success."""
    _seed_minimum(tmp_path)

    with pytest.raises(gate.PackageResolutionError):
        _run(tmp_path)
