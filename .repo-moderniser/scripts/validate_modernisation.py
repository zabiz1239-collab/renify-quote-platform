#!/usr/bin/env python3
"""Validate the permanent repository operating layer after modernisation."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REQUIRED_FILES = [
    "AGENTS.md",
    "CLAUDE.md",
    ".ai/README.md",
    ".ai/project.yml",
    ".ai/orchestrator.yml",
    ".ai/memory/LONG_TERM.md",
    ".ai/memory/SHORT_TERM.md",
    ".ai/memory/DECISIONS.md",
    ".ai/memory/KNOWN_ISSUES.md",
    ".ai/tasks/BACKLOG.md",
    "docs/architecture/README.md",
    "docs/decisions/0000-template.md",
    "docs/operations/README.md",
    "docs/testing/README.md",
]
REQUIRED_REPORTS = [
    ".repo-moderniser/output/INVENTORY.md",
    ".repo-moderniser/output/AUDIT_REPORT.md",
    ".repo-moderniser/output/BASELINE.md",
    ".repo-moderniser/output/MIGRATION_PLAN.md",
    ".repo-moderniser/output/MIGRATION_LOG.md",
    ".repo-moderniser/output/VALIDATION_REPORT.md",
    ".repo-moderniser/output/COMPLETION_REPORT.md",
]
PLACEHOLDER_PATTERNS = [
    re.compile(r"\{\{[^{}\n]+\}\}"),
    re.compile(r"\[\s*TODO(?:[:\]]|\s)", re.I),
    re.compile(r"<\s*TODO\s*>", re.I),
]
TEMP_BEGIN = "<!-- repository-moderniser:begin -->"
SECRET_TRACK_PATTERNS = [
    re.compile(r"(^|/)\.env($|\.)", re.I),
    re.compile(r"\.(pem|key|p12|pfx|jks|keystore)$", re.I),
    re.compile(r"(^|/)(secrets?|credentials?)([._/-]|$)", re.I),
]
SAFE_SECRET_EXCEPTIONS = re.compile(r"(?:example|sample|template|public|\.pub)(?:\.|$)", re.I)


def run_git(root: Path, args: list[str]) -> tuple[int | None, str]:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=30,
        )
        return result.returncode, result.stdout.strip()
    except (OSError, subprocess.TimeoutExpired) as exc:
        return None, str(exc)


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return ""


def add(results: list[dict[str, Any]], level: str, check: str, detail: str, path: str | None = None) -> None:
    results.append({"level": level, "check": check, "detail": detail, "path": path})


def validate(root: Path, allow_temporary_blocks: bool, reports_optional: bool) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []

    for rel in REQUIRED_FILES:
        path = root / rel
        if not path.is_file():
            add(results, "error", "required_file", "Required permanent file is missing.", rel)
        elif path.stat().st_size == 0:
            add(results, "error", "required_file", "Required permanent file is empty.", rel)
        else:
            add(results, "pass", "required_file", "Present.", rel)

    for rel in REQUIRED_REPORTS:
        path = root / rel
        if not path.is_file() or path.stat().st_size == 0:
            add(results, "warning" if reports_optional else "error", "required_report", "Migration report is missing or empty.", rel)
        else:
            add(results, "pass", "required_report", "Present.", rel)

    for rel in REQUIRED_FILES:
        path = root / rel
        if not path.is_file():
            continue
        text = read_text(path)
        matches: list[str] = []
        for pattern in PLACEHOLDER_PATTERNS:
            matches.extend(match.group(0) for match in pattern.finditer(text))
        if matches:
            preview = ", ".join(sorted(set(matches))[:8])
            add(results, "error", "unresolved_placeholder", f"Unresolved template marker(s): {preview}", rel)

    agents_path = root / "AGENTS.md"
    agents = read_text(agents_path)
    if agents:
        byte_size = len(agents.encode("utf-8"))
        line_count = len(agents.splitlines())
        if byte_size > 32768:
            add(results, "error", "agents_size", f"AGENTS.md is {byte_size} bytes; split or shorten it so core guidance is not truncated.", "AGENTS.md")
        elif byte_size > 24000:
            add(results, "warning", "agents_size", f"AGENTS.md is {byte_size} bytes; consider moving procedures into linked docs/skills.", "AGENTS.md")
        else:
            add(results, "pass", "agents_size", f"AGENTS.md is {byte_size} bytes and {line_count} lines.", "AGENTS.md")
        for heading in ("Project", "Repository map", "Supported commands", "Definition of done"):
            if not re.search(rf"^#+\s+.*{re.escape(heading)}", agents, re.I | re.M):
                add(results, "warning", "agents_content", f"Expected practical section not found: {heading}.", "AGENTS.md")
        if TEMP_BEGIN in agents and not allow_temporary_blocks:
            add(results, "error", "temporary_block", "Temporary moderniser instruction block remains; replace it with permanent project-specific content.", "AGENTS.md")

    claude_path = root / "CLAUDE.md"
    claude = read_text(claude_path)
    if claude:
        imports = [line for line in claude.splitlines() if line.strip() == "@AGENTS.md"]
        if not imports:
            add(results, "error", "claude_bridge", "CLAUDE.md does not import @AGENTS.md.", "CLAUDE.md")
        elif len(imports) > 1:
            add(results, "warning", "claude_bridge", "CLAUDE.md imports @AGENTS.md more than once.", "CLAUDE.md")
        else:
            add(results, "pass", "claude_bridge", "CLAUDE.md imports the canonical AGENTS.md.", "CLAUDE.md")
        lines = len(claude.splitlines())
        if lines > 200:
            add(results, "error", "claude_size", f"CLAUDE.md has {lines} lines; shorten or scope rules.", "CLAUDE.md")
        elif lines > 80:
            add(results, "warning", "claude_size", f"CLAUDE.md has {lines} lines; keep vendor-specific guidance minimal.", "CLAUDE.md")
        if TEMP_BEGIN in claude and not allow_temporary_blocks:
            add(results, "error", "temporary_block", "Temporary moderniser instruction block remains.", "CLAUDE.md")

    short_path = root / ".ai/memory/SHORT_TERM.md"
    if short_path.is_file():
        short_text = read_text(short_path)
        lines = len(short_text.splitlines())
        if lines > 120:
            add(results, "warning", "short_term_memory_size", f"SHORT_TERM.md has {lines} lines; reduce it to a concise hand-off.", str(short_path.relative_to(root)))
        if not re.search(r"next action", short_text, re.I):
            add(results, "warning", "short_term_memory_content", "Short-term memory should name the next concrete action.", str(short_path.relative_to(root)))

    for rel, expected_keys in {
        ".ai/project.yml": ["schema_version:", "project:", "stack:", "commands:", "entry_points:", "contracts:", "protected_paths:"],
        ".ai/orchestrator.yml": ["schema_version:", "principles:", "roles:", "workflow:", "pause_conditions:", "definition_of_done:"],
    }.items():
        text = read_text(root / rel)
        for key in expected_keys:
            if key not in text:
                add(results, "error", "yaml_shape", f"Expected top-level key not found: {key}", rel)

    code, tracked = run_git(root, ["ls-files"])
    if code == 0:
        risky: list[str] = []
        for rel in tracked.splitlines():
            normalized = rel.replace("\\", "/")
            if SAFE_SECRET_EXCEPTIONS.search(Path(normalized).name):
                continue
            if any(pattern.search(normalized) for pattern in SECRET_TRACK_PATTERNS):
                risky.append(normalized)
        if risky:
            add(results, "warning", "tracked_sensitive_path", "Tracked sensitive-looking path(s); verify they contain no secrets: " + ", ".join(risky[:20]))
        else:
            add(results, "pass", "tracked_sensitive_path", "No obvious secret filename is tracked (heuristic check).")

        status_code, status = run_git(root, ["status", "--short"])
        if status_code == 0:
            add(results, "pass", "git_status", f"Git status contains {len(status.splitlines()) if status else 0} entries; review before completion.")
        diff_code, diff_check = run_git(root, ["diff", "--check"])
        if diff_code == 0:
            add(results, "pass", "diff_check", "git diff --check passed.")
        else:
            add(results, "error", "diff_check", diff_check or "git diff --check failed.")
    else:
        add(results, "warning", "git", "Git metadata is unavailable; secret tracking and diff checks were skipped.")

    completion = read_text(root / ".repo-moderniser/output/COMPLETION_REPORT.md")
    if completion and re.search(r"\b(blocked|not complete|incomplete)\b", completion, re.I):
        add(results, "warning", "completion_status", "Completion report appears to mention a blocked or incomplete state; verify the final status explicitly.")

    return results


def render_markdown(root: Path, results: list[dict[str, Any]]) -> str:
    errors = sum(1 for item in results if item["level"] == "error")
    warnings = sum(1 for item in results if item["level"] == "warning")
    passes = sum(1 for item in results if item["level"] == "pass")
    lines = [
        "# Structural modernisation validation",
        "",
        f"- Generated: `{datetime.now(timezone.utc).isoformat()}`",
        f"- Root: `{root}`",
        f"- Result: `{'PASS' if errors == 0 else 'FAIL'}`",
        f"- Checks: `{passes}` passed, `{warnings}` warnings, `{errors}` errors",
        "",
        "| Level | Check | Path | Detail |",
        "|---|---|---|---|",
    ]
    for item in results:
        detail = str(item["detail"]).replace("|", "\\|").replace("\n", " ")
        path = (item.get("path") or "—").replace("|", "\\|")
        lines.append(f"| {item['level'].upper()} | {item['check']} | `{path}` | {detail} |")
    lines.extend([
        "",
        "> This validator checks repository structure and instruction hygiene. It does not replace project-specific lint, type-check, tests, build, smoke, security, or deployment validation.",
    ])
    return "\n".join(lines) + "\n"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate permanent files after repository modernisation.")
    parser.add_argument("--root", default=".", help="Repository root.")
    parser.add_argument("--allow-temporary-blocks", action="store_true", help="Downgrade temporary bridge checks by allowing them before cleanup.")
    parser.add_argument("--reports-optional", action="store_true", help="Treat missing migration reports as warnings.")
    parser.add_argument("--mark-complete", action="store_true", help="Write a completion sentinel when validation has no errors.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print(f"ERROR: root is not a directory: {root}", file=sys.stderr)
        return 2
    results = validate(root, args.allow_temporary_blocks, args.reports_optional)
    errors = sum(1 for item in results if item["level"] == "error")
    warnings = sum(1 for item in results if item["level"] == "warning")
    output_dir = root / ".repo-moderniser/output"
    output_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "root": str(root),
        "passed": errors == 0,
        "errors": errors,
        "warnings": warnings,
        "checks": results,
    }
    json_path = output_dir / "structural-validation.json"
    md_path = output_dir / "STRUCTURAL_VALIDATION.md"
    json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(root, results), encoding="utf-8")
    if errors == 0 and args.mark_complete:
        (output_dir / "STRUCTURAL_VALIDATION_PASSED").write_text(
            datetime.now(timezone.utc).isoformat() + "\n", encoding="utf-8"
        )
    print(f"Structural validation: {'PASS' if errors == 0 else 'FAIL'} ({errors} errors, {warnings} warnings)")
    print(f"Wrote {md_path}")
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
