# Bedrock Platform — Gemini / Antigravity Project Index

This project keeps **one** authoritative architecture index: [CLAUDE.md](CLAUDE.md). Read it first for architecture, dev commands, key contracts, PR workflow, and operational boundaries.

All standards and rules defined in CLAUDE.md are 100% authoritative for Gemini and Antigravity.

## Gemini / Antigravity Operating Directives

### 1. Autonomous Verification Invariant
- **NEVER** yield the turn to the user stating "I have made the changes, please test" without first executing local verification.
- Run targeted tests/linters during iteration.
- Ensure all configured build, test, and typecheck suites pass before proposing PR or completion.

### 2. Feature Branch Isolation & SDLC (§S006)
- **Zero direct commits to master:** Always cut a feature branch (eat/<name>, ix/<name>, chore/<name>). Direct pushes to master are blocked.
- **Conventional Commits:** Follow standard commit prefixes (eat:, ix:, chore:, docs:, 	est:).
- **PR Workflow:** Open PRs targeting master. Ensure CI checks pass before squash-merging with --delete-branch.

### 3. Ephemeral Scratch Hygiene
- Place all temporary scripts, one-off tests, and ephemeral notes inside scratch/.
- Never commit scratch files into the repository root or source tree.
