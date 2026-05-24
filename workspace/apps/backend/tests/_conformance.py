"""Backend ↔ contract conformance helper.

Loads a `<verb>.contract.yaml` file, fully inlines its cross-file
`$ref`s, picks the response schema for a given status code, and
validates an actual response body against it via
`jsonschema.Draft202012Validator`.

Cross-file `$ref` shape used by the contracts package:
``$ref: "../_shared/<name>.yaml#/components/schemas/<Name>"``
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator


_CONTRACTS_ROOT = (
    Path(__file__).resolve().parents[3] / "packages" / "contracts"
)


def contract_path(relative: str) -> Path:
    """Resolve a contract path relative to the contracts package root."""
    return _CONTRACTS_ROOT / relative


def _load_yaml(path: Path) -> dict[str, Any]:
    return yaml.safe_load(path.read_text())


def _resolve_pointer(doc: dict[str, Any], pointer: str) -> Any:
    node: Any = doc
    for part in pointer.split("/"):
        if part == "":
            continue
        if isinstance(node, list):
            node = node[int(part)]
        else:
            node = node[part]
    return node


def _inline(node: Any, base_dir: Path, doc: dict[str, Any]) -> Any:
    if isinstance(node, dict):
        if "$ref" in node and len(node) == 1:
            ref = node["$ref"]
            if ref.startswith("#"):
                target = _resolve_pointer(doc, ref[1:])
                return _inline(target, base_dir, doc)
            # Cross-file: "<rel-path>.yaml#/pointer"
            if "#" in ref:
                file_part, pointer = ref.split("#", 1)
            else:
                file_part, pointer = ref, ""
            target_path = (base_dir / file_part).resolve()
            target_doc = _load_yaml(target_path)
            target_node = (
                _resolve_pointer(target_doc, pointer) if pointer else target_doc
            )
            return _inline(target_node, target_path.parent, target_doc)
        return {k: _inline(v, base_dir, doc) for k, v in node.items()}
    if isinstance(node, list):
        return [_inline(v, base_dir, doc) for v in node]
    return node


def load_response_schema(
    contract_rel_path: str, status_code: int | str, content_type: str = "application/json"
) -> dict[str, Any]:
    path = contract_path(contract_rel_path)
    doc = _load_yaml(path)
    inlined = _inline(doc, path.parent, doc)
    paths = inlined["paths"]
    # OpenAPI: each `paths.<route>.<method>.responses["NNN"].content.<ct>.schema`
    (_route, route_obj), = paths.items()
    (_method, method_obj), = (
        (m, mo) for m, mo in route_obj.items() if m in {"get", "post", "put", "delete", "patch"}
    )
    response = method_obj["responses"][str(status_code)]
    return response["content"][content_type]["schema"]


def validate_response(
    contract_rel_path: str,
    status_code: int | str,
    body: Any,
    *,
    content_type: str = "application/json",
) -> None:
    schema = load_response_schema(contract_rel_path, status_code, content_type)
    Draft202012Validator(schema).validate(body)
