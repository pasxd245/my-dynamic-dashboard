"""R30: tmp-upload sweep job.

Hard-deletes `<data_root>/uploads_tmp/<temp_id>/` directories whose
age exceeds the TTL. Two entry points:

- `sweep_once(data_root, ttl_seconds)` — one-shot scan. Returns count
  of removed directories. Importable for tests and the CLI.
- `sweep_loop(interval_seconds, ttl_seconds)` — async loop calling
  `sweep_once` on the interval. Spawned by FastAPI's lifespan.

CLI: `uv run python -m app.jobs.tmp_sweep` runs `sweep_once` once
using the current `CONFIG` values. Useful for operator cleanup or
verifying sweep behavior against the real `data/uploads_tmp/`.

Age signal: prefers the `meta.json` `createdAt` ISO timestamp; falls
back to directory mtime if meta is missing or corrupt (logs a
warning). Matches the contract's 24h TTL documented since R16.
"""

from __future__ import annotations

import asyncio
import json
import logging
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path


logger = logging.getLogger(__name__)


def _dir_age_seconds(d: Path, now: float) -> float:
    """Age of `d` in seconds. Prefers meta.json's `createdAt`; falls
    back to directory mtime if meta is missing or unreadable."""
    meta_path = d / "meta.json"
    if meta_path.exists():
        try:
            data = json.loads(meta_path.read_text(encoding="utf-8"))
            created_at = data.get("createdAt")
            if isinstance(created_at, str):
                # Strict ISO-8601 UTC ('Z'-suffixed) per the contract.
                # strptime ignores the literal 'Z' and yields a naive
                # datetime; attach UTC explicitly so .timestamp() doesn't
                # silently apply the host's local offset.
                dt = datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                return now - dt.timestamp()
        except (ValueError, json.JSONDecodeError, OSError) as exc:
            logger.warning(
                "tmp_sweep: meta.json unreadable at %s (%s); falling back to mtime",
                meta_path,
                exc,
            )
    # Fallback: directory mtime.
    return now - d.stat().st_mtime


def sweep_once(data_root: Path, ttl_seconds: int) -> int:
    """Run one sweep pass. Returns count of removed directories.

    Safe to call concurrently with the upload handlers — `shutil.rmtree`
    won't race fatally with read paths (worst case: a 404 if a sweep
    fires mid-request, which the FE already handles for tmp ids).
    """
    tmp_root = data_root / "uploads_tmp"
    if not tmp_root.exists():
        return 0

    now = time.time()
    removed = 0
    for child in tmp_root.iterdir():
        if not child.is_dir():
            continue
        age = _dir_age_seconds(child, now)
        if age <= ttl_seconds:
            continue
        try:
            shutil.rmtree(child)
            removed += 1
            logger.info(
                "tmp_sweep: removed %s (age %.0fs > ttl %ds)",
                child.name,
                age,
                ttl_seconds,
            )
        except OSError as exc:
            logger.warning("tmp_sweep: failed to remove %s: %s", child, exc)
    if removed:
        logger.info("tmp_sweep: removed %d directories this pass", removed)
    return removed


async def sweep_loop(
    data_root: Path,
    interval_seconds: int,
    ttl_seconds: int,
) -> None:
    """Run `sweep_once` forever on the configured interval.

    Cancellable via `task.cancel()` — propagates `CancelledError` so
    the FastAPI lifespan can await clean shutdown.
    """
    logger.info(
        "tmp_sweep: starting loop (interval=%ds, ttl=%ds)",
        interval_seconds,
        ttl_seconds,
    )
    try:
        while True:
            try:
                sweep_once(data_root, ttl_seconds)
            except Exception:  # noqa: BLE001
                logger.exception("tmp_sweep: pass failed; continuing")
            await asyncio.sleep(interval_seconds)
    except asyncio.CancelledError:
        logger.info("tmp_sweep: loop cancelled; exiting")
        raise


def _main() -> None:
    """CLI entry point: one-shot sweep using current CONFIG values."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    # Lazy imports keep this importable from tests without spinning up
    # the full config layer at module-load time.
    from app._config import CONFIG  # noqa: PLC0415
    from app.storage import get_data_root  # noqa: PLC0415

    cfg = CONFIG.settings.backend.tmp_sweep
    data_root = get_data_root()
    removed = sweep_once(data_root, cfg.ttl_seconds)
    logger.info("tmp_sweep CLI: removed %d directories", removed)


if __name__ == "__main__":
    _main()
