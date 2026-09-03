import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path


def run_cmd(cmd, cwd=None, check=False):
    res = subprocess.run(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=check,
    )
    return res.stdout.strip(), res.stderr.strip(), res.returncode


def get_default_branch(repo_dir: Path) -> str:
    out, _, code = run_cmd(["git", "symbolic-ref", "refs/remotes/origin/HEAD"], cwd=repo_dir)
    if code == 0 and out:
        return out.split("/")[-1]
    for b in ["master", "main"]:
        _, _, code = run_cmd(["git", "rev-parse", "--verify", f"origin/{b}"], cwd=repo_dir)
        if code == 0:
            return b
    return "master"


def get_current_branch(repo_dir: Path) -> str:
    out, _, _ = run_cmd(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=repo_dir)
    return out


def get_open_pr_branches(repo_dir: Path) -> set:
    open_branches = set()
    if shutil.which("gh"):
        out, _, code = run_cmd(
            ["gh", "pr", "list", "--state", "open", "--json", "headRefName"],
            cwd=repo_dir,
        )
        if code == 0 and out:
            try:
                prs = json.loads(out)
                for pr in prs:
                    if "headRefName" in pr:
                        open_branches.add(pr["headRefName"])
            except Exception:
                pass
    return open_branches


def get_remote_branches_from_gh(repo_dir: Path) -> list:
    if shutil.which("gh"):
        out, _, code = run_cmd(["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], cwd=repo_dir)
        if code == 0 and out:
            repo_slug = out.strip()
            b_out, _, b_code = run_cmd(["gh", "api", f"repos/{repo_slug}/branches", "--paginate", "--jq", ".[].name"], cwd=repo_dir)
            if b_code == 0 and b_out:
                return [b.strip() for b in b_out.splitlines() if b.strip()]
    return []


def get_remote_branches(repo_dir: Path) -> list:
    gh_branches = get_remote_branches_from_gh(repo_dir)
    if gh_branches:
        return gh_branches

    out, _, code = run_cmd(["git", "branch", "-r"], cwd=repo_dir)
    if code != 0:
        return []
    branches = []
    for line in out.splitlines():
        line = line.strip()
        if not line or "->" in line:
            continue
        if line.startswith("origin/"):
            branches.append(line[len("origin/"):])
    return branches


def get_local_branches_to_clean(repo_dir: Path, default_branch: str, current_branch: str, remote_deletions: list) -> list:
    out, _, code = run_cmd(["git", "branch", "-vv"], cwd=repo_dir)
    if code != 0:
        return []

    merged_out, _, _ = run_cmd(["git", "branch", "--merged", default_branch], cwd=repo_dir)
    merged_branches = {b.strip().lstrip("* ") for b in merged_out.splitlines() if b.strip()}

    local_to_clean = []
    remotes_set = set(remote_deletions)

    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        is_current = line.startswith("*")
        cleaned = line.lstrip("* ").strip()
        parts = cleaned.split()
        if not parts:
            continue
        branch_name = parts[0]

        if is_current or branch_name == current_branch or branch_name in {default_branch, "master", "main"}:
            continue

        if ": gone]" in line or branch_name in merged_branches or branch_name in remotes_set:
            local_to_clean.append(branch_name)

    return sorted(list(set(local_to_clean)))


def main():
    parser = argparse.ArgumentParser(description="Clean up stale remote and local branches safely.")
    parser.add_argument("--repo", default=".", help="Path to repository root")
    parser.add_argument("--dry-run", action="store_true", help="Show branches to delete without deleting")
    parser.add_argument("-y", "--yes", action="store_true", help="Bypass confirmation prompt")
    parser.add_argument("--remote-only", action="store_true", help="Only clean remote branches")
    parser.add_argument("--local-only", action="store_true", help="Only clean local branches")
    args = parser.parse_args()

    repo_dir = Path(args.repo).resolve()
    print(f"Inspecting repository at: {repo_dir}")

    _, _, code = run_cmd(["git", "rev-parse", "--is-inside-work-tree"], cwd=repo_dir)
    if code != 0:
        print(f"Error: {repo_dir} is not a git repository.", file=sys.stderr)
        sys.exit(1)

    # Pre-fetch and prune to sync with GitHub
    run_cmd(["git", "fetch", "--prune"], cwd=repo_dir)

    default_branch = get_default_branch(repo_dir)
    current_branch = get_current_branch(repo_dir)
    open_prs = get_open_pr_branches(repo_dir)

    print(f"  Default branch: {default_branch}")
    print(f"  Current branch: {current_branch}")
    if open_prs:
        print(f"  Protected (open PRs): {', '.join(sorted(open_prs))}")

    # Remote branches
    remote_candidates = []
    if not args.local_only:
        all_remotes = get_remote_branches(repo_dir)
        protected_remotes = {default_branch, "master", "main"} | open_prs
        remote_candidates = [b for b in all_remotes if b not in protected_remotes]

    # Local branches
    local_candidates = []
    if not args.remote_only:
        local_candidates = get_local_branches_to_clean(repo_dir, default_branch, current_branch, remote_candidates)

    print("\n--- Cleanup Plan ---")
    if not args.local_only:
        print(f"Remote branches on origin to delete ({len(remote_candidates)}):")
        for b in sorted(remote_candidates):
            print(f"  - origin/{b}")
        if not remote_candidates:
            print("  (None)")

    if not args.remote_only:
        print(f"\nLocal branches to delete ({len(local_candidates)}):")
        for b in sorted(local_candidates):
            print(f"  - {b}")
        if not local_candidates:
            print("  (None)")

    if not remote_candidates and not local_candidates:
        print("\nRepository is clean! Nothing to delete.")
        return

    if args.dry_run:
        print("\n[Dry run] No changes made.")
        return

    if not args.yes:
        confirm = input("\nDo you want to permanently delete these branches? [y/N]: ").strip().lower()
        if confirm not in ("y", "yes"):
            print("Aborted.")
            return

    # Delete remote branches
    if remote_candidates:
        print(f"\nDeleting {len(remote_candidates)} remote branches...")
        deleted_count = 0
        for b in remote_candidates:
            out, err, code = run_cmd(["git", "push", "origin", "--delete", b], cwd=repo_dir)
            if code == 0:
                print(f"  [OK] Deleted remote origin/{b}")
                deleted_count += 1
            else:
                print(f"  [WARN] Failed to delete origin/{b}: {err or out}", file=sys.stderr)
        print(f"Remote branches deleted: {deleted_count}/{len(remote_candidates)}")

        # Prune remote tracking
        print("Pruning remote tracking references (git fetch --prune)...")
        run_cmd(["git", "fetch", "--prune"], cwd=repo_dir)

    # Delete local branches
    if local_candidates:
        print(f"\nDeleting {len(local_candidates)} local branches...")
        for b in local_candidates:
            out, err, code = run_cmd(["git", "branch", "-D", b], cwd=repo_dir)
            if code == 0:
                print(f"  [OK] Deleted local branch: {b}")
            else:
                print(f"  [WARN] Failed to delete local branch {b}: {err or out}", file=sys.stderr)

    print("\n[Done] Cleanup complete.")


if __name__ == "__main__":
    main()
