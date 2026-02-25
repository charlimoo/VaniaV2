#!/usr/bin/env python3
import subprocess
import sys
from pathlib import Path

FORBIDDEN_PATHS = [
    "backend/definitions/agents/vania.py",
    "backend/capabilities/vania_doctor/capability.py",
    "backend/capabilities/vania_patient/capability.py",
]


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    cmd = ["git", "-C", str(repo_root), "diff", "--name-only", "--", *FORBIDDEN_PATHS]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)

    changed = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if changed:
        print("Prompt immutability check failed. Forbidden files changed:")
        for path in changed:
            print(f"- {path}")
        return 1

    print("Prompt immutability check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
