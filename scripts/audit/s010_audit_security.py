#!/usr/bin/env python
"""Runner shim for Standard S010 audit."""
import sys
from bedrock.tools.s010_audit_security import main

if __name__ == "__main__":
    sys.exit(main())
