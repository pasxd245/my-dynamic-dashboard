#!/usr/bin/env python3
"""Verify markdown links resolve to existing files and headings.

Default scope reads `.markdownlint-cli2.jsonc` (globs + ignores)
at the repo root. Falls back to `.agents/**/*.md` when the config
is missing; raises on a malformed config.

This module is the orchestrator. Parsing lives in `parse.py`;
artifact writing and in-place fixes live in `output.py`. See
`.agents/skills/markdown-check-link/SKILL.md` for the full
procedure, quality bar, and fix policy.
"""

from __future__ import annotations

import argparse
import fnmatch
import functools
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Iterable, Optional
from urllib.parse import unquote, urlparse

import parse as P
import output as O
from parse import LinkRecord, Suggestion

REPO_ROOT = Path(__file__).resolve().parents[4]
CONFIG_PATH = REPO_ROOT / ".markdownlint-cli2.jsonc"
TMP_DIR = REPO_ROOT / ".agents" / "tmp" / "markdown-check-link"
FALLBACK_GLOBS = [".agents/**/*.md"]


# --------------------------------------------------------------- config


@functools.cache
def _load_config_cached() -> tuple[list[str], list[str], str]:
    """Cached wrapper over `parse.load_config` with the fallback policy.

    Missing config → warn, return FALLBACK_GLOBS.
    Malformed config → raise SystemExit so the caller exits nonzero.
    """
    if not CONFIG_PATH.exists():
        print(
            f"warning: {CONFIG_PATH} not found; falling back to {FALLBACK_GLOBS[0]}",
            file=sys.stderr,
        )
        return FALLBACK_GLOBS, [], "fallback"
    try:
        globs, ignores = P.load_config(CONFIG_PATH)
    except (ValueError, OSError) as exc:
        raise SystemExit(
            f"error: cannot parse {CONFIG_PATH}: {exc}\n"
            "fix the config file; this script will not silently "
            "fall back to a narrower scope when the source of "
            "truth is broken."
        )
    return globs, ignores, "markdownlint-cli2.jsonc"


# --------------------------------------------------------------- globs / walk


def _glob_match(path_str: str, pattern: str) -> bool:
    """fnmatch-like with `**` support across directory separators."""
    if "**" in pattern:
        regex = (
            re.escape(pattern)
            .replace(r"\*\*", ".*")
            .replace(r"\*", "[^/]*")
            .replace(r"\?", ".")
        )
        return re.fullmatch(regex, path_str) is not None
    return fnmatch.fnmatch(path_str, pattern)


def _is_excluded(path_str: str, excludes: list[str]) -> bool:
    """Return whether a repo-relative posix path matches any exclude.

    Directory patterns of the form `dir/**` match the directory
    itself as well as its descendants, so excluded trees are pruned
    entirely from the walk.
    """
    path_str = path_str.removeprefix("./").rstrip("/")
    for pattern in excludes:
        normalized = pattern.removeprefix("./").rstrip("/")
        if _glob_match(path_str, normalized):
            return True
        if normalized.endswith("/**"):
            prefix = normalized[:-3].rstrip("/")
            if path_str == prefix or path_str.startswith(f"{prefix}/"):
                return True
    return False


def _filter_excludes(paths: Iterable[Path], excludes: list[str]) -> list[Path]:
    out: list[Path] = []
    for path in paths:
        rel = path.relative_to(REPO_ROOT).as_posix()
        if _is_excluded(rel, excludes):
            continue
        out.append(path)
    return out


def _git_changed_md() -> Optional[list[Path]]:
    """Changed .md paths (unstaged + staged + untracked), or None if
    git is unavailable / we're outside a repo."""
    cmds = [
        ["git", "diff", "--name-only", "--diff-filter=ACMR"],
        ["git", "diff", "--name-only", "--cached", "--diff-filter=ACMR"],
        ["git", "ls-files", "--others", "--exclude-standard"],
    ]
    found: set[Path] = set()
    for cmd in cmds:
        try:
            out = subprocess.check_output(
                cmd, cwd=REPO_ROOT, text=True, stderr=subprocess.DEVNULL
            )
        except (subprocess.CalledProcessError, FileNotFoundError):
            return None
        for line in out.splitlines():
            line = line.strip()
            if line.endswith(".md"):
                p = (REPO_ROOT / line).resolve()
                if p.exists():
                    found.add(p)
    return sorted(found)


def _resolve_explicit(explicit_paths: list[str]) -> list[Path]:
    files: list[Path] = []
    for arg in explicit_paths:
        p = Path(arg)
        if p.is_file():
            files.append(p.resolve())
            continue
        for hit in REPO_ROOT.glob(arg):
            if hit.is_file() and hit.suffix == ".md":
                files.append(hit.resolve())
    return sorted(set(files))


def _resolve_files(
    explicit_paths: list[str],
    cli_excludes: list[str],
    changed_only: bool,
) -> tuple[list[Path], str]:
    if explicit_paths:
        return _resolve_explicit(explicit_paths), "explicit"
    if changed_only:
        changed = _git_changed_md()
        if changed is None:
            raise SystemExit(
                "error: --changed requires a git repository (and the "
                "git CLI on PATH). Run inside the repo, or drop the flag."
            )
        _, ignores, _ = _load_config_cached()
        return _filter_excludes(changed, ignores + cli_excludes), "changed"
    globs, ignores, source = _load_config_cached()
    candidates: set[Path] = set()
    for g in globs:
        for hit in REPO_ROOT.glob(g):
            if hit.is_file() and hit.suffix == ".md":
                candidates.add(hit.resolve())
    return sorted(_filter_excludes(candidates, ignores + cli_excludes)), source


def _candidate_pool(ignores: list[str]) -> list[Path]:  # NOSONAR
    """Walk the repo (within ignores) collecting every file as a
    candidate for fix-suggestions. Any extension — markdown links
    target HTML/CSS/JS/images too. Skips symlinks pointing outside
    the repo.
    """
    candidates: set[Path] = set()
    for dirpath, dirnames, filenames in os.walk(REPO_ROOT, topdown=True):
        base = Path(dirpath)
        kept = []
        for dirname in dirnames:
            candidate_dir = base / dirname
            try:
                rel_dir = candidate_dir.relative_to(REPO_ROOT).as_posix()
            except ValueError:
                continue
            if not _is_excluded(rel_dir, ignores):
                kept.append(dirname)
        dirnames[:] = kept
        for filename in filenames:
            hit = base / filename
            try:
                rel_file = hit.relative_to(REPO_ROOT).as_posix()
            except ValueError:
                continue
            if _is_excluded(rel_file, ignores):
                continue
            if not hit.is_file():
                continue
            try:
                resolved = hit.resolve()
                resolved.relative_to(REPO_ROOT)
            except (ValueError, OSError):
                continue
            candidates.add(resolved)
    return sorted(candidates)


def _basename_index(paths: Iterable[Path]) -> dict[str, list[Path]]:
    index: dict[str, list[Path]] = {}
    for path in paths:
        index.setdefault(path.name, []).append(path)
    return index


# --------------------------------------------------------------- suggest


@functools.cache
def _git_rename_index() -> dict[str, str]:
    """Build {old_path: new_path} from all renames in git history.

    Loaded once and cached. `git log -- <path>` filters by the
    *current* tree, so a pathspec query for a deleted path returns
    nothing — we need the full rename log up front. Cheap: ~30ms
    even on this repo's full history with `--all`.
    """
    try:
        out = subprocess.check_output(
            [
                "git",
                "log",
                "--diff-filter=R",
                "--name-status",
                "--format=",
                "--all",
            ],
            cwd=REPO_ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
            timeout=10,
        )
    except (
        subprocess.CalledProcessError,
        FileNotFoundError,
        subprocess.TimeoutExpired,
    ):
        return {}
    renames: dict[str, str] = {}
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) == 3 and parts[0].startswith("R"):
            old, new = parts[1], parts[2]
            # First rename wins (git log is reverse-chronological, so
            # newer entries appear first; we want the most recent
            # destination per old path).
            renames.setdefault(old, new)
    return renames


def _git_rename_target(rel_broken: str) -> Optional[str]:
    """Follow the rename chain from `rel_broken` until we hit a path
    that currently exists, or the chain terminates. Returns the
    final existing destination, or None.
    """
    renames = _git_rename_index()
    seen: set[str] = set()
    current = rel_broken
    while current in renames and current not in seen:
        seen.add(current)
        current = renames[current]
    if current == rel_broken:
        return None
    if (REPO_ROOT / current).exists():
        return current
    return None


def _rel_from(target: Path, source_dir: Path) -> str:
    try:
        return target.resolve().relative_to(source_dir.resolve()).as_posix()
    except ValueError:
        return os.path.relpath(target, source_dir)


def _dedup_extend(
    suggestions: list[Suggestion],
    new: Iterable[Suggestion],
) -> None:
    """Append suggestions, keeping the best score per `path`."""
    by_path = {s.path: s for s in suggestions}
    for s in new:
        existing = by_path.get(s.path)
        if existing is None or s.score > existing.score:
            by_path[s.path] = s
    suggestions[:] = sorted(by_path.values(), key=lambda s: s.score, reverse=True)


def _suggest_for_missing_path(  # NOSONAR
    rec: LinkRecord,
    target_path: Path,
    source_file: Path,
    candidate_index: dict[str, list[Path]],
) -> None:
    """Populate `rec.suggestions` with scored replacements for a
    missing file target.

    Tiers, highest score first:
        1.00  git-rename       — git history records the rename
        0.95  case-mismatch    — same parent dir, basename differs by case only
        0.90  unique-basename  — exactly one file with this basename anywhere
        0.50  ambiguous-basename — multiple candidates; surfaced for review
    """
    target_name = target_path.name
    target_parent = target_path.parent
    out: list[Suggestion] = []

    # 1.00 — git-rename
    try:
        rel_broken = target_path.relative_to(REPO_ROOT).as_posix()
    except ValueError:
        rel_broken = None
    if rel_broken:
        new_rel = _git_rename_target(rel_broken)
        if new_rel:
            relpath = _rel_from(REPO_ROOT / new_rel, source_file.parent)
            out.append(Suggestion(relpath, 1.0, "git-rename"))

    # 0.95 — case-only mismatch, same directory
    if target_parent.exists():
        for sibling in target_parent.iterdir():
            if (
                sibling.name.lower() == target_name.lower()
                and sibling.name != target_name
            ):
                rel = (
                    (Path(rec.target).parent / sibling.name).as_posix()
                    if "/" in rec.target
                    else sibling.name
                )
                out.append(Suggestion(rel, 0.95, "case-mismatch"))
                break

    # 0.90 / 0.50 — basename matches anywhere in scope
    matches = candidate_index.get(target_name, [])
    if len(matches) == 1:
        out.append(
            Suggestion(
                _rel_from(matches[0], source_file.parent), 0.9, "unique-basename"
            )
        )
    elif len(matches) > 1:
        for m in matches:
            out.append(
                Suggestion(_rel_from(m, source_file.parent), 0.5, "ambiguous-basename")
            )

    _dedup_extend(rec.suggestions, out)


def _suggest_for_missing_fragment(
    rec: LinkRecord,
    frag: str,
    file_headings: set[str],
) -> None:
    """Populate `rec.suggestions` for a missing heading fragment.

    0.95  fragment-case        — exactly one case-insensitive match
    0.50  ambiguous-fragment   — multiple — surfaced for review
    """
    matches = sorted(s for s in file_headings if s.lower() == frag.lower())
    base = rec.target.split("#", 1)[0] if "#" in rec.target else ""
    out: list[Suggestion] = []
    if len(matches) == 1 and matches[0] != frag:
        path = f"{base}#{matches[0]}" if base else f"#{matches[0]}"
        out.append(Suggestion(path, 0.95, "fragment-case"))
    elif len(matches) > 1:
        for m in matches:
            path = f"{base}#{m}" if base else f"#{m}"
            out.append(Suggestion(path, 0.5, "ambiguous-fragment"))
    _dedup_extend(rec.suggestions, out)


# --------------------------------------------------------------- verify


def _is_http(target: str) -> bool:
    return target.startswith(("http://", "https://"))


def _verify_local(  # NOSONAR
    rec: LinkRecord,
    source_file: Path,
    candidate_index: dict[str, list[Path]],
    headings_cache: dict[Path, set[str]],
) -> None:
    target = rec.target
    parsed = urlparse(target)
    if parsed.scheme and parsed.scheme != "file":
        rec.status = "skipped"
        rec.reason = f"non-http scheme: {parsed.scheme}"
        return

    if target.startswith("#"):
        slug = unquote(target[1:])
        headings = headings_cache.setdefault(source_file, P.headings(source_file))
        rec.resolved_path = source_file.relative_to(REPO_ROOT).as_posix()
        if slug in headings:
            rec.status = "ok"
        else:
            rec.status = "broken"
            rec.reason = f"no heading '#{slug}' in this file"
            _suggest_for_missing_fragment(rec, slug, headings)
        return

    if "#" in target:
        path_part, frag = target.split("#", 1)
    else:
        path_part, frag = target, None
    path_part = unquote(path_part)
    if frag is not None:
        frag = unquote(frag)

    target_path = (source_file.parent / path_part).resolve()
    try:
        rel_target = target_path.relative_to(REPO_ROOT).as_posix()
    except ValueError:
        rel_target = str(target_path)
    rec.resolved_path = rel_target

    if not target_path.exists():
        rec.status = "broken"
        rec.reason = "target file does not exist"
        _suggest_for_missing_path(rec, target_path, source_file, candidate_index)
        return

    if frag and target_path.suffix == ".md":
        headings = headings_cache.setdefault(target_path, P.headings(target_path))
        if frag in headings:
            rec.status = "ok"
        else:
            rec.status = "broken"
            rec.reason = f"no heading '#{frag}' in {rel_target}"
            _suggest_for_missing_fragment(rec, frag, headings)
        return

    rec.status = "ok"


def _verify_http(rec: LinkRecord) -> None:
    req = urllib.request.Request(rec.target, method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:  # noqa: S310 — opt-in
            code = resp.status
            if code >= 400:
                rec.status = "broken"
                rec.reason = f"HTTP {code}"
            else:
                rec.status = "ok"
    except urllib.error.HTTPError as exc:
        rec.status = "broken"
        rec.reason = f"HTTP {exc.code}"
    except OSError as exc:
        rec.status = "skipped"
        rec.reason = f"network unreachable: {exc}"


def _verify_one(
    rec: LinkRecord,
    candidate_index: dict[str, list[Path]],
    headings_cache: dict[Path, set[str]],
    check_http: bool,
) -> None:
    if rec.kind == "error":
        return
    if _is_http(rec.target):
        if check_http:
            _verify_http(rec)
        else:
            rec.status = "skipped"
            rec.reason = "http skipped (no --check-http)"
        return
    _verify_local(rec, REPO_ROOT / rec.file, candidate_index, headings_cache)


def _scan_and_verify(
    files: list[Path],
    candidate_pool: list[Path],
    check_http: bool,
) -> list[LinkRecord]:
    headings_cache: dict[Path, set[str]] = {}
    candidate_index = _basename_index(candidate_pool)
    records: list[LinkRecord] = []
    for f in files:
        rel = f.relative_to(REPO_ROOT).as_posix()
        records.extend(P.parse_links(f, rel))
    for rec in records:
        _verify_one(rec, candidate_index, headings_cache, check_http)
    return records


# --------------------------------------------------------------- main


def main(argv: list[str] | None = None) -> int:  # NOSONAR
    parser = argparse.ArgumentParser(
        prog="check_links",
        description=(
            "Verify markdown links resolve. Reads "
            ".markdownlint-cli2.jsonc by default; falls back to "
            ".agents/**/*.md if missing. Emits links.json + "
            "suggestions.json + broken.md under "
            ".agents/tmp/markdown-check-link/."
        ),
    )
    parser.add_argument("paths", nargs="*", help="Override scope (file or glob).")
    parser.add_argument(
        "--check-http",
        action="store_true",
        help="HEAD-check HTTP(S) links (5s timeout). Off by default.",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        metavar="PATTERN",
        help="Extra glob to exclude (repeatable).",
    )
    parser.add_argument(
        "--changed",
        action="store_true",
        help=(
            "Scope to changed .md files only (unstaged + staged + "
            "untracked, intersected with config ignores)."
        ),
    )
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=O.APPLY_THRESHOLD,
        metavar="FLOAT",
        help=(
            f"Confidence threshold for --fix / --dry-run (default "
            f"{O.APPLY_THRESHOLD}). Lower to apply less-certain "
            f"suggestions."
        ),
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--fix",
        action="store_true",
        help="Apply suggestions at or above --min-confidence in place.",
    )
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview suggestions at or above --min-confidence; no writes.",
    )
    args = parser.parse_args(argv)

    files, source = _resolve_files(args.paths, args.exclude, args.changed)
    if not files:
        msg = (
            "no changed markdown files in scope"
            if args.changed
            else "no markdown files in scope"
        )
        print(msg, file=sys.stderr)
        O.write_artifacts([], TMP_DIR, REPO_ROOT)
        return 0

    _, ignores, _ = _load_config_cached() if CONFIG_PATH.exists() else ([], [], "")
    pool = _candidate_pool(ignores + args.exclude)
    print(
        f"scanning {len(files)} file(s) (scope: {source}); "
        f"candidate pool: {len(pool)} files",
        file=sys.stderr,
    )

    records = _scan_and_verify(files, pool, check_http=args.check_http)

    # Overrides run on EVERY pass: `as-is` is a verifier-time
    # decision (always honoured); unlink/link/score overrides are
    # only loaded under --fix/--dry-run so default-mode reports
    # stay faithful to the heuristics.
    fix_mode = args.fix or args.dry_run
    overrides = O.load_overrides(TMP_DIR / O.OVERRIDE_FILENAME)
    if overrides:
        counts, stale = O.apply_overrides(records, overrides, fix_mode=fix_mode)
        if counts["as-is"]:
            print(
                f"accepted {counts['as-is']} link(s) as-is from {O.OVERRIDE_FILENAME}",
                file=sys.stderr,
            )
        if counts["fix-pending"]:
            print(
                f"loaded {counts['fix-pending']} fix-pending override(s) "
                f"from {O.OVERRIDE_FILENAME}",
                file=sys.stderr,
            )
        for key in stale:
            print(
                f"warning: override entry {key} matched no broken "
                "link (link already fixed or source file changed)",
                file=sys.stderr,
            )

    if fix_mode:
        diff = O.apply_fixes(
            records, REPO_ROOT, dry_run=args.dry_run, threshold=args.min_confidence
        )
        if diff:
            print(f"\n--- {'dry-run' if args.dry_run else 'fix'} diff ---")
            for line in diff:
                print(line)
        else:
            print(
                f"no suggestions met --min-confidence {args.min_confidence}",
                file=sys.stderr,
            )

    O.write_artifacts(records, TMP_DIR, REPO_ROOT)
    return O.print_report(records)


if __name__ == "__main__":
    sys.exit(main())
