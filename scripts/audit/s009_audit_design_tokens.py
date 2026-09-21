#!/usr/bin/env python
"""Runner shim for Standard S009 audit."""
import sys
from bedrock.tools.s009_audit_design_tokens import main

if __name__ == "__main__":
    sys.exit(main())
