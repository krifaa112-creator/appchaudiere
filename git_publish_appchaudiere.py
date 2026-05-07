from pathlib import Path
import subprocess
import sys


PROJECT_DIR = Path(r"C:\Users\krifa\Documents\Codex\appchaudiere")
COMMIT_MESSAGE = "Add files created with Codex"


def run(command: list[str]) -> None:
    print(f"\n> {' '.join(command)}")
    subprocess.run(command, cwd=PROJECT_DIR, check=True)


def main() -> int:
    if not PROJECT_DIR.exists():
        print(f"Project folder not found: {PROJECT_DIR}", file=sys.stderr)
        return 1

    try:
        run(["git", "add", "."])
        run(["git", "commit", "-m", COMMIT_MESSAGE])
        run(["git", "push", "origin", "main"])
    except subprocess.CalledProcessError as error:
        print(f"\nCommand failed with exit code {error.returncode}.", file=sys.stderr)
        return error.returncode

    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
