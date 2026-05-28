"""R30: tmp-upload sweep job tests.

Covers `sweep_once` directly (the loop is a thin wrapper). Each test
points at an isolated `tmp_path/uploads_tmp/` so we don't touch the
real data root.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.jobs.tmp_sweep import _dir_age_seconds, sweep_once


def _make_tmp(
    data_root: Path,
    temp_id: str,
    *,
    created_at: datetime | None = None,
    mtime_age_seconds: float | None = None,
    write_meta: bool = True,
) -> Path:
    d = data_root / "uploads_tmp" / temp_id
    d.mkdir(parents=True)
    (d / "original.csv").write_text("a,b\n1,2\n", encoding="utf-8")
    if write_meta:
        meta = {
            "tempId": temp_id,
            "createdAt": (created_at or datetime.now(timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        (d / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
    if mtime_age_seconds is not None:
        past = time.time() - mtime_age_seconds
        os.utime(d, (past, past))
    return d


def test_sweep_removes_expired_dir(tmp_path: Path) -> None:
    """A dir whose meta.json createdAt is older than TTL gets removed."""
    old = datetime.now(timezone.utc) - timedelta(hours=25)
    d = _make_tmp(tmp_path / "data", "tmp_aaaaaaaaaaaaaaaa", created_at=old)
    assert d.exists()

    removed = sweep_once(tmp_path / "data", ttl_seconds=86400)

    assert removed == 1
    assert not d.exists()


def test_sweep_keeps_fresh_dir(tmp_path: Path) -> None:
    """A dir within TTL is preserved."""
    fresh = datetime.now(timezone.utc) - timedelta(minutes=5)
    d = _make_tmp(tmp_path / "data", "tmp_bbbbbbbbbbbbbbbb", created_at=fresh)

    removed = sweep_once(tmp_path / "data", ttl_seconds=86400)

    assert removed == 0
    assert d.exists()


def test_sweep_falls_back_to_mtime_when_meta_missing(tmp_path: Path) -> None:
    """No meta.json → directory mtime drives the age decision."""
    d = _make_tmp(
        tmp_path / "data",
        "tmp_cccccccccccccccc",
        write_meta=False,
        mtime_age_seconds=90000,  # ~25h
    )

    removed = sweep_once(tmp_path / "data", ttl_seconds=86400)

    assert removed == 1
    assert not d.exists()


def test_sweep_falls_back_to_mtime_when_meta_corrupt(tmp_path: Path) -> None:
    """Unparseable meta.json → fall back to mtime, don't crash."""
    d = _make_tmp(
        tmp_path / "data",
        "tmp_dddddddddddddddd",
        write_meta=False,
    )
    (d / "meta.json").write_text("{not json", encoding="utf-8")
    # Age the directory AFTER writing meta — meta.write touches mtime.
    past = time.time() - 90000
    os.utime(d, (past, past))

    removed = sweep_once(tmp_path / "data", ttl_seconds=86400)

    assert removed == 1
    assert not d.exists()


def test_sweep_handles_missing_root(tmp_path: Path) -> None:
    """No `uploads_tmp/` yet → returns 0, no crash."""
    removed = sweep_once(tmp_path / "data", ttl_seconds=86400)
    assert removed == 0


def test_dir_age_prefers_meta_over_mtime(tmp_path: Path) -> None:
    """When meta.json is valid, it overrides mtime — even if mtime is fresh."""
    old = datetime.now(timezone.utc) - timedelta(hours=48)
    d = _make_tmp(
        tmp_path / "data",
        "tmp_eeeeeeeeeeeeeeee",
        created_at=old,
    )
    # Force mtime to "now" — meta should still win.
    now = time.time()
    os.utime(d, (now, now))

    age = _dir_age_seconds(d, now)
    # 48 hours ± a small skew window.
    assert age == pytest.approx(48 * 3600, abs=120)
