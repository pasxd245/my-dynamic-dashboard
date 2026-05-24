"""Build small Excel workbooks in-memory for upload-flow tests."""

from __future__ import annotations

from io import BytesIO

from openpyxl import Workbook


def two_sheet_workbook() -> bytes:
    wb = Workbook()
    deals = wb.active
    deals.title = "Deals"
    deals.append(["deal_id", "amount", "closed_at"])
    deals.append(["d1", 100, "2024-01-15"])
    deals.append(["d2", 250, "2024-02-03"])

    contacts = wb.create_sheet("Contacts")
    contacts.append(["contact_id", "email"])
    contacts.append(["c1", "alice@example.com"])
    contacts.append(["c2", "bob@example.com"])

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def malformed_workbook() -> bytes:
    """A bytes blob that is not actually an xlsx — used for 415 path."""
    return b"not really an xlsx"
