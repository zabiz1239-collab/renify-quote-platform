# Phase 9 — Archive and remove the temporary kit

This phase occurs only after a human has reviewed the diff and completion report.

Run:

```bash
python .repo-moderniser/scripts/archive_and_clean.py --root .
```

The cleanup script requires a satisfactory completion report and validator result unless `--force` is explicitly supplied. It:

- archives reports and configuration under `docs/migrations/<date>-repository-modernisation/`;
- removes marked temporary instruction blocks while preserving permanent project instructions;
- removes the temporary Codex and Claude modernisation skills;
- removes temporary prompt files and `.repo-moderniser/`;
- leaves `.ai/`, project documentation, application changes, and permanent instructions intact.

After cleanup, rerun the project's fast validation and inspect `git status` before committing or opening a pull request.
