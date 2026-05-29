"""Write-side: artifact emission, broken-link rendering, in-place fixes.

Inputs are `LinkRecord`s produced by `parse.py` and verified by
`check_links.py`. Outputs are files under
`.agents/tmp/markdown-check-link/` and (for `--fix`/`--dry-run`)
diff lines / file writes.
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Callable, Iterable, Optional

from parse import LinkRecord, Suggestion

APPLY_THRESHOLD = 0.9  # Auto-apply only this confident or higher.
OVERRIDE_FILENAME = "suggestions.fixed.json"


# --------------------------------------------------------------- overrides


def load_overrides(  # NOSONAR
    path: Path,
) -> dict[tuple[str, int, str], tuple[list[Suggestion], Optional[str]]]:
    """Read user-edited suggestion scores from `path` (same schema as
    suggestions.json) and return a {(file, line, target): suggestions} map.

    Workflow: a user copies `suggestions.json` → `suggestions.fixed.json`,
    edits the `score` fields to express their disambiguation choice
    (typically bumping one candidate to ≥ 0.9), then re-runs with
    `--fix` / `--dry-run`. Per-record override fully replaces the
    heuristic suggestion list for that link.

    Missing file → empty (silent — the file is opt-in).
    Malformed file → warn + empty (don't crash the audit run).
    """
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        print(f"warning: cannot read {path}: {exc}", file=sys.stderr)
        return {}
    out: dict[tuple[str, int, str], tuple[list[Suggestion], Optional[str]]] = {}
    for payload in (data.get("files") or {}).values():
        for item in payload.get("items") or []:
            try:
                key = (item["file"], int(item["line"]), item["target"])
            except (KeyError, TypeError, ValueError):
                continue
            suggestions = []
            for s in item.get("suggestions") or []:
                try:
                    suggestions.append(
                        Suggestion(
                            s["path"],
                            float(s["score"]),
                            s.get("reason") or "user-override",
                        )
                    )
                except (KeyError, TypeError, ValueError):
                    continue
            suggestions.sort(key=lambda x: x.score, reverse=True)
            resolution = item.get("resolution")
            if resolution is not None:
                kind, _ = parse_resolution(resolution)
                if kind is None:
                    print(
                        f"warning: unknown resolution '{resolution}' for "
                        f"{key} — ignoring (known kinds: "
                        f"{sorted(RESOLUTION_TYPES)}, optional ':value' suffix)",
                        file=sys.stderr,
                    )
                    resolution = None
            out[key] = (suggestions, resolution)
    return out


def apply_overrides(
    records: list[LinkRecord],
    overrides: dict[tuple[str, int, str], tuple[list[Suggestion], Optional[str]]],
    fix_mode: bool,
) -> tuple[dict[str, int], list[tuple[str, int, str]]]:
    """Apply user-edited overrides to records.

    `as-is` resolutions take effect on EVERY run: the record's
    status flips from `broken` to `ok` (with `resolution: "as-is"`
    kept as an audit trail). This is the verifier-time decision —
    "this isn't broken, the checker was wrong".

    Other resolutions and suggestion-score overrides are fix-time
    decisions: applied only when `fix_mode=True` (i.e. under `--fix`
    or `--dry-run`). Outside fix mode they're left out of the
    in-memory record so the report and exit code stay accurate.

    Returns `({"as-is": N, "fix-pending": M}, stale_keys)`. A stale
    key matched no currently-broken record — link already fixed,
    or source file changed between runs.
    """
    unmatched = set(overrides.keys())
    counts = {"as-is": 0, "fix-pending": 0}
    for rec in records:
        if rec.status != "broken":
            continue
        key = (rec.file, rec.line, rec.target)
        if key not in overrides:
            continue
        suggestions, resolution = overrides[key]
        unmatched.discard(key)
        kind, _ = parse_resolution(resolution)
        if kind == "as-is":
            rec.status = "ok"
            rec.reason = None
            rec.resolution = resolution
            counts["as-is"] += 1
        elif fix_mode:
            rec.suggestions = suggestions
            rec.resolution = resolution
            counts["fix-pending"] += 1
    return counts, sorted(unmatched)


# --------------------------------------------------------------- grouping


def group_by_file(records: Iterable[LinkRecord]) -> dict[str, list[LinkRecord]]:
    by_file: dict[str, list[LinkRecord]] = {}
    for r in records:
        by_file.setdefault(r.file, []).append(r)
    for items in by_file.values():
        items.sort(key=lambda r: r.line)
    return by_file


def filter_subset(
    by_file: dict[str, list[LinkRecord]],
    keep: Callable[[LinkRecord], bool],
) -> dict[str, list[LinkRecord]]:
    out = {f: [r for r in items if keep(r)] for f, items in by_file.items()}
    return {f: items for f, items in out.items() if items}


def _file_tree(
    by_file: dict[str, list[LinkRecord]],
    root: Path,
) -> dict:
    return {
        "root_path": str(root),
        "files": {
            f: {"items": [asdict(r) for r in items]}
            for f, items in sorted(by_file.items())
        },
    }


# --------------------------------------------------------------- artifacts


def write_artifacts(
    records: list[LinkRecord],
    tmp_dir: Path,
    root: Path,
) -> None:
    """Emit links.json, suggestions.json, broken.md under `tmp_dir`."""
    tmp_dir.mkdir(parents=True, exist_ok=True)
    by_file = group_by_file(records)
    broken = filter_subset(by_file, lambda r: r.status == "broken")
    # "Needs review" = broken AND no auto-action: not an unlink, and no
    # clear-winner suggestion at >= APPLY_THRESHOLD.
    needs_review = filter_subset(
        broken,
        lambda r: r.resolution is None
        and (
            not r.suggestions
            or r.suggestions[0].score < APPLY_THRESHOLD
            or (len(r.suggestions) >= 2 and r.suggestions[1].score >= APPLY_THRESHOLD)
        ),
    )

    (tmp_dir / "links.json").write_text(
        json.dumps(_file_tree(by_file, root), indent=2),
        encoding="utf-8",
    )
    (tmp_dir / "suggestions.json").write_text(
        json.dumps(_file_tree(needs_review, root), indent=2),
        encoding="utf-8",
    )
    (tmp_dir / "broken.md").write_text(
        _render_broken_md(broken),
        encoding="utf-8",
    )


def _render_broken_md(broken_by_file: dict[str, list[LinkRecord]]) -> str:  # NOSONAR
    total = sum(len(items) for items in broken_by_file.values())
    out = ["# Broken markdown links\n"]
    if not total:
        out.append("_All links resolved cleanly._\n")
        return "\n".join(out)

    auto_applicable = sum(
        1
        for items in broken_by_file.values()
        for r in items
        if r.resolution is not None
        or (
            r.suggestions
            and r.suggestions[0].score >= APPLY_THRESHOLD
            and not (
                len(r.suggestions) >= 2 and r.suggestions[1].score >= APPLY_THRESHOLD
            )
        )
    )
    needs_review = total - auto_applicable
    out.append(
        f"_Total broken: {total} "
        f"({auto_applicable} auto-fixable at score ≥ {APPLY_THRESHOLD}, "
        f"{needs_review} need review)._\n"
    )

    for f, recs in sorted(broken_by_file.items()):
        out.append(f"\n## `{f}`\n")
        for r in recs:
            out.append(f"- L{r.line} `{r.kind}`: `[{r.text}]({r.target})` — {r.reason}")
            if r.resolution is not None:
                kind, payload = parse_resolution(r.resolution)
                if kind == "unlink":
                    content = payload if payload is not None else r.target
                    out.append(
                        f"  - ✓ **Resolution**: `{r.resolution}` "
                        f"→ rewrite as `` `{content}` ``"
                    )
                elif kind == "link":
                    new_target = payload if payload is not None else "#"
                    out.append(
                        f"  - ✓ **Resolution**: `{r.resolution}` "
                        f"→ repoint link to `{new_target}`"
                    )
                continue
            if not r.suggestions:
                continue
            out.append("  - **Suggestions** (best first):")
            for s in r.suggestions:
                marker = "✓" if s.score >= APPLY_THRESHOLD else "·"
                out.append(
                    f"    - {marker} `{s.path}` (score {s.score:.2f}, {s.reason})"
                )
        out.append("")
    return "\n".join(out)


def print_report(records: list[LinkRecord]) -> int:
    """Stderr summary; returns 1 if any broken, 0 otherwise."""
    broken = [r for r in records if r.status == "broken"]
    for r in broken:
        print(
            f"{r.file}:{r.line}: [{r.text}] → {r.target} ({r.reason})",
            file=sys.stderr,
        )
    return 1 if broken else 0


# --------------------------------------------------------------- fix


def _pick_auto_fix(rec: LinkRecord, threshold: float) -> str | None:
    """Return the path to apply, or None if no clean winner.

    A clean winner is the top suggestion when (a) its score meets
    the threshold AND (b) the runner-up does not also meet it. Two
    high-confidence candidates is an ambiguity, not a fix.
    """
    if not rec.suggestions:
        return None
    top = rec.suggestions[0]
    if top.score < threshold:
        return None
    if len(rec.suggestions) >= 2 and rec.suggestions[1].score >= threshold:
        return None
    return top.path


RESOLUTION_TYPES = {"unlink", "link", "as-is"}


def parse_resolution(spec: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """Parse "unlink", "unlink:foo", "link", "link:#bar" → (kind, payload).

    Returns (None, None) for unknown kinds — caller decides whether
    to warn or silently ignore. Empty payload (e.g. "unlink:") is
    treated as no payload, since an empty link target / code-span
    is almost never intentional.
    """
    if not spec:
        return None, None
    kind, _, payload = spec.partition(":")
    if kind not in RESOLUTION_TYPES:
        return None, None
    return kind, (payload or None)


def _unlink_in_line(
    line: str, rec: LinkRecord, content: str
) -> tuple[str, Optional[str]]:
    """Convert `[text](target)` (or `![alt](target)`) to `` `content` ``.

    `content` is what goes inside the code-span — defaults to
    `rec.target` at the caller, but an `unlink:<value>` override
    can substitute anything else.

    Returns (new_line, error). error is None on success. Bails on:
      - ref-def kind (demoting a definition doesn't change what the
        reader sees; the *reference* is what wants demoting, and we
        can't locate it from the def alone)
      - `content` containing backticks (CommonMark escaping not
        worth the corner case)
    """
    if rec.kind == "ref-def":
        return line, "ref-def unlink not supported"
    if "`" in content:
        return line, "code-span content contains backtick; cannot safely demote"
    pattern = re.compile(r"(!?)\[[^\]\n]*\]\(<?" + re.escape(rec.target) + r">?\)")
    new = pattern.sub(f"`{content}`", line, count=1)
    if new == line:
        return line, "link pattern not found on line"
    return new, None


def _replace_url_in_link(line: str, rec: LinkRecord, new_target: str) -> str:
    """Replace the URL portion of a markdown link, not its display text.

    Targets the URL syntax explicitly so display text that happens
    to contain the URL substring (e.g. a code-spanned path) is not
    touched. Handles both `](url)` and `](<url>)` for inline/image,
    and `]:[ws]<?url>?` for ref-def.
    """
    old = rec.target
    if not old or not new_target:
        return line
    if rec.kind == "ref-def":
        pattern = re.compile(r"(\]:[ \t]+<?)" + re.escape(old) + r"(>?)")
        return pattern.sub(
            lambda m: m.group(1) + new_target + m.group(2), line, count=1
        )
    # inline / image: try plain `](old)` then `](<old>)`.
    plain = f"]({old})"
    if plain in line:
        return line.replace(plain, f"]({new_target})", 1)
    bracketed = f"](<{old}>)"
    if bracketed in line:
        return line.replace(bracketed, f"](<{new_target}>)", 1)
    return line


def _plan_action(rec: LinkRecord, threshold: float) -> Optional[tuple[str, str]]:
    """Decide what to do for one broken record.

    Returns (kind, payload) or None:
      - ("unlink", content)       — rewrite link as `` `content` ``.
                                    Payload defaults to rec.target.
      - ("repoint", new_target)   — rewrite the URL. Covers both the
                                    `link[:<target>]` resolution and
                                    suggestion-based auto-picks.
      - None                      — leave it for human review.

    Resolution takes precedence over suggestion-based picks.
    """
    kind, payload = parse_resolution(rec.resolution)
    if kind == "unlink":
        return ("unlink", payload if payload is not None else rec.target)
    if kind == "link":
        return ("repoint", payload if payload is not None else "#")
    choice = _pick_auto_fix(rec, threshold)
    if choice is not None:
        return ("repoint", choice)
    return None


def apply_fixes(  # NOSONAR
    records: list[LinkRecord],
    root: Path,
    dry_run: bool,
    threshold: float = APPLY_THRESHOLD,
) -> list[str]:
    """Apply auto-fixable suggestions and user-requested resolutions.

    For each broken record:
      - `rec.resolution == "unlink"` → demote `[text](target)` to
        `` `target` `` (set via suggestions.fixed.json).
      - Otherwise, top suggestion ≥ `threshold` with no tied
        runner-up → repoint to the suggested path.
      - Anything else stays broken for human review.

    Returns diff-like lines for human inspection. When `dry_run`,
    no file is written.
    """
    actions: list[tuple[LinkRecord, str, str]] = []
    for rec in records:
        if rec.status != "broken":
            continue
        planned = _plan_action(rec, threshold)
        if planned is not None:
            kind, payload = planned
            actions.append((rec, kind, payload))

    by_file: dict[str, list[tuple[LinkRecord, str, str]]] = {}
    for rec, kind, payload in actions:
        by_file.setdefault(rec.file, []).append((rec, kind, payload))

    diff_out: list[str] = []
    for rel_file, items in sorted(by_file.items()):
        path = root / rel_file
        try:
            lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
        except OSError as exc:
            print(f"warning: cannot read {rel_file}: {exc}", file=sys.stderr)
            continue
        original = list(lines)

        by_line: dict[int, list[tuple[LinkRecord, str, str]]] = {}
        for rec, kind, payload in items:
            by_line.setdefault(rec.line, []).append((rec, kind, payload))

        # Bottom-up so any future multi-line fix shape stays sound.
        for lineno in sorted(by_line.keys(), reverse=True):
            idx = lineno - 1
            if idx >= len(lines):
                continue
            new_line = lines[idx]
            for rec, kind, payload in by_line[lineno]:
                if kind == "unlink":
                    result, err = _unlink_in_line(new_line, rec, payload)
                    if err:
                        print(
                            f"warning: {rec.file}:{rec.line}: cannot unlink — {err}",
                            file=sys.stderr,
                        )
                    else:
                        new_line = result
                else:
                    new_line = _replace_url_in_link(new_line, rec, payload)
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
