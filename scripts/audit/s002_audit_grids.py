#!/usr/bin/env python
"""Runner shim for Standard S002 audit."""
import sys
from bedrock.tools.s002_audit_grids import main

if __name__ == "__main__":
    sys.exit(main())
