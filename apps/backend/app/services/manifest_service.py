from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_json(payload: Any) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def compute_manifest_hash(manifest: dict) -> str:
    return sha256_text(canonical_json(manifest))


def compute_source_hash(file_bytes: bytes) -> str:
    return sha256_bytes(file_bytes)
