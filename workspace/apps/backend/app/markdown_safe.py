"""R179 — the safe markdown subset.

Text that users and agents write INTO the product (a `note` widget; R180's
metadata entries) is rendered by the builder. The builder never injects HTML
(it builds React nodes from a hand-written parser), so the server rule here
is belt-and-braces plus a contract: what is stored is what the renderer
understands, nothing more.

Rejected, never silently stripped (the writer should know):
- raw HTML / anything that looks like a tag (`<b>`, `</div>`, `<!-- -->`,
  `<script …`, `<http://…>` autolinks);
- images (`![alt](src)`) — the product hosts none, and an external image is a
  tracking pixel;
- links whose target is not `http://` / `https://` (`javascript:`, `data:`,
  `file:`, bare `www.` …), in inline `[t](u)` and reference `[t]: u` form.

Allowed: headings, paragraphs, emphasis, inline + fenced code, bullet and
numbered lists, block quotes, horizontal rules, http(s) links, tables (the
renderer shows them as text if it does not draw them).
"""

from __future__ import annotations

import re

_TAG = re.compile(r"<\s*/?\s*[A-Za-z!?]")
_IMAGE = re.compile(r"!\[")
_INLINE_LINK = re.compile(r"\]\(\s*<?([^)\s>]+)")
_REF_LINK = re.compile(r"^\s{0,3}\[[^\]]+\]:\s*<?(\S+)", re.MULTILINE)
_HTTP = re.compile(r"^https?://", re.IGNORECASE)

MARKDOWN_MAX_CHARS = 4_000
"""R179 — a `note` widget's text cap (characters)."""


def markdown_problems(md: str) -> list[str]:
    """The reasons `md` is outside the safe subset — empty when it is clean.
    Each is a stable token (`html`, `image`, `link_scheme`) the API surfaces in
    its 422 message and the builder maps to a sentence."""
    problems: list[str] = []
    if _TAG.search(md):
        problems.append("html")
    if _IMAGE.search(md):
        problems.append("image")
    for pat in (_INLINE_LINK, _REF_LINK):
        for m in pat.finditer(md):
            if not _HTTP.match(m.group(1)):
                problems.append("link_scheme")
                break
        if "link_scheme" in problems:
            break
    return problems
