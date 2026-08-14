"""Pure read-side: parse markdown, parse the lint config.

No filesystem walks, no subprocess, no network. Everything here
takes a path or a string and returns a value — easy to test, easy
to reason about.

`check_links.py` is the orchestrator; `output.py` is the write-side.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

INLINE_LINK_RE = re.compile(r"(?<!\\)!?\[([^\]\n]*)\]\(([^)\n]+)\)")
REF_DEF_RE = re.compile(r"^ {0,3}\[([^\]\n]+)\]:[ \t]+(\S+)")
HEADING_RE = re.compile(r"^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$")
FENCE_RE = re.compile(r"^(\s{0,3})(```+|~~~+)")


@dataclass
class Suggestion:
    """A ranked replacement for a broken link target.

    `score` is a confidence in [0, 1]; consumers compare against a
    threshold (default 0.9) to decide auto-apply vs human review.
    `reason` is a short slug naming the rule that produced it
    (git-rename, case-mismatch, unique-basename, fragment-case, ...).
    """

    path: str
    score: float
    reason: str


@dataclass
class LinkRecord:
    file: str
    line: int
    kind: str  # inline | image | ref-def | error
    text: str
    target: str
    resolved_path: Optional[str] = None
    status: str = "ok"
    reason: Optional[str] = None
    suggestions: list[Suggestion] = field(default_factory=list)
    # User-chosen resolution that bypasses suggestion-based repair.
    # None  → fall through to suggestions[] (default).
    # "unlink" → rewrite `[text](target)` as `` `target` ``.
    # Set in suggestions.fixed.json; ignored on links with status != broken.
    resolution: Optional[str] = None


# --------------------------------------------------------------- jsonc


def strip_jsonc(text: str) -> str:  # NOSONAR
    """Strip // line comments and /* */ block comments outside strings."""
    out: list[str] = []
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


def load_config(config_path: Path) -> tuple[list[str], list[str]]:
    """Read a markdownlint-cli2 jsonc config; return (globs, ignores).

    Caller decides what to do if the file is missing — this function
    raises on a malformed file (the source of truth is broken; we
    must not silently substitute a narrower scope).
    """
    text = config_path.read_text(encoding="utf-8")
    cfg = json.loads(strip_jsonc(text))
    globs = cfg.get("globs") or ["**/*.md"]
    ignores = cfg.get("ignores") or []
    return globs, ignores


# --------------------------------------------------------------- markdown


def _strip_inline_code(line: str) -> str:  # NOSONAR
    """Replace inline-code spans with same-length spaces so link
    indices stay stable but the link regex can't match inside them.

    Handles `single`, ``double``, and ```triple``` tick runs on one
    line. Multi-line code spans are rare in prose; not handled.
    """
    out = list(line)
    i, n = 0, len(line)
    while i < n:
        if line[i] != "`":
            i += 1
            continue
        j = i
        while j < n and line[j] == "`":
            j += 1
        run = j - i
        k = j
        while k < n:
            if line[k] == "`":
                m = k
                while m < n and line[m] == "`":
                    m += 1
                if m - k == run:
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


def slugify(heading: str) -> str:
    """GitHub's heading slug: lowercase, drop punctuation, spaces → ``-``.

    **Consecutive hyphens are NOT collapsed and edge hyphens are NOT stripped**
    (R170). GitHub does neither, and the difference is not cosmetic: a heading
    containing an em-dash *with spaces* — ``### R109 — line / time-series ✅`` —
    loses the em-dash to the punctuation strip, leaving **two** spaces and
    therefore **two** hyphens, plus a trailing hyphen where the emoji was::

        r109--line--time-series-      # GitHub, markdownlint MD051, and the links
        r109-line-time-series         # what collapsing produced — matched nothing

    Collapsing made every anchor into such a heading report broken: 11 of the 24
    breaks this repo carried as its baseline. `MD051` is enabled here and passes
    on the same fragments, which is the proof that the checker was the defect
    rather than the links.
    """
    s = heading.strip().lower()
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    return re.sub(r"\s", "-", s)


def headings(path: Path) -> set[str]:
    """Return all heading slugs in `path` (GitHub-style disambiguation
    for repeated headings: `foo`, `foo-1`, `foo-2`, ...).

    Skips content inside fenced code blocks.
    """
    result: set[str] = set()
    seen_counts: dict[str, int] = {}
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
        if not hm:
            continue
        base = slugify(hm.group(2))
        count = seen_counts.get(base, 0)
        slug = base if count == 0 else f"{base}-{count}"
        result.add(slug)
        seen_counts[base] = count + 1
    return result


def parse_links(path: Path, rel: str) -> list[LinkRecord]:  # NOSONAR
    """Extract inline, image, and ref-def links from `path`.

    `rel` is the repo-relative posix path used in returned records
    (caller-supplied so this module stays repo-root-agnostic).
    Skips fenced code blocks and inline code spans.
    """
    out: list[LinkRecord] = []
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        out.append(
            LinkRecord(
                file=rel,
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
