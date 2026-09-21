#!/usr/bin/env python
"""Runner shim for Standard S008 audit."""
import sys
from bedrock.tools.s008_audit_guidance import main

if __name__ == "__main__":
    sys.exit(main())
