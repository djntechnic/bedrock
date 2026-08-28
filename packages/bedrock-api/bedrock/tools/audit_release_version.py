"""
Module:  audit_release_version.py
Layer:   bedrock/tools
Desc:    Release-time gate that a tag being cut actually matches the version
         each distributable declares.

         bedrock ships two distributables from one repo - `bedrock-api`
         (`packages/bedrock-api/pyproject.toml`) and the npm package the repo
         root's own `package.json` describes (`@djntechnic/bedrock-ui`,
         installed by consumers as `github:djntechnic/bedrock#<tag>`, which is
         why the *root* manifest is the one that matters, not one nested under
         `packages/bedrock-ui`).

         `v0.6.0` through `v0.8.0` all shipped declaring `0.6.2` in both
         manifests, because nothing tied the tag being cut to the version
         those files carry. That is not cosmetic: pip resolves an upgrade by
         version, not by git ref, so re-pinning a consumer's requirements.txt
         from one stale-matching tag to another and running `pip install
         --upgrade` exits 0 and installs nothing - the two distributions
         report the same version, so pip sees no upgrade to perform. A fresh
         CI runner has nothing installed yet, so it always resolves the right
         code and never catches the drift; only a developer's or a deploy
         host's already-populated environment goes stale silently. See
         bedrock#56.

         This script is the check that closes that gap: given the tag about
         to be pushed, read both manifests, parse their declared version, and
         fail loudly - naming both the expected and the found value for each
         manifest - the moment either one disagrees. A manifest this cannot
         find or cannot parse is also a failure, not a silent pass: a check
         that reports clean on a file it never read is the exact shape of the
         defect this whole mechanism exists to catch.

Usage:   python -m bedrock.tools.audit_release_version v0.8.1
         python -m bedrock.tools.audit_release_version 0.8.1
         python -m bedrock.tools.audit_release_version v0.8.1 --repo-root .
"""
from __future__ import annotations

import argparse
import pathlib
import re

from loguru import logger

#: Relative to --repo-root. The repo-root package.json is the npm manifest
#: consumers actually install (see module docstring) - not any file nested
#: under packages/bedrock-ui.
_NPM_MANIFEST = pathlib.Path("package.json")
_PYTHON_MANIFEST = pathlib.Path("packages/bedrock-api/pyproject.toml")

# `"version": "0.8.1"` - tolerant of whitespace, not of a different key on the
# same line.
_NPM_VERSION_RE = re.compile(r'"version"\s*:\s*"([^"]+)"')
# `version = "0.8.1"` under [project] - pyproject.toml's TOML syntax, matched
# directly rather than pulling in a TOML parser for one field.
_PY_VERSION_RE = re.compile(r'^version\s*=\s*"([^"]+)"', re.M)


class ManifestError(Exception):
    """A manifest could not be found or its version could not be parsed.

    Distinct from a version mismatch: this is the false-negative shape the
    whole gate exists to eliminate, so it is never treated as a pass.
    """


def _read_npm_version(path: pathlib.Path) -> str:
    if not path.is_file():
        raise ManifestError(f"{path} does not exist - cannot read npm version")
    text = path.read_text(encoding="utf-8")
    match = _NPM_VERSION_RE.search(text)
    if match is None:
        raise ManifestError(f"{path} has no parseable \"version\" field")
    return match.group(1)


def _read_python_version(path: pathlib.Path) -> str:
    if not path.is_file():
        raise ManifestError(f"{path} does not exist - cannot read python version")
    text = path.read_text(encoding="utf-8")
    match = _PY_VERSION_RE.search(text)
    if match is None:
        raise ManifestError(f"{path} has no parseable version = \"...\" field")
    return match.group(1)


def audit(repo_root: pathlib.Path, tag: str) -> list[str]:
    """Check both manifests' declared version against `tag`.

    `tag` may carry a leading `v` (`v0.8.1`) or not (`0.8.1`); only the digits
    are compared. Returns a list of failure strings - empty means both
    manifests agree with the tag. A manifest that cannot be found or parsed
    is reported as its own failure rather than being skipped, so this never
    reports clean on a check it never actually ran.
    """
    expected = tag[1:] if tag.startswith(("v", "V")) else tag
    failures: list[str] = []

    npm_path = repo_root / _NPM_MANIFEST
    try:
        found = _read_npm_version(npm_path)
    except ManifestError as exc:
        failures.append(str(exc))
    else:
        if found != expected:
            failures.append(
                f"{npm_path}: expected version {expected!r} (from tag "
                f"{tag!r}), found {found!r}"
            )

    py_path = repo_root / _PYTHON_MANIFEST
    try:
        found = _read_python_version(py_path)
    except ManifestError as exc:
        failures.append(str(exc))
    else:
        if found != expected:
            failures.append(
                f"{py_path}: expected version {expected!r} (from tag "
                f"{tag!r}), found {found!r}"
            )

    return failures


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "tag", help="the tag being cut, e.g. v0.8.1 (a leading 'v' is stripped)"
    )
    parser.add_argument("--repo-root", default=".", help="repository root")
    args = parser.parse_args(argv)

    repo_root = pathlib.Path(args.repo_root).resolve()
    failures = audit(repo_root, args.tag)

    for failure in failures:
        logger.error(failure)

    if not failures:
        logger.info(
            "OK - both manifests declare {} for tag {}.",
            args.tag[1:] if args.tag.startswith(("v", "V")) else args.tag,
            args.tag,
        )

    return 1 if failures else 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
