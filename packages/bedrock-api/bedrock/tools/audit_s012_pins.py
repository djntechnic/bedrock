"""
Module:  audit_s012_pins.py
Layer:   bedrock/tools
Desc:    Enforcement for [S012-dual-pin-platform-governance](../../../../docs/standards/s012-dual-pin-platform-governance.md).

         Two modes:
           1. Consumer mode - `requirements.txt` pins `bedrock-api @ git+...@<tag>`
              and `package.json` pins `@djntechnic/bedrock-ui` to
              `github:djntechnic/bedrock#<tag>`. The two tags must be
              byte-identical, and each must be a release tag (`vMAJOR.MINOR.PATCH`)
              rather than a branch name or raw SHA.
           2. Self-repo mode - run against bedrock itself, where there is no
              `bedrock-api @ git+...` line to extract a tag from. Instead
              `packages/bedrock-api/pyproject.toml`'s `version` and the root
              `package.json`'s `version` must match exactly.

         Exit 0 clean, 1 on a violation, 2 on a configuration error.

Usage:   python -m bedrock.tools.audit_s012_pins --root .
"""
from __future__ import annotations

import argparse
import fnmatch
import re
from dataclasses import dataclass
from pathlib import Path

from bedrock.tools._config import load_bedrock_config
from bedrock.tools._reporter import AuditReporter

_REQUIREMENTS_TAG = re.compile(r"bedrock-api\s*@\s*git\+[^@]+@([^#\s]+)#subdirectory=")
_PACKAGE_JSON_TAG = re.compile(r'"@djntechnic/bedrock-ui"\s*:\s*"github:djntechnic/bedrock#([^"]+)"')
_PACKAGE_JSON_VERSION = re.compile(r'"version"\s*:\s*"([^"]+)"')
_PYPROJECT_VERSION = re.compile(r'(?m)^version\s*=\s*"([^"]+)"')

_RELEASE_TAG = re.compile(r"^v\d+\.\d+\.\d+$")


@dataclass
class PinViolation:
    message: str


def _is_exempt(rel_path: str, exemptions: list[str]) -> bool:
    return any(fnmatch.fnmatch(rel_path, pattern) for pattern in exemptions)


def _audit_consumer_mode(
    requirements_text: str, package_json_text: str
) -> list[PinViolation]:
    api_match = _REQUIREMENTS_TAG.search(requirements_text)
    ui_match = _PACKAGE_JSON_TAG.search(package_json_text)

    if api_match is None or ui_match is None:
        return [PinViolation("could not resolve a bedrock tag from requirements.txt/package.json")]

    api_tag, ui_tag = api_match.group(1), ui_match.group(1)

    violations: list[PinViolation] = []
    for label, tag in (("bedrock-api", api_tag), ("@djntechnic/bedrock-ui", ui_tag)):
        if not _RELEASE_TAG.match(tag):
            violations.append(
                PinViolation(
                    f"{label} pins `{tag}`, which is not a release tag "
                    "(expected vMAJOR.MINOR.PATCH) - branches, raw SHAs, and "
                    "loose ranges are not allowed"
                )
            )

    if api_tag != ui_tag:
        violations.append(
            PinViolation(
                f"dual-pin divergence: requirements.txt pins `{api_tag}`, "
                f"package.json pins `{ui_tag}`"
            )
        )

    return violations


def _audit_self_repo_mode(pyproject_text: str, package_json_text: str) -> list[PinViolation]:
    pyproject_match = _PYPROJECT_VERSION.search(pyproject_text)
    package_match = _PACKAGE_JSON_VERSION.search(package_json_text)

    if pyproject_match is None or package_match is None:
        return [PinViolation("could not resolve a version from pyproject.toml/package.json")]

    api_version, ui_version = pyproject_match.group(1), package_match.group(1)
    if api_version != ui_version:
        return [
            PinViolation(
                f"dual-pin divergence: packages/bedrock-api/pyproject.toml is "
                f"`{api_version}`, package.json is `{ui_version}`"
            )
        ]
    return []


def audit(
    root: Path, requirements_rel: str, package_json_rel: str, exemptions: list[str]
) -> list[PinViolation]:
    if _is_exempt(requirements_rel, exemptions) or _is_exempt(package_json_rel, exemptions):
        return []

    requirements_path = root / requirements_rel
    package_json_path = root / package_json_rel
    pyproject_path = root / "packages" / "bedrock-api" / "pyproject.toml"

    if requirements_path.exists():
        requirements_text = requirements_path.read_text(encoding="utf-8", errors="replace")
        if _REQUIREMENTS_TAG.search(requirements_text) and package_json_path.exists():
            package_json_text = package_json_path.read_text(encoding="utf-8", errors="replace")
            return _audit_consumer_mode(requirements_text, package_json_text)

    if pyproject_path.exists() and package_json_path.exists():
        pyproject_text = pyproject_path.read_text(encoding="utf-8", errors="replace")
        package_json_text = package_json_path.read_text(encoding="utf-8", errors="replace")
        return _audit_self_repo_mode(pyproject_text, package_json_text)

    return [
        PinViolation(
            "could not find a resolvable dual-pin source: neither a "
            "bedrock-api git+ pin in requirements.txt nor "
            "packages/bedrock-api/pyproject.toml + package.json were found"
        )
    ]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository/source root to scan")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    reporter = AuditReporter("S012", "Dual-Pin Platform Governance", root, root / "bedrock.toml")

    reporter.start_check("Loading bedrock.toml configuration")
    try:
        config = load_bedrock_config(root)
    except (FileNotFoundError, ValueError) as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()
    reporter.pass_check()

    violations = audit(
        root,
        config.audit_s012.requirements,
        config.audit_s012.package_json,
        config.audit_s012.exemptions,
    )
    if violations:
        for violation in violations:
            reporter.start_check("Checking dual-pin lockstep governance")
            reporter.fail_check(violation.message)
    else:
        reporter.start_check("Checking dual-pin lockstep governance")
        reporter.pass_check("bedrock-api and @djntechnic/bedrock-ui pins are in lockstep")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
