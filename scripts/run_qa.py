#!/usr/bin/env python
"""
Module:  run_qa.py
Layer:   scripts
Desc:    Repo-root entry point for the QA orchestrator. The implementation
         ships in bedrock-api as `bedrock.tools.run_qa`, configured by
         `[tool.bedrock.qa]` in bedrock.toml, so every consumer runs the same
         code from its pin; this shim only pins `--root` to this checkout.

Usage:   python scripts/run_qa.py --mode fast
         python scripts/run_qa.py --mode scoped
         python scripts/run_qa.py --mode full --json
"""

import sys
from pathlib import Path

repo_root = Path(__file__).resolve().parent.parent
bedrock_api_pkg = repo_root / "packages" / "bedrock-api"
if bedrock_api_pkg.is_dir() and str(bedrock_api_pkg) not in sys.path:
    sys.path.insert(0, str(bedrock_api_pkg))

from bedrock.tools.run_qa import main

if __name__ == "__main__":
    sys.exit(main(["--root", str(repo_root), *sys.argv[1:]]))
