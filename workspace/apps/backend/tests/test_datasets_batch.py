from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response
from tests._excel import two_sheet_workbook


_FIXTURES = Path(__file__).parent / "fixtures"


def _make_workspace(client: TestClient, name: str = "Marketing") -> str:
    return client.post("/workspaces", json={"name": name}).json()["id"]


def _csv_upload(client: TestClient, fixture: str = "sample.csv") -> str:
    csv_path = _FIXTURES / fixture
    resp = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": (fixture, csv_path.read_bytes(), "text/csv")},
    )
    return resp.json()["temp_id"]


def _excel_upload(client: TestClient) -> str:
    resp = client.post(
        "/uploads",
        data={"sourceFormat": "excel"},
        files={"file": ("book.xlsx", two_sheet_workbook(), "application/octet-stream")},
    )
    return resp.json()["temp_id"]


@pytest.mark.unit
def test_csv_single_item_commit_returns_201_and_dataset() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "leads"}]},
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert len(body) == 1
    ds = body[0]
    assert ds["workspaceId"] == ws
    assert ds["name"] == "leads"
    assert ds["sourceFormat"] == "csv"
    assert "sheetName" not in ds  # contract: present iff sourceFormat === excel
    validate_response("datasets/batch-post.contract.yaml", 201, body)


@pytest.mark.unit
def test_excel_multi_item_commit_returns_ordered_datasets() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _excel_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [
                    {"sheet": "Deals", "name": "q1_deals"},
                    {"sheet": "Contacts", "name": "q1_contacts"},
                ],
            },
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert [d["name"] for d in body] == ["q1_deals", "q1_contacts"]
    assert [d["sheetName"] for d in body] == ["Deals", "Contacts"]
    validate_response("datasets/batch-post.contract.yaml", 201, body)


@pytest.mark.unit
def test_unknown_workspace_returns_404() -> None:
    with TestClient(app) as client:
        temp = _csv_upload(client)
        resp = client.post(
            "/workspaces/ws_00000000/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "x"}]},
        )
    assert resp.status_code == 404


@pytest.mark.unit
def test_unknown_temp_id_returns_404() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": "tmp_0000000000000000", "items": [{"name": "x"}]},
        )
    assert resp.status_code == 404


@pytest.mark.unit
def test_target_dataset_id_returns_422() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [{"name": "x", "target_dataset_id": "ds_00000001"}],
            },
        )
    assert resp.status_code == 422


@pytest.mark.unit
def test_excluded_columns_empty_leaves_zero_columns_returns_422() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [
                    {
                        "name": "x",
                        "excluded_columns": ["id", "name", "amount", "signed_up"],
                    }
                ],
            },
        )
    assert resp.status_code == 422


@pytest.mark.unit
def test_csv_commit_with_skip_rows_drops_leading_lines() -> None:
    # Fixture has 2 noise lines, 1 header, 3 data rows. skip_rows=2 must
    # land the header on row 3 → real column names + 3 data rows. R20
    # behavior-conformance: R16 accepts the field, R20 makes it bite.
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client, "sample_with_noise.csv")
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [{"name": "leads", "parse_options": {"skip_rows": 2}}],
            },
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    ds = body[0]
    assert ds["rowCount"] == 3
    assert [c["name"] for c in ds["columns"]] == ["id", "name", "amount", "signed_up"]
    validate_response("datasets/batch-post.contract.yaml", 201, body)


@pytest.mark.unit
def test_csv_commit_with_has_header_false_auto_names_columns() -> None:
    # sample.csv has 1 header + 3 data rows. has_header=false reads all
    # 4 lines as data and auto-names columns `column1, column2, …`
    # (one-indexed, matching the Excel parser convention).
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [{"name": "raw", "parse_options": {"has_header": False}}],
            },
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    ds = body[0]
    assert ds["rowCount"] == 4
    assert [c["name"] for c in ds["columns"]] == [
        "column1",
        "column2",
        "column3",
        "column4",
    ]
    validate_response("datasets/batch-post.contract.yaml", 201, body)


@pytest.mark.unit
def test_csv_commit_with_skip_rows_and_has_header_false_combine() -> None:
    # skip first, then auto-name. Drop the 2 noise lines and treat the
    # remaining 4 lines (would-be-header + 3 data) as headerless data.
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client, "sample_with_noise.csv")
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [
                    {
                        "name": "raw_skip",
                        "parse_options": {"skip_rows": 2, "has_header": False},
                    }
                ],
            },
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    ds = body[0]
    assert ds["rowCount"] == 4
    assert [c["name"] for c in ds["columns"]] == [
        "column1",
        "column2",
        "column3",
        "column4",
    ]
    validate_response("datasets/batch-post.contract.yaml", 201, body)


@pytest.mark.unit
def test_column_overrides_missing_column_returns_409() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [
                    {
                        "name": "x",
                        "column_overrides": {"not_a_column": {"dtype": "string"}},
                    }
                ],
            },
        )
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# R143 — commit honors dtype overrides; typed coercion errors
# (upload.md §Commit dtype semantics)
# ---------------------------------------------------------------------------


def _mixed_upload(client: TestClient) -> str:
    from tests._excel import mixed_type_workbook

    resp = client.post(
        "/uploads",
        data={"sourceFormat": "excel"},
        files={"file": ("mixed.xlsx", mixed_type_workbook(), "application/octet-stream")},
    )
    return resp.json()["temp_id"]


def _parquet_of(ds: dict) -> "pd.DataFrame":
    from app.storage import dataset_dir

    return pd.read_parquet(dataset_dir(ds["workspaceId"], ds["id"]) / "parsed.parquet")


@pytest.mark.unit
def test_mixed_type_column_with_string_override_commits_and_keeps_leading_zero() -> None:
    """The FM2.25 case (R142-F1): mixed numeric+text phone column, string
    override → commits; parquet holds strings, leading zero intact."""
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _mixed_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [
                    {
                        "sheet": "Calls",
                        "name": "calls",
                        "column_overrides": {"phone": {"dtype": "string"}},
                    }
                ],
            },
        )
        assert resp.status_code == 201, resp.text
        ds = resp.json()[0]
        assert {"name": "phone", "dtype": "string"} in ds["columns"]
        df = _parquet_of(ds)
    assert str(df["phone"].dtype) == "string"
    assert df["phone"].tolist()[:3] == ["903359280", "0387353189", "09-8157-2157"]
    assert pd.isna(df["phone"].tolist()[3])  # NULL passed through


@pytest.mark.unit
def test_mixed_type_column_without_override_commits_via_inferred_string() -> None:
    """R143 build deviation (flagged in upload.md): the committed dtype is
    enforced even with NO override — the parser infers `string` for a mixed
    column, so the write casts instead of dying as an ArrowInvalid 500."""
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _mixed_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": temp, "items": [{"sheet": "Calls", "name": "calls_raw"}]},
        )
        assert resp.status_code == 201, resp.text
        ds = resp.json()[0]
        df = _parquet_of(ds)
    assert df["phone"].tolist()[1] == "0387353189"


@pytest.mark.unit
def test_parquet_dtypes_match_committed_columns_json() -> None:
    """The R142-F2 invariant: stored physical dtypes == columns_json dtypes."""
    pandas_kind = {
        "string": lambda s: str(s.dtype) in ("string", "object"),
        "integer": lambda s: pd.api.types.is_integer_dtype(s),
        "float": lambda s: pd.api.types.is_float_dtype(s),
        "boolean": lambda s: pd.api.types.is_bool_dtype(s),
    }
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _mixed_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [
                    {
                        "sheet": "Calls",
                        "name": "calls_inv",
                        "column_overrides": {
                            "phone": {"dtype": "string"},
                            "duration": {"dtype": "float"},
                        },
                    }
                ],
            },
        )
        assert resp.status_code == 201, resp.text
        ds = resp.json()[0]
        df = _parquet_of(ds)
    for col in ds["columns"]:
        if col["dtype"] in pandas_kind:
            assert pandas_kind[col["dtype"]](df[col["name"]]), (col, str(df[col["name"]].dtype))


@pytest.mark.unit
def test_uncastable_override_returns_typed_422_and_commits_nothing() -> None:
    """R143: `caller` (text) → integer cannot cast → 422 coercion_failed
    naming sheet · column · cells · totalFailed; the whole batch (including
    the clean second sheet) aborts — nothing is committed."""
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _mixed_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [
                    {"sheet": "Clean", "name": "clean"},
                    {
                        "sheet": "Calls",
                        "name": "calls_bad",
                        "column_overrides": {"caller": {"dtype": "integer"}},
                    },
                ],
            },
        )
        assert resp.status_code == 422, resp.text
        body = resp.json()
        assert body["code"] == "coercion_failed"
        assert body["sheet"] == "Calls"
        assert body["column"] == "caller"
        assert body["dtype"] == "integer"
        assert body["totalFailed"] == 4
        # R144 — rows are SOURCE-FILE rows: "a" is data row 1 → sheet row 2 (header at 1).
        assert body["cells"][0] == {"row": 2, "value": "a"}
        assert len(body["cells"]) <= 5
        # atomicity: the clean sheet must not have committed either
        listed = client.get(f"/datasets?workspace={ws}").json()
    assert listed == []


@pytest.mark.unit
def test_csv_override_to_string_casts_for_real() -> None:
    """R143 on the CSV path: `id` (DuckDB BIGINT) → string override is
    applied through the shared coercion, not relabel-only."""
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [
                    {"name": "leads_str", "column_overrides": {"id": {"dtype": "string"}}}
                ],
            },
        )
        assert resp.status_code == 201, resp.text
        ds = resp.json()[0]
        df = _parquet_of(ds)
    assert str(df["id"].dtype) == "string"
    assert df["id"].tolist()[0] == "1"


@pytest.mark.unit
def test_csv_uncastable_override_returns_coercion_failed_without_sheet() -> None:
    """CSV items carry no sheet — the envelope omits it (exclude_none)."""
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [
                    {"name": "bad", "column_overrides": {"name": {"dtype": "integer"}}}
                ],
            },
        )
    assert resp.status_code == 422, resp.text
    body = resp.json()
    assert body["code"] == "coercion_failed"
    assert "sheet" not in body
    assert body["column"] == "name"
    assert body["cells"][0]["row"] == 2  # R144 — file line (header line 1 counted)


@pytest.mark.unit
def test_coercion_row_counts_skipped_lines_and_header() -> None:
    """R144 — the reported row is the SOURCE-FILE line: skip_rows and the
    header line count, so the user can jump straight to it in an editor."""
    csv = b"junk title line\nsecond junk line\nname,age\nalice,abc\n"
    with TestClient(app) as client:
        ws = _make_workspace(client)
        resp = client.post(
            "/uploads", data={"sourceFormat": "csv"}, files={"file": ("j.csv", csv, "text/csv")}
        )
        temp = resp.json()["temp_id"]
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [
                    {
                        "name": "j",
                        "parse_options": {"skip_rows": 2},
                        "column_overrides": {"age": {"dtype": "integer"}},
                    }
                ],
            },
        )
    assert resp.status_code == 422, resp.text
    body = resp.json()
    # "abc" is data row 1, but file line 4 (2 skipped + header + 1).
    assert body["cells"] == [{"row": 4, "value": "abc"}]


# ---------------------------------------------------------------------------
# R144 — date/datetime join the coerced set via format-token translation
# (upload.md §Date and datetime coercion)
# ---------------------------------------------------------------------------


def _fm1_upload(client: TestClient) -> str:
    from tests._excel import fm1_shaped_workbook

    resp = client.post(
        "/uploads",
        data={"sourceFormat": "excel"},
        files={"file": ("fm1.xlsx", fm1_shaped_workbook(), "application/octet-stream")},
    )
    return resp.json()["temp_id"]


_DT_OVERRIDE = {"called_at": {"dtype": "datetime", "format": "dd-MM-yyyy HH:mm:ss"}}


@pytest.mark.unit
def test_datetime_override_with_format_commits_real_timestamps() -> None:
    """The ② headline (R142-F11): a TEXT `dd-MM-yyyy HH:mm:ss` column +
    datetime override commits as physical TIMESTAMP == columns_json datetime."""
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _fm1_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [{"sheet": "Calls", "name": "calls", "column_overrides": _DT_OVERRIDE}],
            },
        )
        assert resp.status_code == 201, resp.text
        ds = resp.json()[0]
        assert {"name": "called_at", "dtype": "datetime"} in ds["columns"]
        df = _parquet_of(ds)
    assert pd.api.types.is_datetime64_any_dtype(df["called_at"])
    assert df["called_at"].tolist()[0] == pd.Timestamp("2026-06-29 09:15:00")
    assert pd.isna(df["called_at"].tolist()[4])  # NULL passes through


@pytest.mark.unit
def test_date_override_commits_physical_date() -> None:
    """A `date` target with a date-only format lands as physical DATE (the
    F2 invariant extends to dates)."""
    import datetime as dt

    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _fm1_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [
                    {
                        "sheet": "Calls",
                        "name": "dates_only",
                        "column_overrides": {"call_date": {"dtype": "date", "format": "dd-MM-yyyy"}},
                    }
                ],
            },
        )
        assert resp.status_code == 201, resp.text
        ds = resp.json()[0]
        assert {"name": "call_date", "dtype": "date"} in ds["columns"]
        df = _parquet_of(ds)
    assert df["call_date"].tolist()[0] == dt.date(2026, 6, 29)
    assert pd.isna(df["call_date"].tolist()[4])  # NULL passes through


@pytest.mark.unit
def test_unparseable_date_cell_returns_coercion_failed(caplog: pytest.LogCaptureFixture) -> None:
    """An unparseable cell under a datetime override → the typed R143
    envelope, dtype `datetime`, naming sheet · column · cells; zero commits.
    R144 — the event is also WARNING-logged server-side (the wizard alert is
    transient; the backend log is the durable trace). caplog's handler attaches
    to the ROUTER logger directly: the startup migration's `fileConfig` resets
    the root handlers, detaching pytest's root capture."""
    import logging

    router_logger = logging.getLogger("app.routers.datasets")
    router_logger.addHandler(caplog.handler)
    try:
        with TestClient(app) as client, caplog.at_level(logging.WARNING, logger="app.routers.datasets"):
            ws = _make_workspace(client)
            temp = _fm1_upload(client)
            resp = client.post(
                f"/workspaces/{ws}/datasets/batch",
                json={
                    "temp_id": temp,
                    "items": [{"sheet": "BadDates", "name": "bad", "column_overrides": _DT_OVERRIDE}],
                },
            )
            assert resp.status_code == 422, resp.text
            body = resp.json()
            assert body["code"] == "coercion_failed"
            assert body["sheet"] == "BadDates"
            assert body["column"] == "called_at"
            assert body["dtype"] == "datetime"
            # R144 — sheet row: "not a date" is data row 2 → sheet row 3.
            assert body["cells"] == [{"row": 3, "value": "not a date"}]
            assert body["totalFailed"] == 1
            listed = client.get(f"/datasets?workspace={ws}").json()
    finally:
        router_logger.removeHandler(caplog.handler)
    assert listed == []
    assert "coercion_failed" in caplog.text
    assert "'called_at'" in caplog.text and "'not a date'" in caplog.text


@pytest.mark.unit
@pytest.mark.parametrize(
    "override",
    [
        # token outside the six-token subset
        {"dtype": "datetime", "format": "EEE dd-MM-yyyy HH:mm:ss"},
        # single-letter (non-subset) tokens are rejected, not guessed
        {"dtype": "datetime", "format": "d-M-yyyy"},
        # a `date` target must not carry time tokens (no silent truncation)
        {"dtype": "date", "format": "dd-MM-yyyy HH:mm"},
    ],
)
def test_unsupported_format_token_returns_422_before_any_write(override: dict) -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _fm1_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [{"sheet": "Calls", "name": "x", "column_overrides": {"called_at": override}}],
            },
        )
        assert resp.status_code == 422, resp.text
        assert "format_unsupported" in resp.text
        listed = client.get(f"/datasets?workspace={ws}").json()
    assert listed == []
