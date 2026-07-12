#!/usr/bin/env python3
"""Archive migration evidence and remove only the temporary moderniser layer."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

BEGIN = "<!-- repository-moderniser:begin -->"
END = "<!-- repository-moderniser:end -->"


def remove_marked_block(text: str) -> tuple[str, bool]:
    changed = False
    while True:
        start = text.find(BEGIN)
        end = text.find(END)
        if start == -1 or end == -1 or end < start:
            break
        end += len(END)
        before = text[:start].rstrip()
        after = text[end:].lstrip("\r\n")
        text = (before + ("\n\n" if before and after else "") + after).rstrip() + "\n"
        changed = True
    return text, changed


def load_json(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def choose_archive(root: Path) -> Path:
    base = root / "docs" / "migrations" / f"{date.today().isoformat()}-repository-modernisation"
    if not base.exists():
        return base
    index = 2
    while (candidate := Path(f"{base}-{index}")).exists():
        index += 1
    return candidate


def prerequisite_errors(root: Path) -> list[str]:
    errors: list[str] = []
    completion = root / ".repo-moderniser/output/COMPLETION_REPORT.md"
    validation = root / ".repo-moderniser/output/structural-validation.json"
    if not completion.is_file() or completion.stat().st_size == 0:
        errors.append("COMPLETION_REPORT.md is missing or empty")
    else:
        text = completion.read_text(encoding="utf-8", errors="replace")
        if "{{" in text or "}}" in text:
            errors.append("COMPLETION_REPORT.md still contains template placeholders")
    result = load_json(validation)
    if not result or result.get("passed") is not True:
        errors.append("the latest structural validation did not pass")
    for rel in ("AGENTS.md", "CLAUDE.md", ".ai/project.yml", ".ai/orchestrator.yml"):
        path = root / rel
        if not path.is_file() or path.stat().st_size == 0:
            errors.append(f"permanent file is missing or empty: {rel}")
    return errors


def archive_evidence(root: Path, archive: Path, dry_run: bool) -> list[str]:
    copied: list[str] = []
    candidates = [
        root / ".repo-moderniser/output",
        root / ".repo-moderniser/moderniser.yml",
        root / ".repo-moderniser/state.yml",
        root / ".repo-moderniser/install-manifest.json",
    ]
    if dry_run:
        for candidate in candidates:
            if candidate.exists():
                copied.append(str(candidate.relative_to(root)))
        return copied

    archive.mkdir(parents=True, exist_ok=False)
    for candidate in candidates:
        if not candidate.exists():
            continue
        if candidate.is_dir():
            destination = archive / candidate.name
            shutil.copytree(
                candidate,
                destination,
                ignore=shutil.ignore_patterns(".gitkeep", "STRUCTURAL_VALIDATION_PASSED"),
            )
        else:
            shutil.copy2(candidate, archive / candidate.name)
        copied.append(str(candidate.relative_to(root)))

    readme = f"""# Repository modernisation archive

Archived at `{datetime.now(timezone.utc).isoformat()}`.

This directory preserves the one-off audit, migration plan, evidence, configuration, and completion report. The temporary moderniser engine and skills were removed after validation. The permanent project operating layer remains in `AGENTS.md`, `CLAUDE.md`, `.ai/`, and the main documentation directories.
"""
    (archive / "README.md").write_text(readme, encoding="utf-8")
    return copied


def restore_or_remove_payload(root: Path, manifest: dict[str, Any] | None, dry_run: bool) -> list[str]:
    actions: list[str] = []
    records = manifest.get("payload", []) if manifest else []
    if not isinstance(records, list):
        records = []

    # Only process payload paths outside .repo-moderniser; that directory is removed as a unit.
    for record in records:
        if not isinstance(record, dict):
            continue
        rel = record.get("path")
        status = record.get("status")
        if not isinstance(rel, str) or rel.startswith(".repo-moderniser/"):
            continue
        destination = root / rel
        backup_rel = record.get("backup")
        if status == "replaced" and isinstance(backup_rel, str):
            backup = root / backup_rel
            if backup.is_file():
                actions.append(f"restore {rel} from {backup_rel}")
                if not dry_run:
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(backup, destination)
                continue
        if status == "created":
            actions.append(f"remove temporary payload {rel}")
            if not dry_run:
                if destination.is_dir():
                    shutil.rmtree(destination)
                elif destination.exists() or destination.is_symlink():
                    destination.unlink()
    return actions


def prune_empty_parents(root: Path, paths: list[Path]) -> None:
    for path in paths:
        current = path
        while current != root and current.exists() and current.is_dir():
            try:
                current.rmdir()
            except OSError:
                break
            current = current.parent


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Archive evidence and remove the temporary repository moderniser layer.")
    parser.add_argument("--root", default=".", help="Repository root.")
    parser.add_argument("--force", action="store_true", help="Bypass completion/validation prerequisites. Use only after manual review.")
    parser.add_argument("--dry-run", action="store_true", help="Show actions without changing files.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    root = Path(args.root).expanduser().resolve()
    temporary = root / ".repo-moderniser"
    if not root.is_dir() or not temporary.is_dir():
        print(f"ERROR: .repo-moderniser was not found under {root}", file=sys.stderr)
        return 2
    if root == Path(root.anchor) or root == Path.home().resolve():
        print("ERROR: refusing to clean a filesystem root or home directory.", file=sys.stderr)
        return 2

    errors = prerequisite_errors(root)
    if errors and not args.force:
        print("Cleanup prerequisites are not satisfied:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        print("Run final validation and complete the report, or use --force only after manual review.", file=sys.stderr)
        return 1

    archive = choose_archive(root)
    manifest = load_json(temporary / "install-manifest.json")
    print(f"Archive destination: {archive}")
    copied = archive_evidence(root, archive, args.dry_run)
    for item in copied:
        print(f"  archive {item}")

    for filename in ("AGENTS.md", "CLAUDE.md"):
        path = root / filename
        if not path.is_file():
            continue
        original = path.read_text(encoding="utf-8", errors="replace")
        updated, changed = remove_marked_block(original)
        if changed:
            print(f"  remove temporary block from {filename}")
            if not args.dry_run:
                path.write_text(updated, encoding="utf-8")

    actions = restore_or_remove_payload(root, manifest, args.dry_run)
    for action in actions:
        print(f"  {action}")

    skill_parents = [root / ".agents/skills/repository-moderniser", root / ".claude/skills/repository-moderniser"]
    if not args.dry_run:
        prune_empty_parents(root, skill_parents)

    if args.dry_run:
        print("  remove .repo-moderniser/")
        print("Dry run complete; no files were changed.")
        return 0

    try:
        shutil.rmtree(temporary)
    except OSError as exc:
        renamed = root / f".repo-moderniser.remove-manually-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        try:
            temporary.rename(renamed)
            print(f"WARNING: could not delete the running kit ({exc}); renamed it to {renamed.name} for manual removal.")
        except OSError:
            print(f"ERROR: could not remove the temporary directory: {exc}", file=sys.stderr)
            return 1

    print("Cleanup complete. Permanent AGENTS.md, CLAUDE.md, .ai/, application changes, and project docs remain.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
