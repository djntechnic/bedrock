#!/usr/bin/env python
"""
Module:  check_encoding_hygiene.py
Layer:   scripts
Desc:    Fast byte-level scanner for UTF-8 Byte Order Mark (BOM) and unapproved
         CRLF line endings across tracked repository files.

Contract:
  - Text files must use UTF-8 without BOM (0xEF 0xBB 0xBF).
  - Text files must use Unix LF (0x0A) line endings.
  - Approved CRLF exceptions: .bat, .cmd.
  - Approved BOM exceptions: .sln.
  - Binary files ignored: .png, .jpg, .jpeg, .gif, .ico, .webp, .woff, .woff2,
    .zip, .gz, .tar, .wasm, .exe, .dll, .pdf, .xlsx.

Exit codes:
  0 - Clean. All tracked files passed validation.
  1 - Violations detected or fatal scan error.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

BINARY_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".webp",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    ".zip",
    ".gz",
    ".tar",
    ".wasm",
    ".exe",
    ".dll",
    ".pdf",
    ".xlsx",
}

APPROVED_CRLF_EXTENSIONS = {".bat", ".cmd"}
APPROVED_BOM_EXTENSIONS = {".sln"}


def scan_file(path: Path) -> list[str]:
    """Inspect raw bytes of a file for UTF-8 BOM and unapproved CRLF line endings.

    Returns:
        List of violation descriptions. Empty if compliant or ignored.
    """
    path = Path(path)
    suffix = path.suffix.lower()

    if suffix in BINARY_EXTENSIONS:
        return []

    if not path.is_file():
        return []

    try:
        data = path.read_bytes()
    except OSError as err:
        return [f"error reading file: {err}"]

    violations: list[str] = []

    if data.startswith(b"\xef\xbb\xbf") and suffix not in APPROVED_BOM_EXTENSIONS:
        violations.append("contains UTF-8 BOM")

    if b"\r\n" in data and suffix not in APPROVED_CRLF_EXTENSIONS:
        violations.append("contains CRLF line endings")

    return violations


def main(argv: list[str] | None = None) -> int:
    """Scan tracked repository files for encoding and line-ending hygiene.

    If argv is None or empty, queries `git ls-files -z` at the repository root.
    """
    parser = argparse.ArgumentParser(
        description="Fast byte-level scanner for UTF-8 BOM and unapproved CRLF line endings."
    )
    parser.add_argument(
        "files",
        nargs="*",
        type=Path,
        help="Optional specific files to scan. If omitted, all tracked git files are scanned.",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=REPO_ROOT,
        help="Repository root directory. Defaults to bedrock-ai-kit root.",
    )

    args = parser.parse_args(argv if argv is not None else [])

    root = args.root.resolve()

    if args.files:
        paths = [root / f if not f.is_absolute() else f for f in args.files]
    else:
        try:
            proc = subprocess.run(
                ["git", "ls-files", "-z"],
                cwd=root,
                capture_output=True,
                check=True,
            )
            raw_paths = proc.stdout.split(b"\0")
            paths = [root / p.decode("utf-8") for p in raw_paths if p]
        except (subprocess.SubprocessError, OSError) as err:
            print(f"Error querying git ls-files: {err}", file=sys.stderr)
            return 1

    violation_count = 0

    for file_path in paths:
        if not file_path.is_file():
            continue

        file_violations = scan_file(file_path)
        if file_violations:
            try:
                rel_path = file_path.relative_to(root).as_posix()
            except ValueError:
                rel_path = file_path.as_posix()

            for v in file_violations:
                print(f"{rel_path}: {v}")
                violation_count += 1

    if violation_count > 0:
        return 1

    print("All tracked files passed UTF-8 (no BOM) and LF checks.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
