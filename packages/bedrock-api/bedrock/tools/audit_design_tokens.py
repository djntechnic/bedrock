"""
Module:  audit_design_tokens.py
Layer:   bedrock/tools
Desc:    Gate for the boundary between a consumer app's documented design
         system and the palettes bedrock's own `ThemeProvider` renders.

         `.stitch/DESIGN.md` is the human-readable half of a consumer's
         design system - the document a designer reads, and the one Stitch
         consumes to generate screens. A registered `ThemePalette` (e.g.
         `frontend/src/theme/palettes.ts`) is the machine-readable half, and
         the only one the browser ever sees: bedrock's `ThemeProvider` writes
         each palette's `cssVars` as inline styles on `<html>`, which outrank
         every stylesheet rule. Nothing connects the two but intent.

         That makes drift silent in the worst direction. A hex edited in
         DESIGN.md and not in the palette changes no pixel; the document
         simply becomes a description of an application that no longer
         exists, and the next screen generated from it is designed against a
         palette the app does not have. The reverse - a token added to a
         palette and never documented - is how an undocumented colour ends up
         load-bearing.

         This lives in the platform, not copied into each consumer
         (CollectIt, MLBTracker, ...), because the property being checked -
         "the documented palette matches what ThemeProvider actually writes"
         - belongs to consuming bedrock's theming, not to any app's domain.
         A second copy per consumer is exactly the kind of drift this whole
         mechanism exists to prevent.

         Rules, all blocking:
           1. Both halves declare the same token names. DESIGN.md's `colors`
              maps to the dark palette, `colorsLight` to the light one.
           2. Every documented hex converts to exactly the HSL triple the
              palette carries, using bedrock's `hexToHsl` conversion -
              transcribed here rather than approximated, since a rounding
              difference of one would be a false failure every time.
           3. The two palettes declare identical token vocabularies, so
              switching theme can never leave a token unset.
           4. Every token bedrock's `@theme` block resolves is present in
              both.
           5. The six editable hex fields on each palette match the
              documented role they mirror.

         `var()` aliases (tokens a palette points at another token rather
         than documenting its own hex) are exempt from rule 2 by design:
         they have no hex to document.

         A consumer with no `.stitch/DESIGN.md`, or with the doc but no
         registered palettes file, has nothing to check and is a clean pass,
         not a violation - a repo mid-migration onto this design system (or
         one that never adopted Stitch) is not the failure mode this gate
         exists to catch.

         Exit 0 clean, 1 on a violation, 2 on an environment error.

Usage:   python -m bedrock.tools.audit_design_tokens
         python -m bedrock.tools.audit_design_tokens --repo-root .
         python -m bedrock.tools.audit_design_tokens \\
             --repo-root . --design-doc .stitch/DESIGN.md \\
             --palettes frontend/src/theme/palettes.ts
"""
from __future__ import annotations

import argparse
import pathlib
import re

from loguru import logger

try:
    import yaml
except ImportError:  # pragma: no cover - environment problem, not a violation
    yaml = None  # type: ignore[assignment]


#: Which frontmatter colour map documents which palette, keyed by the palette's
#: exported name. These are defaults, not the contract: a consumer that names
#: its palettes something else passes `--dark-palette`/`--light-palette`. The
#: names must be overridable, because a gate that looked only for names it
#: never found would report a clean pass for a repo it had not checked at all -
#: the one failure mode worse than a false finding.
DEFAULT_PALETTE_SOURCES = {
    "BENCH_DARK": "colors",
    "BENCH_LIGHT": "colorsLight",
}

#: Every token the platform's `@theme` block wraps in `hsl()`. A palette
#: missing one leaves the matching utility painting transparent - no error,
#: no warning, just an invisible element.
REQUIRED_TOKENS = frozenset(
    {
        "--background",
        "--foreground",
        "--card",
        "--card-foreground",
        "--popover",
        "--popover-foreground",
        "--primary",
        "--primary-foreground",
        "--secondary",
        "--secondary-foreground",
        "--muted",
        "--muted-foreground",
        "--accent",
        "--accent-foreground",
        "--destructive",
        "--destructive-foreground",
        "--border",
        "--input",
        "--ring",
        "--positive",
        "--negative",
        "--warning",
        "--info",
        "--neutral",
        "--scoreboard-accent",
        "--live-pulse",
        "--chart-1",
        "--chart-2",
        "--chart-3",
    }
)

#: The six hex fields the admin colour pickers edit, and the token each one
#: is the swatch for. `cssVars` being frozen means these never derive anything
#: - they are labels, and a mismatch shows a swatch that lies about the theme
#: it applies.
EDITABLE_FIELDS = {
    "colorPrimary": "primary",
    "colorSecondary": "secondary",
    "colorBackground": "background",
    "colorAccent": "accent",
    "colorDestructive": "destructive",
    "colorBorder": "border",
}

_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
_HSL = re.compile(r"^\d{1,3} \d{1,3}% \d{1,3}%$")
_VAR_ALIAS = re.compile(r"^var\(--[a-z0-9-]+\)$")


class EnvironmentProblem(Exception):
    """PyYAML is missing, or a file that exists could not be parsed at all.

    An environment error (exit 2), never a clean pass or a violation - the
    audit could not read what it was asked to check.
    """


def hex_to_hsl(hex_value: str) -> str:
    """bedrock's `hexToHsl`, transcribed.

    Reimplemented rather than approximated because the audit compares the
    result for equality: rounding one channel differently would fail every
    palette on every run.
    """
    r = int(hex_value[1:3], 16) / 255
    g = int(hex_value[3:5], 16) / 255
    b = int(hex_value[5:7], 16) / 255
    hi, lo = max(r, g, b), min(r, g, b)
    lightness = (hi + lo) / 2
    hue = sat = 0.0
    if hi != lo:
        d = hi - lo
        sat = d / (2 - hi - lo) if lightness > 0.5 else d / (hi + lo)
        if hi == r:
            hue = ((g - b) / d + (6 if g < b else 0)) / 6
        elif hi == g:
            hue = ((b - r) / d + 2) / 6
        else:
            hue = ((r - g) / d + 4) / 6
    # JavaScript's Math.round is half-up; Python's round() is half-to-even,
    # which would disagree on an exact .5 (e.g. a hue landing on 40.5).
    return (
        f"{int(hue * 360 + 0.5)} {int(sat * 100 + 0.5)}% {int(lightness * 100 + 0.5)}%"
    )


def read_frontmatter(path: pathlib.Path) -> dict:
    """The YAML block between the first two `---` fences."""
    if yaml is None:
        raise EnvironmentProblem(
            "PyYAML is required to parse a DESIGN.md's frontmatter. "
            "`pip install pyyaml`."
        )
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        raise EnvironmentProblem(
            f"{path}: no YAML frontmatter - the file must open with `---`"
        )
    _, _, rest = text.partition("---")
    block, fence, _ = rest.partition("\n---")
    if not fence:
        raise EnvironmentProblem(
            f"{path}: unterminated YAML frontmatter - no closing `---`"
        )
    try:
        return yaml.safe_load(block) or {}
    except yaml.YAMLError as exc:
        raise EnvironmentProblem(f"{path}: could not parse frontmatter YAML: {exc}") from exc


def parse_palettes(
    path: pathlib.Path, palette_sources: dict[str, str] | None = None
) -> dict[str, dict]:
    """Extract each exported palette from a palettes source file.

    A regex rather than a TypeScript parse. The alternative is shelling out to
    node with a transpile step, which would make a documentation audit depend
    on an installed toolchain; the file's shape is fixed and machine-written,
    and rule 4 fails loudly if this ever silently under-reads it.

    A palette named in `palette_sources` that the file does not declare is
    simply absent from the returned dict - callers treat "not registered
    here" the same as "not registered at all".
    """
    palette_sources = palette_sources or DEFAULT_PALETTE_SOURCES
    source = path.read_text(encoding="utf-8")

    aliases: dict[str, str] = {}
    try:
        aliases = dict(
            re.findall(
                r'"(--[a-z0-9-]+)":\s*"(var\(--[a-z0-9-]+\))"',
                _slice_block(source, "const PLATFORM_ALIASES"),
            )
        )
    except ValueError:
        pass  # no PLATFORM_ALIASES block - nothing to alias.

    palettes: dict[str, dict] = {}
    for name in palette_sources:
        try:
            block = _slice_block(source, f"export const {name}: ThemePalette")
        except ValueError:
            continue  # this palette is not registered in this file at all.
        css_vars = dict(
            re.findall(r'"(--[a-z0-9-]+)":\s*"([^"]+)"', _slice_block(block, "cssVars:"))
        )
        if "...PLATFORM_ALIASES" in block:
            css_vars.update(aliases)
        fields = dict(re.findall(r'\b(color[A-Za-z]+):\s*"([^"]+)"', block))
        palettes[name] = {"cssVars": css_vars, "fields": fields}
    return palettes


def _slice_block(source: str, marker: str) -> str:
    """From `marker` to the brace that closes the object it opens."""
    start = source.index(marker)
    depth = 0
    for i in range(source.index("{", start), len(source)):
        if source[i] == "{":
            depth += 1
        elif source[i] == "}":
            depth -= 1
            if depth == 0:
                return source[start : i + 1]
    raise ValueError(f"unbalanced braces after {marker!r}")


def audit(
    repo_root: pathlib.Path,
    design_doc: pathlib.Path,
    palettes_path: pathlib.Path,
    palette_sources: dict[str, str] | None = None,
) -> list[str]:
    """Run all five rules for one consumer's design-system pair.

    `palette_sources` maps each palette's exported name to the frontmatter key
    that documents it, dark first; it defaults to `DEFAULT_PALETTE_SOURCES`.

    `design_doc` and `palettes_path` are relative to `repo_root`. A consumer
    with no `.stitch/DESIGN.md`, or with the doc but no registered palettes,
    has nothing to check - that is a clean pass (empty list), never a
    finding, so a repo mid-migration onto this design system is not blocked
    by a gate meant to catch drift in one it has already adopted.

    Raises `EnvironmentProblem` when a file that exists cannot be parsed at
    all (missing PyYAML, malformed frontmatter) - that is an environment
    error, not a finding.
    """
    palette_sources = palette_sources or DEFAULT_PALETTE_SOURCES
    problems: list[str] = []

    design_path = repo_root / design_doc
    full_palettes_path = repo_root / palettes_path

    if not design_path.is_file():
        return []
    if not full_palettes_path.is_file():
        return []

    front = read_frontmatter(design_path)
    palettes = parse_palettes(full_palettes_path, palette_sources)

    if not palettes:
        return []

    vocabularies: dict[str, set[str]] = {}

    for palette_name, front_key in palette_sources.items():
        if palette_name not in palettes:
            continue

        documented = front.get(front_key)
        if not isinstance(documented, dict) or not documented:
            problems.append(
                f"{design_doc.as_posix()} has no `{front_key}` map to document "
                f"{palette_name} with."
            )
            continue

        css_vars = palettes[palette_name]["cssVars"]
        vocabularies[palette_name] = set(css_vars)

        # A var() alias documents nothing, so it is not expected in the
        # frontmatter either - the roles it points at are documented instead.
        hex_tokens = {
            token for token, value in css_vars.items() if not _VAR_ALIAS.match(value)
        }
        documented_tokens = {f"--{name}" for name in documented}

        for token in sorted(hex_tokens - documented_tokens):
            problems.append(
                f"{palette_name} defines {token} but {front_key} in "
                f"{design_doc.as_posix()} does not document it."
            )
        for token in sorted(documented_tokens - hex_tokens):
            problems.append(
                f"{front_key} documents {token} but {palettes_path.as_posix()}'s "
                f"{palette_name} does not define it."
            )

        for name, hex_value in documented.items():
            token = f"--{name}"
            actual = css_vars.get(token)
            if actual is None:
                continue  # already reported above
            if not _HEX.match(str(hex_value)):
                problems.append(
                    f"{front_key}.{name} = {hex_value!r} is not a 6-digit hex."
                )
                continue
            expected = hex_to_hsl(str(hex_value))
            if actual != expected:
                problems.append(
                    f"{palette_name} {token} = {actual!r}, but {front_key}.{name} "
                    f"= {hex_value} converts to {expected!r}. Change the hex in "
                    f"{design_doc.as_posix()} and re-derive, or fix the triple."
                )

        for token, value in css_vars.items():
            if not (_HSL.match(value) or _VAR_ALIAS.match(value)):
                problems.append(
                    f"{palette_name} {token} = {value!r} is neither an HSL "
                    f"triple nor a var() alias. A hex here yields `hsl(#...)`, "
                    f"which the browser drops silently."
                )

        for token in sorted(REQUIRED_TOKENS - set(css_vars)):
            problems.append(
                f"{palette_name} is missing {token}, which the platform's "
                f"`@theme` block resolves - the matching utility paints "
                f"transparent."
            )

        for field, role in EDITABLE_FIELDS.items():
            declared = palettes[palette_name]["fields"].get(field)
            documented_hex = documented.get(role)
            if declared and documented_hex and declared.lower() != str(documented_hex).lower():
                problems.append(
                    f"{palette_name}.{field} = {declared}, but {front_key}.{role} "
                    f"= {documented_hex}. The admin colour picker would show a "
                    f"swatch that does not match the theme it applies."
                )

    if len(vocabularies) == 2:
        dark, light = (vocabularies[name] for name in palette_sources)
        for token in sorted(dark ^ light):
            problems.append(
                f"{token} is defined in one palette and not the other. "
                f"`applyTheme` overwrites without clearing, so switching theme "
                f"would leave it on the previous theme's value."
            )

    return problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", default=".", help="repository root")
    parser.add_argument(
        "--design-doc",
        default=".stitch/DESIGN.md",
        help="the design document, relative to --repo-root",
    )
    parser.add_argument(
        "--palettes",
        default="frontend/src/theme/palettes.ts",
        help="the registered ThemePalette source file, relative to --repo-root",
    )
    parser.add_argument(
        "--dark-palette",
        default="BENCH_DARK",
        help="exported name of the dark ThemePalette, documented by `colors`",
    )
    parser.add_argument(
        "--light-palette",
        default="BENCH_LIGHT",
        help="exported name of the light ThemePalette, documented by `colorsLight`",
    )
    args = parser.parse_args(argv)

    repo_root = pathlib.Path(args.repo_root).resolve()
    design_doc = pathlib.Path(args.design_doc)
    palettes = pathlib.Path(args.palettes)

    # Dark first: rule 3 unpacks this mapping in order to name the two halves.
    palette_sources = {
        args.dark_palette: "colors",
        args.light_palette: "colorsLight",
    }

    try:
        problems = audit(repo_root, design_doc, palettes, palette_sources)
    except EnvironmentProblem as exc:
        logger.error(str(exc))
        return 2

    for problem in problems:
        logger.error(problem)

    if not problems:
        logger.info("OK - the design document and the registered palettes agree.")

    return 1 if problems else 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
