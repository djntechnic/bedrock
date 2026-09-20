#!/usr/bin/env python
"""Runner shim for Standard S005 audit."""
import sys
from bedrock.tools.s005_audit_testing import main

if __name__ == "__main__":
    sys.exit(main())
