"""
Module:  s009_audit_design_tokens.py
Layer:   bedrock/tools
Desc:    Enforcement for [S009-design-system](../../../../docs/standards/s009-design-system.md).

         Three checks:
           1. Raw color literals - no hex/rgb/rgba/bare-hsl-or-hsla literal
              value in `.tsx`/`.ts`/`.css` source outside `tokens.css` itself,
              the declared `theme_palettes` source-of-truth file, or an
              exempted path/literal.
           2. Hardcoded Tailwind color utilities - `bg-blue-500`,
              `text-red-600`, etc. bypass the semantic role tokens
              (`bg-primary`, `text-destructive`) they were meant to replace.
           3. Bare HSL triplets - every custom property in `tokens.css` is a
              bare `H S% L%` triplet, not wrapped in `hsl(...)`, so consumers
              can apply an opacity modifier (`hsl(var(--x) / 0.5)`).

         Vendored/generated asset directories (`data/`, `imports/`, `exports/`)
         are not scanned - they hold third-party CSS and report output, not
         authored source.

         Exit 0 clean, 1 on a violation, 2 on a configuration error.

Usage:   python -m bedrock.tools.s009_audit_design_tokens --root .
"""
from __future__ import annotations

import argparse
import fnmatch
import re
from dataclasses import dataclass
from pathlib import Path

from bedrock.tools._config import (
    DEFAULT_IGNORED_DIRS,
    iter_source_files,
    load_bedrock_config,
)
from bedrock.tools._reporter import AuditReporter

_HEX_LITERAL = re.compile(r"#(?:[0-9a-fA-F]{3,4}){1,2}\b")
_RGB_LITERAL = re.compile(r"\brgba?\(")
# hsl(var(--x)) / hsla(var(--x) / 0.5) resolve through a token and are allowed;
# a literal hsl(210, 40%, 50%) is not.
_HSL_LITERAL = re.compile(r"\bhsla?\(\s*(?!var\()")

_TAILWIND_HUES = (
    "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
    "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink",
    "rose", "gray", "grey", "slate", "zinc", "neutral", "stone",
)
_TAILWIND_COLOR_UTILITY = re.compile(
    r"\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|caret|accent|divide)-"
    r"(?:" + "|".join(_TAILWIND_HUES) + r")-\d{2,3}\b"
)

_CSS_VAR_DECL = re.compile(r"(--[\w-]+):\s*([^;]+);")
_BARE_HSL_TRIPLET = re.compile(
    r"^\d+(?:\.\d+)?\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%$"
)
_COLOR_VAR_NAME = re.compile(
    r"(--color|--bg|--background|--fg|--foreground|--border|--primary|--secondary|"
    r"--destructive|--accent|--muted|--popover|--card|--ring)"
)

_SOURCE_SUFFIXES = {".ts", ".tsx", ".css"}


@dataclass
class TokenViolation:
    file: str
    line: int
    message: str


def _is_exempt(value: str, exemptions: list[str]) -> bool:
    if any(part in DEFAULT_IGNORED_DIRS for part in Path(value).parts):
        return True
    return any(fnmatch.fnmatch(value, pattern) for pattern in exemptions)


def _source_files(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(
        path
        for path in iter_source_files(root, tuple(_SOURCE_SUFFIXES), include_assets=False)
        if not path.name.endswith(".d.ts")
    )


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def _check_raw_literals(
    root: Path, tokens_css_paths: set[str], theme_palette: str, exemptions: list[str]
) -> list[TokenViolation]:
    violations: list[TokenViolation] = []
    for path in _source_files(root):
        rel = path.relative_to(root).as_posix()
        if rel in tokens_css_paths or rel == theme_palette or _is_exempt(rel, exemptions):
            continue

        text = path.read_text(encoding="utf-8", errors="replace")
        for pattern, label in (
            (_HEX_LITERAL, "hex"),
            (_RGB_LITERAL, "rgb/rgba"),
            (_HSL_LITERAL, "hsl/hsla"),
        ):
            for match in pattern.finditer(text):
                literal = match.group(0)
                if _is_exempt(literal.rstrip("("), exemptions):
                    continue
                violations.append(
                    TokenViolation(
                        file=rel,
                        line=_line_of(text, match.start()),
                        message=f"literal {label} color value bypasses the design token layer",
                    )
                )
    return violations


def _check_tailwind_utilities(root: Path, exemptions: list[str]) -> list[TokenViolation]:
    violations: list[TokenViolation] = []
    for path in _source_files(root):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue

        text = path.read_text(encoding="utf-8", errors="replace")
        for match in _TAILWIND_COLOR_UTILITY.finditer(text):
            violations.append(
                TokenViolation(
                    file=rel,
                    line=_line_of(text, match.start()),
                    message=f"hardcoded Tailwind color utility `{match.group(0)}` - "
                    "use a semantic role token instead",
                )
            )
    return violations


def _check_bare_hsl_triplets(
    root: Path, tokens_css_paths: set[str], exemptions: list[str]
) -> list[TokenViolation]:
    violations: list[TokenViolation] = []
    for rel in tokens_css_paths:
        if _is_exempt(rel, exemptions):
            continue
        path = root / rel
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for match in _CSS_VAR_DECL.finditer(text):
            var_name = match.group(1)
            if not _COLOR_VAR_NAME.search(var_name):
                continue
            value = match.group(2).strip()
            if not _BARE_HSL_TRIPLET.match(value):
                violations.append(
                    TokenViolation(
                        file=rel,
                        line=_line_of(text, match.start()),
                        message=f"CSS variable value `{value}` is not a bare HSL triplet - "
                        "wrapping it in hsl(...) blocks opacity-modifier syntax",
                    )
                )
    return violations


def audit(
    root: Path, theme_palette: str, exemptions: list[str]
) -> list[TokenViolation]:
    tokens_css_paths = {
        p.relative_to(root).as_posix()
        for p in iter_source_files(root, (".css",), include_assets=False)
        if p.name == "tokens.css"
    }
    return (
        _check_raw_literals(root, tokens_css_paths, theme_palette, exemptions)
        + _check_tailwind_utilities(root, exemptions)
        + _check_bare_hsl_triplets(root, tokens_css_paths, exemptions)
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository/source root to scan")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    reporter = AuditReporter("S009", "Design System", root, root / "bedrock.toml")

    reporter.start_check("Loading bedrock.toml configuration")
    try:
        config = load_bedrock_config(root)
    except (FileNotFoundError, ValueError) as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()
    reporter.pass_check()

    violations = audit(root, config.audit_s009.theme_palettes, config.audit_s009.exemptions)
    if violations:
        for violation in violations:
            reporter.start_check(f"Checking design token usage in {violation.file}:{violation.line}")
            reporter.fail_check(
                violation.message, file_path=violation.file, line=violation.line
            )
    else:
        reporter.start_check("Scanning for raw color literals, hardcoded Tailwind utilities, and bare HSL triplets")
        reporter.pass_check("design tokens are compliant")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
