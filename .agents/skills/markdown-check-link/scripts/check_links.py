#!/usr/bin/env python3
"""Verify markdown links resolve to existing files and headings.

Default scope reads `.markdownlint-cli2.jsonc` (globs + ignores)
at the repo root. Falls back to `.agents/**/*.md` when the config
is missing; raises on a malformed config.

See `.agents/skills/markdown-check-link/SKILL.md` for the full
procedure, quality bar, and fix policy.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable, Optional
from urllib.parse import urlparse, unquote

REPO_ROOT = Path(__file__).resolve().parents[4]
CONFIG_PATH = REPO_ROOT / ".markdownlint-cli2.jsonc"
TMP_DIR = REPO_ROOT / ".agents" / "tmp" / "markdown-check-link"
FALLBACK_GLOBS = [".agents/**/*.md"]

INLINE_LINK_RE = re.compile(r"(?<!\\)!?\[([^\]\n]*)\]\(([^)\n]+)\)")
REF_DEF_RE = re.compile(r"^ {0,3}\[([^\]\n]+)\]:[ \t]+(\S+)")
HEADING_RE = re.compile(r"^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$")
FENCE_RE = re.compile(r"^(\s{0,3})(```+|~~~+)")


def _strip_inline_code(line: str) -> str:  # NOSONAR
    """Replace inline-code spans with same-length spaces so link
    indices remain stable but the link regex can't match inside.

    Handles `single`, ``double``, and ```triple-tick`` spans on a
    single line. Multi-line code spans are rare in markdown prose;
    we don't try to span lines.
    """
    out = list(line)
    i, n = 0, len(line)
    while i < n:
        if line[i] != "`":
            i += 1
            continue
        # Count opening ticks
        j = i
        while j < n and line[j] == "`":
            j += 1
        run = j - i
        # Find matching closing run of the same length
        k = j
        while k < n:
            if line[k] == "`":
                m = k
                while m < n and line[m] == "`":
                    m += 1
                if m - k == run:
                    # Mask from opening run-end to closing run-start
                    for p in range(j, k):
                        out[p] = " "
                    i = m
                    break
                k = m
            else:
                k += 1
        else:
            i = j
    return "".join(out)


@dataclass
class LinkRecord:
    file: str
    line: int
    kind: str  # inline | image | ref-def
    text: str
    target: str
    resolved_path: Optional[str] = None
    status: str = "ok"
    reason: Optional[str] = None
    fix_candidate: Optional[str] = None
    conflict_candidates: Optional[list[str]] = None


# --------------------------------------------------------------- config


def _strip_jsonc(text: str) -> str:
    """Strip // line comments and /* */ block comments outside strings."""
    out = []
    i, n = 0, len(text)
    in_str = False
    str_ch = ""
    while i < n:
        c = text[i]
        if in_str:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(text[i + 1])
                i += 2
                continue
            if c == str_ch:
                in_str = False
            i += 1
            continue
        if c in ('"', "'"):
            in_str = True
            str_ch = c
            out.append(c)
            i += 1
            continue
        if c == "/" and i + 1 < n:
            nx = text[i + 1]
            if nx == "/":
                j = text.find("\n", i)
                i = n if j == -1 else j
                continue
            if nx == "*":
                j = text.find("*/", i + 2)
                if j == -1:
                    raise ValueError("unterminated /* */ comment")
                i = j + 2
                continue
        out.append(c)
        i += 1
    return "".join(out)


def _load_config() -> tuple[list[str], list[str], str]:
    """Return (globs, ignores, source_label).

    - Missing config: warn, fall back to FALLBACK_GLOBS.
    - Malformed config: raise (caller exits nonzero).
    """
    if not CONFIG_PATH.exists():
        print(
            f"warning: {CONFIG_PATH} not found; falling back to {FALLBACK_GLOBS[0]}",
            file=sys.stderr,
        )
        return FALLBACK_GLOBS, [], "fallback"
    try:
        text = CONFIG_PATH.read_text(encoding="utf-8")
        cfg = json.loads(_strip_jsonc(text))
    except (ValueError, OSError) as exc:
        raise SystemExit(
            f"error: cannot parse {CONFIG_PATH}: {exc}\n"
            f"fix the config file; this script will not silently "
            f"fall back to a narrower scope when the source of "
            f"truth is broken."
        )
    globs = cfg.get("globs") or ["**/*.md"]
    ignores = cfg.get("ignores") or []
    return globs, ignores, "markdownlint-cli2.jsonc"


# --------------------------------------------------------------- walk


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


def _git_changed_md() -> Optional[list[Path]]:
    """Return all .md paths changed vs HEAD or untracked, or None if
    not in a git repo / git unavailable."""
    cmds = [
        # Working tree vs index (unstaged); A/C/M/R only — skip deletions.
        ["git", "diff", "--name-only", "--diff-filter=ACMR"],
        # Index vs HEAD (staged).
        ["git", "diff", "--name-only", "--cached", "--diff-filter=ACMR"],
        # Untracked files (respecting .gitignore).
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


def _filter_excludes(paths: Iterable[Path], excludes: list[str]) -> list[Path]:
    out: list[Path] = []
    for path in paths:
        rel = path.relative_to(REPO_ROOT).as_posix()
        if any(_glob_match(rel, ex) for ex in excludes):
            continue
        out.append(path)
    return out


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
    changed_only: bool = False,
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
        _, ignores, _ = _load_config()
        return _filter_excludes(changed, ignores + cli_excludes), "changed"

    globs, ignores, source = _load_config()
    candidates: set[Path] = set()
    for g in globs:
        for hit in REPO_ROOT.glob(g):
            if hit.is_file() and hit.suffix == ".md":
                candidates.add(hit.resolve())
    return sorted(_filter_excludes(candidates, ignores + cli_excludes)), source


# --------------------------------------------------------------- parse


def _slugify(heading: str) -> str:
    """Common kebab-case slug (lowercase, spaces → -, strip punctuation)."""
    s = heading.strip().lower()
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s


def _headings(path: Path) -> dict[str, list[int]]:
    """Return {slug: [count_index]} for collision detection."""
    result: dict[str, list[int]] = {}
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return result
    in_fence = False
    fence_marker = ""
    for line in text.splitlines():
        fm = FENCE_RE.match(line)
        if fm:
            marker = fm.group(2)
            if not in_fence:
                in_fence = True
                fence_marker = marker[:3]
            elif marker.startswith(fence_marker):
                in_fence = False
            continue
        if in_fence:
            continue
        hm = HEADING_RE.match(line)
        if hm:
            slug = _slugify(hm.group(2))
            result.setdefault(slug, []).append(len(result))
    return result


def _parse_links(path: Path) -> list[LinkRecord]:
    """Extract inline, image, and ref-def links, skipping fenced code."""
    out: list[LinkRecord] = []
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        out.append(
            LinkRecord(
                file=path.relative_to(REPO_ROOT).as_posix(),
                line=0,
                kind="error",
                text="",
                target="",
                status="broken",
                reason=f"cannot read file: {exc}",
            )
        )
        return out

    in_fence = False
    fence_marker = ""
    rel = path.relative_to(REPO_ROOT).as_posix()
    for lineno, line in enumerate(text.splitlines(), start=1):
        fm = FENCE_RE.match(line)
        if fm:
            marker = fm.group(2)
            if not in_fence:
                in_fence = True
                fence_marker = marker[:3]
            elif marker.startswith(fence_marker):
                in_fence = False
            continue
        if in_fence:
            continue
        scan_line = _strip_inline_code(line)
        rd = REF_DEF_RE.match(scan_line)
        if rd:
            text_val = line[rd.start(1) : rd.end(1)]
            target = rd.group(2).strip("<>")
            out.append(
                LinkRecord(
                    file=rel,
                    line=lineno,
                    kind="ref-def",
                    text=text_val,
                    target=target,
                )
            )
            continue
        for m in INLINE_LINK_RE.finditer(scan_line):
            text_val = line[m.start(1) : m.end(1)]
            target = m.group(2).strip()
            target = target.split(" ", 1)[0].strip("<>")
            if not target:
                continue
            kind = "image" if scan_line[m.start()] == "!" else "inline"
            out.append(
                LinkRecord(
                    file=rel,
                    line=lineno,
                    kind=kind,
                    text=text_val,
                    target=target,
                )
            )
    return out


# --------------------------------------------------------------- verify


def _is_http(target: str) -> bool:
    return target.startswith(("http://", "https://"))


def _verify_local(
    rec: LinkRecord,
    file_path: Path,
    all_files: list[Path],
    headings_cache: dict[Path, dict[str, list[int]]],
) -> None:
    target = rec.target
    # mailto, tel, etc. → skip
    parsed = urlparse(target)
    if parsed.scheme and parsed.scheme not in ("file",):
        rec.status = "skipped"
        rec.reason = f"non-http scheme: {parsed.scheme}"
        return

    # Pure fragment → check own file
    if target.startswith("#"):
        slug = unquote(target[1:])
        headings = headings_cache.setdefault(file_path, _headings(file_path))
        rec.resolved_path = file_path.relative_to(REPO_ROOT).as_posix()
        if slug in headings:
            rec.status = "ok"
        else:
            rec.status = "broken"
            rec.reason = f"no heading '#{slug}' in this file"
            _suggest_fragment(rec, slug, headings)
        return

    # Split path + fragment
    if "#" in target:
        path_part, frag = target.split("#", 1)
    else:
        path_part, frag = target, None
    path_part = unquote(path_part)
    if frag is not None:
        frag = unquote(frag)

    # Resolve relative to the source file's directory
    target_path = (file_path.parent / path_part).resolve()
    try:
        rel_target = target_path.relative_to(REPO_ROOT).as_posix()
    except ValueError:
        rel_target = str(target_path)
    rec.resolved_path = rel_target

    if not target_path.exists():
        rec.status = "broken"
        rec.reason = "target file does not exist"
        _suggest_path(rec, target_path, file_path, all_files)
        return

    # File exists; check fragment if any
    if frag and target_path.suffix == ".md":
        headings = headings_cache.setdefault(target_path, _headings(target_path))
        if frag in headings:
            rec.status = "ok"
        else:
            rec.status = "broken"
            rec.reason = f"no heading '#{frag}' in {rel_target}"
            _suggest_fragment(rec, frag, headings)
        return

    rec.status = "ok"


def _suggest_path(
    rec: LinkRecord,
    target_path: Path,
    source_file: Path,
    all_files: list[Path],
) -> None:
    """Populate fix_candidate per the three safe rules."""
    target_name = target_path.name
    target_parent = target_path.parent

    # Rule 1: case-only mismatch in same directory.
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
                rec.fix_candidate = rel
                return

    # Rule 3: single unambiguous basename match anywhere in scope.
    # Multiple matches → record as a conflict, no auto-fix.
    matches = [p for p in all_files if p.name == target_name]
    if len(matches) == 1:
        rec.fix_candidate = _rel_from(matches[0], source_file.parent)
    elif len(matches) > 1:
        rec.conflict_candidates = sorted(
            _rel_from(m, source_file.parent) for m in matches
        )


def _rel_from(target: Path, source_dir: Path) -> str:
    """Path of target relative to source_dir, posix-style."""
    try:
        return target.resolve().relative_to(source_dir.resolve()).as_posix()
    except ValueError:
        import os

        return os.path.relpath(target, source_dir)


def _suggest_fragment(
    rec: LinkRecord,
    frag: str,
    headings: dict[str, list[int]],
) -> None:
    """Case-insensitive fragment fix; multiple matches → conflict."""
    matches = [slug for slug in headings if slug.lower() == frag.lower()]
    base = rec.target.split("#", 1)[0] if "#" in rec.target else ""
    if len(matches) == 1 and matches[0] != frag:
        rec.fix_candidate = f"{base}#{matches[0]}" if base else f"#{matches[0]}"
    elif len(matches) > 1:
        rec.conflict_candidates = sorted(
            f"{base}#{m}" if base else f"#{m}" for m in matches
        )


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


# --------------------------------------------------------------- fix


def _apply_fixes(records: list[LinkRecord], dry_run: bool) -> list[str]:
    """Apply / preview safe-candidate fixes. Returns diff-like lines."""
    by_file: dict[str, list[LinkRecord]] = {}
    for rec in records:
        if rec.status == "broken" and rec.fix_candidate:
            by_file.setdefault(rec.file, []).append(rec)

    diff_out: list[str] = []
    for rel_file, recs in sorted(by_file.items()):
        path = REPO_ROOT / rel_file
        try:
            lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
        except OSError as exc:
            print(f"warning: cannot read {rel_file}: {exc}", file=sys.stderr)
            continue
        original = list(lines)
        recs_by_line: dict[int, list[LinkRecord]] = {}
        for r in recs:
            recs_by_line.setdefault(r.line, []).append(r)

        # Iterate bottom-up so any future fix shape that adds or
        # removes lines doesn't invalidate the line numbers of
        # earlier records. Today's in-place replacement doesn't
        # need this, but it's cheap insurance.
        for lineno in sorted(recs_by_line.keys(), reverse=True):
            idx = lineno - 1
            if idx >= len(lines):
                continue
            new_line = lines[idx]
            for r in recs_by_line[lineno]:
                # Replace first occurrence inside () or after ]: ; safe
                # because we keyed on (file, line) and the target is the
                # exact text we found.
                new_line = new_line.replace(r.target, r.fix_candidate, 1)
            lines[idx] = new_line

        if lines != original:
            diff_out.append(f"--- {rel_file}")
            diff_out.append(f"+++ {rel_file}")
            for i, (a, b) in enumerate(zip(original, lines), start=1):
                if a != b:
                    diff_out.append(f"@@ line {i} @@")
                    diff_out.append(f"-{a.rstrip()}")
                    diff_out.append(f"+{b.rstrip()}")
            if not dry_run:
                path.write_text("".join(lines), encoding="utf-8")

    return diff_out


# --------------------------------------------------------------- output


def _file_tree(by_file: dict[str, list[LinkRecord]]) -> dict:
    """Produce the canonical {root_path, files: {<path>: {items}}} shape."""
    return {
        "root_path": str(REPO_ROOT),
        "files": {
            f: {"items": [asdict(r) for r in items]}
            for f, items in sorted(by_file.items())
        },
    }


def _group_by_file(records: list[LinkRecord]) -> dict[str, list[LinkRecord]]:
    by_file: dict[str, list[LinkRecord]] = {}
    for r in records:
        by_file.setdefault(r.file, []).append(r)
    for items in by_file.values():
        items.sort(key=lambda r: r.line)
    return by_file


def _filter_subset(
    by_file: dict[str, list[LinkRecord]],
    keep: "callable",
) -> dict[str, list[LinkRecord]]:
    out = {f: [r for r in items if keep(r)] for f, items in by_file.items()}
    return {f: items for f, items in out.items() if items}


def _write_artifacts(records: list[LinkRecord]) -> None:
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    by_file = _group_by_file(records)
    conflicts = _filter_subset(by_file, lambda r: bool(r.conflict_candidates))
    broken = _filter_subset(by_file, lambda r: r.status == "broken")

    (TMP_DIR / "links.json").write_text(
        json.dumps(_file_tree(by_file), indent=2),
        encoding="utf-8",
    )
    (TMP_DIR / "conflicts.json").write_text(
        json.dumps(_file_tree(conflicts), indent=2),
        encoding="utf-8",
    )
    (TMP_DIR / "broken.md").write_text(
        _render_broken_md(broken, len(conflicts) and sum(len(v) for v in conflicts.values())),
        encoding="utf-8",
    )


def _render_broken_md(
    broken_by_file: dict[str, list[LinkRecord]],
    conflict_total: int,
) -> str:
    total_broken = sum(len(items) for items in broken_by_file.values())
    out = ["# Broken markdown links\n"]
    if not total_broken:
        out.append("_All links resolved cleanly._\n")
        return "\n".join(out)

    summary = f"_Total broken: {total_broken}"
    if conflict_total:
        summary += (
            f" (of which {conflict_total} are ambiguous — see conflicts.json)"
        )
    summary += "_\n"
    out.append(summary)

    for f, recs in sorted(broken_by_file.items()):
        out.append(f"\n## `{f}`\n")
        for r in recs:
            out.append(
                f"- L{r.line} `{r.kind}`: `[{r.text}]({r.target})` — {r.reason}"
            )
            if r.fix_candidate:
                out.append(f"  - **Fix candidate**: `{r.fix_candidate}`")
            if r.conflict_candidates:
                out.append("  - **Conflict — multiple candidates**:")
                for c in r.conflict_candidates:
                    out.append(f"    - `{c}`")
        out.append("")
    return "\n".join(out)


def _print_report(records: list[LinkRecord]) -> int:
    broken = [r for r in records if r.status == "broken"]
    for r in broken:
        print(
            f"{r.file}:{r.line}: [{r.text}] → {r.target} ({r.reason})",
            file=sys.stderr,
        )
    return 1 if broken else 0


# --------------------------------------------------------------- main


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="check_links",
        description=(
            "Verify markdown links resolve. Reads "
            ".markdownlint-cli2.jsonc by default; falls back to "
            ".agents/**/*.md if missing. Emits "
            ".agents/tmp/markdown-check-link/links.json + broken.md."
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
            "untracked, intersected with config ignores). Useful in "
            "pre-commit hooks."
        ),
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--fix",
        action="store_true",
        help="Apply safe-candidate fixes in place.",
    )
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview safe-candidate fixes; no writes.",
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
        _write_artifacts([])
        return 0
    print(
        f"scanning {len(files)} file(s) (scope: {source})",
        file=sys.stderr,
    )

    all_records = _scan_and_verify(files, check_http=args.check_http)

    if args.fix or args.dry_run:
        _run_fix_mode(all_records, dry_run=args.dry_run)

    _write_artifacts(all_records)
    return _print_report(all_records)


def _scan_and_verify(files: list[Path], check_http: bool) -> list[LinkRecord]:
    headings_cache: dict[Path, dict[str, list[int]]] = {}
    records: list[LinkRecord] = []
    for f in files:
        records.extend(_parse_links(f))

    for rec in records:
        _verify_one(rec, files, headings_cache, check_http)
    return records


def _verify_one(
    rec: LinkRecord,
    files: list[Path],
    headings_cache: dict[Path, dict[str, list[int]]],
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
    source_path = REPO_ROOT / rec.file
    _verify_local(rec, source_path, files, headings_cache)


def _run_fix_mode(records: list[LinkRecord], dry_run: bool) -> None:
    diff = _apply_fixes(records, dry_run=dry_run)
    if diff:
        print(f"\n--- {'dry-run' if dry_run else 'fix'} diff ---")
        for line in diff:
            print(line)
    else:
        print("no safe-candidate fixes available", file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())
