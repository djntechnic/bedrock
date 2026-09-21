#!/usr/bin/env python
"""Runner shim for Standard S011 audit."""
import sys
from bedrock.tools.s011_audit_navigation import main

if __name__ == "__main__":
    sys.exit(main())
