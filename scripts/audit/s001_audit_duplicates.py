#!/usr/bin/env python
"""Runner shim for Standard S001 audit."""
import sys
from bedrock.tools.s001_audit_duplicates import main

if __name__ == "__main__":
    sys.exit(main())
