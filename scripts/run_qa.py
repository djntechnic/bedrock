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

from bedrock.tools.run_qa import main

if __name__ == "__main__":
    sys.exit(main(["--root", str(Path(__file__).resolve().parent.parent), *sys.argv[1:]]))
