#!/usr/bin/env python
"""Runner shim for Standard S004 audit."""
import sys
from bedrock.tools.s004_audit_config import main

if __name__ == "__main__":
    sys.exit(main())
