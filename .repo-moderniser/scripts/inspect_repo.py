#!/usr/bin/env python3
"""Create a safe, dependency-free repository inventory for the moderniser."""

from __future__ import annotations

import argparse
import collections
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

try:
    import tomllib  # Python 3.11+
except ModuleNotFoundError:  # pragma: no cover - environment dependent
    tomllib = None  # type: ignore[assignment]

MAX_READ_BYTES = 1_000_000
DEFAULT_EXCLUDED_DIRS = {
    ".git",
    ".repo-moderniser",
    "node_modules",
    "vendor",
    ".venv",
    "venv",
    "dist",
    "build",
    ".next",
    ".nuxt",
    "coverage",
    "target",
    ".turbo",
    ".cache",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "__pycache__",
}
KIT_ONLY_FILES = {"MODERNISE_WITH_CODEX.md", "MODERNISE_WITH_CLAUDE.md"}
SECRET_NAME_PATTERNS = [
    re.compile(r"^\.env(?:\..+)?$", re.I),
    re.compile(r"(?:^|[._-])(secret|secrets|credential|credentials|token|tokens)(?:[._-]|$)", re.I),
    re.compile(r"\.(?:pem|key|p12|pfx|jks|keystore)$", re.I),
    re.compile(r"(?:service[-_]?account|auth[-_]?config).*(?:\.json|\.ya?ml)$", re.I),
]
BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz", ".tar",
    ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".mp4", ".mov", ".avi", ".sqlite", ".db",
    ".dylib", ".dll", ".so", ".exe", ".bin", ".class", ".jar",
}
LANGUAGE_BY_EXTENSION = {
    ".ts": "TypeScript", ".tsx": "TypeScript/React", ".js": "JavaScript", ".jsx": "JavaScript/React",
    ".mjs": "JavaScript", ".cjs": "JavaScript", ".py": "Python", ".rb": "Ruby", ".go": "Go",
    ".rs": "Rust", ".java": "Java", ".kt": "Kotlin", ".kts": "Kotlin", ".cs": "C#",
    ".php": "PHP", ".swift": "Swift", ".dart": "Dart", ".c": "C", ".h": "C/C++ Header",
    ".cpp": "C++", ".cc": "C++", ".hpp": "C++ Header", ".scala": "Scala", ".ex": "Elixir",
    ".exs": "Elixir", ".erl": "Erlang", ".hrl": "Erlang", ".sh": "Shell", ".bash": "Shell",
    ".ps1": "PowerShell", ".sql": "SQL", ".tf": "Terraform", ".hcl": "HCL", ".vue": "Vue",
    ".svelte": "Svelte", ".html": "HTML", ".css": "CSS", ".scss": "SCSS", ".less": "Less",
}
MANIFEST_NAMES = {
    "package.json", "pyproject.toml", "requirements.txt", "Pipfile", "setup.py", "setup.cfg",
    "Cargo.toml", "go.mod", "pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle",
    "settings.gradle.kts", "Gemfile", "composer.json", "pubspec.yaml", "Package.swift", "Podfile",
    "mix.exs", "deno.json", "deno.jsonc", "bunfig.toml", "turbo.json", "nx.json",
}
LOCKFILE_NAMES = {
    "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb",
    "poetry.lock", "Pipfile.lock", "uv.lock", "requirements.lock", "Cargo.lock", "go.sum", "Gemfile.lock",
    "composer.lock", "pubspec.lock", "Package.resolved", "Podfile.lock", "mix.lock",
}
DEPLOYMENT_NAMES = {
    "Dockerfile", "docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml",
    "Procfile", "vercel.json", "netlify.toml", "render.yaml", "fly.toml", "railway.json",
    "app.yaml", "serverless.yml", "serverless.yaml", "wrangler.toml", "firebase.json",
    "cloudbuild.yaml", "cloudbuild.yml", "kustomization.yaml", "Chart.yaml",
}
DOC_NAMES = {
    "README", "README.md", "README.rst", "CONTRIBUTING.md", "SECURITY.md", "CHANGELOG.md",
    "ARCHITECTURE.md", "CODE_OF_CONDUCT.md", "SUPPORT.md", "AGENTS.md", "CLAUDE.md",
}
TEST_DIR_NAMES = {"test", "tests", "spec", "specs", "__tests__", "e2e", "integration", "integration-tests"}

JS_FRAMEWORKS = {
    "next": "Next.js", "react": "React", "vue": "Vue", "nuxt": "Nuxt", "svelte": "Svelte",
    "@sveltejs/kit": "SvelteKit", "@angular/core": "Angular", "express": "Express",
    "fastify": "Fastify", "@nestjs/core": "NestJS", "hono": "Hono", "electron": "Electron",
    "react-native": "React Native", "expo": "Expo", "vite": "Vite", "remix": "Remix",
    "@remix-run/react": "Remix", "astro": "Astro", "gatsby": "Gatsby",
}
PY_FRAMEWORKS = {
    "django": "Django", "fastapi": "FastAPI", "flask": "Flask", "starlette": "Starlette",
    "streamlit": "Streamlit", "litestar": "Litestar", "typer": "Typer", "click": "Click",
    "celery": "Celery", "pydantic": "Pydantic", "pytest": "pytest",
}


def run_git(root: Path, args: list[str]) -> str | None:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=20,
        )
        return result.stdout.strip()
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return None


def find_git_root(root: Path) -> Path | None:
    value = run_git(root, ["rev-parse", "--show-toplevel"])
    return Path(value).resolve() if value else None


def is_secret_like(path: Path) -> bool:
    name = path.name
    return any(pattern.search(name) for pattern in SECRET_NAME_PATTERNS)


def safe_text(path: Path) -> str | None:
    if is_secret_like(path) or path.suffix.lower() in BINARY_EXTENSIONS:
        return None
    try:
        if path.stat().st_size > MAX_READ_BYTES:
            return None
        data = path.read_bytes()
        if b"\x00" in data[:4096]:
            return None
        return data.decode("utf-8", errors="replace")
    except OSError:
        return None


def walk_files(root: Path, max_files: int) -> tuple[list[Path], bool]:
    files: list[Path] = []
    truncated = False
    for current, dirs, names in os.walk(root):
        current_path = Path(current)
        relative_parts = current_path.relative_to(root).parts if current_path != root else ()
        dirs[:] = [
            d for d in dirs
            if d not in DEFAULT_EXCLUDED_DIRS
            and not (relative_parts == (".agents", "skills") and d == "repository-moderniser")
            and not (relative_parts == (".claude", "skills") and d == "repository-moderniser")
        ]
        for name in names:
            if not relative_parts and name in KIT_ONLY_FILES:
                continue
            path = current_path / name
            files.append(path)
            if len(files) >= max_files:
                truncated = True
                return files, truncated
    return files, truncated


def parse_package_json(path: Path) -> dict[str, Any]:
    text = safe_text(path)
    if text is None:
        return {}
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return {"parse_error": True}
    deps: dict[str, Any] = {}
    for key in ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies"):
        value = data.get(key)
        if isinstance(value, dict):
            deps.update(value)
    scripts = data.get("scripts") if isinstance(data.get("scripts"), dict) else {}
    return {
        "name": data.get("name"),
        "private": data.get("private"),
        "package_manager": data.get("packageManager"),
        "workspaces": data.get("workspaces"),
        "scripts": scripts,
        "dependencies": sorted(deps),
    }


def parse_pyproject(path: Path) -> dict[str, Any]:
    if tomllib is None or is_secret_like(path):
        return {}
    try:
        with path.open("rb") as handle:
            data = tomllib.load(handle)
    except (OSError, ValueError):
        return {"parse_error": True}
    project = data.get("project", {}) if isinstance(data.get("project"), dict) else {}
    tool = data.get("tool", {}) if isinstance(data.get("tool"), dict) else {}
    deps: list[str] = []
    project_deps = project.get("dependencies")
    if isinstance(project_deps, list):
        deps.extend(str(x) for x in project_deps)
    poetry = tool.get("poetry", {}) if isinstance(tool.get("poetry"), dict) else {}
    poetry_deps = poetry.get("dependencies") if isinstance(poetry.get("dependencies"), dict) else {}
    deps.extend(str(x) for x in poetry_deps.keys())
    scripts: dict[str, str] = {}
    if isinstance(project.get("scripts"), dict):
        scripts.update({str(k): str(v) for k, v in project["scripts"].items()})
    if isinstance(poetry.get("scripts"), dict):
        scripts.update({str(k): str(v) for k, v in poetry["scripts"].items()})
    return {
        "name": project.get("name") or poetry.get("name"),
        "dependencies": deps,
        "scripts": scripts,
        "tools": sorted(tool.keys()),
    }


def extract_make_targets(path: Path) -> list[str]:
    text = safe_text(path)
    if text is None:
        return []
    targets: list[str] = []
    for line in text.splitlines():
        if line.startswith((" ", "\t", "#", ".")) or ":" not in line:
            continue
        target = line.split(":", 1)[0].strip()
        if target and re.fullmatch(r"[A-Za-z0-9_.-]+", target):
            targets.append(target)
    return sorted(set(targets))[:100]


def infer_python_dependencies(files: list[Path], root: Path) -> set[str]:
    deps: set[str] = set()
    for path in files:
        rel = path.relative_to(root)
        if path.name == "pyproject.toml":
            parsed = parse_pyproject(path)
            for item in parsed.get("dependencies", []):
                match = re.match(r"\s*([A-Za-z0-9_.-]+)", str(item))
                if match:
                    deps.add(match.group(1).lower().replace("_", "-"))
        elif path.name.startswith("requirements") and path.suffix in {".txt", ".in"}:
            text = safe_text(path)
            if text:
                for line in text.splitlines():
                    line = line.strip()
                    if not line or line.startswith(("#", "-")):
                        continue
                    match = re.match(r"([A-Za-z0-9_.-]+)", line)
                    if match:
                        deps.add(match.group(1).lower().replace("_", "-"))
        elif path.name == "Pipfile":
            text = safe_text(path)
            if text:
                for match in re.finditer(r"^([A-Za-z0-9_.-]+)\s*=", text, re.M):
                    deps.add(match.group(1).lower().replace("_", "-"))
    return deps


def framework_detection(files: list[Path], root: Path, package_data: dict[str, dict[str, Any]]) -> list[str]:
    found: set[str] = set()
    js_deps: set[str] = set()
    for parsed in package_data.values():
        js_deps.update(parsed.get("dependencies", []))
    for dep, label in JS_FRAMEWORKS.items():
        if dep in js_deps:
            found.add(label)
    py_deps = infer_python_dependencies(files, root)
    for dep, label in PY_FRAMEWORKS.items():
        normalized = dep.lower().replace("_", "-")
        if normalized in py_deps:
            found.add(label)
    names = {p.name for p in files}
    if "manage.py" in names:
        found.add("Django")
    if "pubspec.yaml" in names:
        text = next((safe_text(p) for p in files if p.name == "pubspec.yaml"), None)
        found.add("Flutter" if text and re.search(r"^\s*flutter\s*:", text, re.M) else "Dart")
    if "Gemfile" in names:
        text = next((safe_text(p) for p in files if p.name == "Gemfile"), None)
        if text and re.search(r"gem\s+['\"]rails['\"]", text):
            found.add("Ruby on Rails")
    if "composer.json" in names:
        text = next((safe_text(p) for p in files if p.name == "composer.json"), None)
        if text:
            if '"laravel/framework"' in text:
                found.add("Laravel")
            if '"symfony/' in text:
                found.add("Symfony")
    if "Cargo.toml" in names:
        found.add("Cargo")
    if "go.mod" in names:
        found.add("Go modules")
    return sorted(found)


def relative_strings(paths: Iterable[Path], root: Path) -> list[str]:
    return sorted(str(path.relative_to(root)).replace(os.sep, "/") for path in paths)


def build_inventory(root: Path, max_files: int) -> dict[str, Any]:
    files, truncated = walk_files(root, max_files)
    relative = [p.relative_to(root) for p in files]
    extension_counts: collections.Counter[str] = collections.Counter()
    language_counts: collections.Counter[str] = collections.Counter()
    top_level_counts: collections.Counter[str] = collections.Counter()
    total_bytes = 0

    for path, rel in zip(files, relative):
        suffix = path.suffix.lower() or "[no extension]"
        extension_counts[suffix] += 1
        if path.suffix.lower() in LANGUAGE_BY_EXTENSION:
            language_counts[LANGUAGE_BY_EXTENSION[path.suffix.lower()]] += 1
        top = rel.parts[0] if rel.parts else path.name
        top_level_counts[top] += 1
        try:
            total_bytes += path.stat().st_size
        except OSError:
            pass

    manifests = [p for p in files if p.name in MANIFEST_NAMES]
    lockfiles = [p for p in files if p.name in LOCKFILE_NAMES]
    package_files = [p for p in files if p.name == "package.json"]
    package_data = {str(p.relative_to(root)).replace(os.sep, "/"): parse_package_json(p) for p in package_files}
    pyprojects = {str(p.relative_to(root)).replace(os.sep, "/"): parse_pyproject(p) for p in files if p.name == "pyproject.toml"}

    workflows = [p for p in files if len(p.relative_to(root).parts) >= 3 and p.relative_to(root).parts[:2] == (".github", "workflows") and p.suffix.lower() in {".yml", ".yaml"}]
    deployment = [
        p for p in files
        if p.name in DEPLOYMENT_NAMES
        or "k8s" in p.relative_to(root).parts
        or "kubernetes" in p.relative_to(root).parts
        or "terraform" in p.relative_to(root).parts
        or p.suffix.lower() == ".tf"
    ]
    docs = [
        p for p in files
        if p.name in DOC_NAMES or "docs" in [part.lower() for part in p.relative_to(root).parts[:-1]]
    ]
    test_files = [
        p for p in files
        if any(part.lower() in TEST_DIR_NAMES for part in p.relative_to(root).parts[:-1])
        or re.search(r"(?:^|[._-])(test|spec)(?:[._-]|$)", p.stem, re.I)
        or p.name.endswith((".test.ts", ".test.tsx", ".test.js", ".spec.ts", ".spec.js"))
    ]
    sensitive = [p for p in files if is_secret_like(p)]
    env_examples = [p for p in files if p.name.lower() in {".env.example", ".env.sample", ".env.template", "env.example"}]

    make_targets: dict[str, list[str]] = {}
    for p in files:
        if p.name in {"Makefile", "makefile", "GNUmakefile"}:
            make_targets[str(p.relative_to(root)).replace(os.sep, "/")] = extract_make_targets(p)

    git_root = find_git_root(root)
    branch = run_git(root, ["branch", "--show-current"]) if git_root else None
    commit = run_git(root, ["rev-parse", "--short", "HEAD"]) if git_root else None
    status = run_git(root, ["status", "--porcelain=v1"]) if git_root else None
    remote_names = run_git(root, ["remote"]) if git_root else None
    submodules = run_git(root, ["submodule", "status"]) if git_root else None

    root_names = {p.name for p in files if len(p.relative_to(root).parts) == 1}
    package_manager_hints: list[str] = []
    hint_map = {
        "pnpm-lock.yaml": "pnpm", "yarn.lock": "Yarn", "package-lock.json": "npm", "bun.lock": "Bun",
        "bun.lockb": "Bun", "poetry.lock": "Poetry", "uv.lock": "uv", "Pipfile.lock": "Pipenv",
        "Cargo.lock": "Cargo", "go.sum": "Go modules", "Gemfile.lock": "Bundler", "composer.lock": "Composer",
        "pubspec.lock": "Dart/Flutter pub", "Podfile.lock": "CocoaPods",
    }
    for name, hint in hint_map.items():
        if any(p.name == name for p in lockfiles):
            package_manager_hints.append(hint)

    runtime_files = [
        p for p in files if p.name in {
            ".nvmrc", ".node-version", ".python-version", ".ruby-version", ".tool-versions", "mise.toml",
            "rust-toolchain", "rust-toolchain.toml", "global.json", "gradle.properties",
        }
    ]
    workspace_files = [p for p in files if p.name in {"pnpm-workspace.yaml", "turbo.json", "nx.json", "lerna.json", "rush.json"}]

    inventory: dict[str, Any] = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "root": str(root),
        "scan": {
            "files_scanned": len(files),
            "truncated": truncated,
            "max_files": max_files,
            "total_bytes_excluding_ignored": total_bytes,
        },
        "git": {
            "detected": git_root is not None,
            "root": str(git_root) if git_root else None,
            "branch": branch,
            "commit": commit,
            "clean": status == "" if status is not None else None,
            "status_entry_count": len(status.splitlines()) if status else 0,
            "remote_names": remote_names.splitlines() if remote_names else [],
            "submodule_count": len(submodules.splitlines()) if submodules else 0,
        },
        "top_level": dict(top_level_counts.most_common()),
        "extensions": dict(extension_counts.most_common(30)),
        "languages_by_file_count": dict(language_counts.most_common()),
        "manifests": relative_strings(manifests, root),
        "lockfiles": relative_strings(lockfiles, root),
        "runtime_version_files": relative_strings(runtime_files, root),
        "workspace_files": relative_strings(workspace_files, root),
        "package_manager_hints": sorted(set(package_manager_hints)),
        "framework_hints": framework_detection(files, root, package_data),
        "package_json": package_data,
        "pyproject": pyprojects,
        "make_targets": make_targets,
        "tests": {
            "candidate_file_count": len(test_files),
            "sample_paths": relative_strings(test_files[:200], root),
        },
        "github_actions": relative_strings(workflows, root),
        "deployment_and_infra": relative_strings(deployment, root),
        "documentation": relative_strings(docs, root),
        "sensitive_like_paths_names_only": relative_strings(sensitive, root),
        "environment_example_files": relative_strings(env_examples, root),
        "root_file_names": sorted(root_names),
    }
    return inventory


def md_list(items: list[str], empty: str = "None detected") -> str:
    return "\n".join(f"- `{item}`" for item in items) if items else f"- {empty}"


def render_markdown(data: dict[str, Any]) -> str:
    git = data["git"]
    package_scripts: list[str] = []
    for path, parsed in data["package_json"].items():
        scripts = parsed.get("scripts", {}) if isinstance(parsed, dict) else {}
        for name, command in sorted(scripts.items()):
            package_scripts.append(f"- `{path}` — `{name}`: `{command}`")
    py_scripts: list[str] = []
    for path, parsed in data["pyproject"].items():
        scripts = parsed.get("scripts", {}) if isinstance(parsed, dict) else {}
        for name, command in sorted(scripts.items()):
            py_scripts.append(f"- `{path}` — `{name}`: `{command}`")

    language_rows = "\n".join(
        f"| {name} | {count} |" for name, count in data["languages_by_file_count"].items()
    ) or "| None detected | 0 |"
    top_rows = "\n".join(
        f"| `{name}` | {count} |" for name, count in list(data["top_level"].items())[:40]
    ) or "| — | 0 |"

    lines = [
        "# Automated repository inventory",
        "",
        f"Generated: `{data['generated_at_utc']}`",
        "",
        "> This is a heuristic first pass. Verify all conclusions manually. Sensitive-looking files are listed by path only and were not read.",
        "",
        "## Git context",
        "",
        f"- Git detected: `{git['detected']}`",
        f"- Branch: `{git.get('branch') or 'unknown'}`",
        f"- Commit: `{git.get('commit') or 'unknown'}`",
        f"- Clean worktree: `{git.get('clean')}`",
        f"- Status entries: `{git.get('status_entry_count')}`",
        f"- Remotes (names only): `{', '.join(git.get('remote_names', [])) or 'none'}`",
        f"- Submodules: `{git.get('submodule_count')}`",
        "",
        "## Scan summary",
        "",
        f"- Files scanned: `{data['scan']['files_scanned']}`",
        f"- Scan truncated: `{data['scan']['truncated']}`",
        f"- Approximate bytes scanned: `{data['scan']['total_bytes_excluding_ignored']}`",
        "",
        "## Language hints",
        "",
        "| Language | File count |",
        "|---|---:|",
        language_rows,
        "",
        "## Stack hints",
        "",
        f"- Frameworks/tools: `{', '.join(data['framework_hints']) or 'none confidently detected'}`",
        f"- Package managers: `{', '.join(data['package_manager_hints']) or 'none confidently detected'}`",
        "",
        "### Manifests",
        "",
        md_list(data["manifests"]),
        "",
        "### Lockfiles",
        "",
        md_list(data["lockfiles"]),
        "",
        "### Runtime version files",
        "",
        md_list(data["runtime_version_files"]),
        "",
        "### Workspace files",
        "",
        md_list(data["workspace_files"]),
        "",
        "## Discovered commands",
        "",
        "### package.json scripts",
        "",
        "\n".join(package_scripts) if package_scripts else "- None detected",
        "",
        "### Python project scripts",
        "",
        "\n".join(py_scripts) if py_scripts else "- None detected",
        "",
        "### Make targets",
        "",
    ]
    if data["make_targets"]:
        for path, targets in data["make_targets"].items():
            lines.append(f"- `{path}`: `{', '.join(targets) or 'none parsed'}`")
    else:
        lines.append("- None detected")

    lines.extend([
        "",
        "## Tests",
        "",
        f"- Candidate test files: `{data['tests']['candidate_file_count']}`",
        "",
        md_list(data["tests"]["sample_paths"], "No candidate test files detected"),
        "",
        "## CI, deployment, and infrastructure",
        "",
        "### GitHub Actions",
        "",
        md_list(data["github_actions"]),
        "",
        "### Deployment/infrastructure files",
        "",
        md_list(data["deployment_and_infra"]),
        "",
        "## Documentation",
        "",
        md_list(data["documentation"]),
        "",
        "## Sensitive-looking paths (names only; contents not read)",
        "",
        md_list(data["sensitive_like_paths_names_only"]),
        "",
        "## Environment example files",
        "",
        md_list(data["environment_example_files"]),
        "",
        "## Top-level file distribution",
        "",
        "| Path | Files beneath/path itself |",
        "|---|---:|",
        top_rows,
        "",
        "## Manual follow-up",
        "",
        "- Confirm product purpose, entry points, deployment units, public contracts, generated paths, and ownership boundaries.",
        "- Verify commands against CI and current documentation before running them.",
        "- Treat framework and test detection as hints, not decisions.",
    ])
    return "\n".join(lines) + "\n"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Safely inventory an existing repository.")
    parser.add_argument("--root", default=".", help="Repository root (default: current directory).")
    parser.add_argument("--max-files", type=int, default=50000, help="Maximum files to scan.")
    parser.add_argument("--json-out", default=".repo-moderniser/output/inventory.json")
    parser.add_argument("--markdown-out", default=".repo-moderniser/output/INVENTORY.md")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print(f"ERROR: root is not a directory: {root}", file=sys.stderr)
        return 2
    inventory = build_inventory(root, max(100, args.max_files))
    json_path = root / args.json_out
    md_path = root / args.markdown_out
    json_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(inventory, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(inventory), encoding="utf-8")
    print(f"Wrote {json_path}")
    print(f"Wrote {md_path}")
    if inventory["scan"]["truncated"]:
        print("WARNING: scan reached --max-files and is incomplete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
