# Round 146: Context-aware copy pass — refresh labels + full i18n text audit

**Status**: In progress — refresh labels applied; full-corpus audit running
**Date started**: 2026-07-04
**Date completed**:
**Flow**: **Copy/i18n round** — no contract/backend/new-interaction surface; wording is decided
(D), applied to i18n strings (F), and human-eyeballed (Complete). Flow-selector's no-UI branch
reads vacuously → DCFBI-degenerate; recorded, not ceremonially walked.

## Goal

**Inherits from ← [Round_145](Round_145.md) "Feeds into" (re-rank, human 2026-07-04).** The R145
naming discussion surfaced that the refresh feature's user-facing copy was chosen without full
regard for **locale** and **display context**. This round refines it. Pulled by the
`labels-context-and-locale-aware` lesson (VN `Làm mới` reads as *reload the view*, not *update
my data*).

Two rules to apply (from the lesson):

1. **Per-locale, not literal.** EN keeps **"Refresh"** (Excel / Power Query category-standard for
   "bring in the latest data" — the #1-ease persona already knows it). VN moves off **"Làm mới"**
   (false-friend = reload) to **"Cập nhật"** / **"Cập nhật dữ liệu"** (update the data).
2. **Per display-context.** The same action reads differently by surface — a row-action menu item
   wants a short verb; a wizard title a fuller phrase; a breadcrumb a short noun; a confirm
   button the outcome. Audit each surface, don't reuse one string blindly.

**Scope expanded (human, 2026-07-04):** beyond the refresh labels, **audit the whole i18n
corpus** (772 keys, en + vi) for the same classes of problem — VN false-friends / context
mismatch, literal-translation misses, terminology drift, and jargon for the ease-persona — and
**analyse which others need rephrasing**. The refresh label fix is the worked exemplar; this
round sweeps the rest. Findings are surfaced for human steer before mass-editing (rephrasing
user-facing copy is a product-voice decision, especially the VN register).

_Track: 1 (product — user-facing clarity for the #1-ease persona). Pulled by ← Round_145
Feeds-into re-rank + `labels-context-and-locale-aware` memory + human "check all current texts"._

## Plan

- [ ] **D (wording table)**: for each surface the refresh label appears on, pick EN (unchanged)
      + VN (revised) wording that fits the context. Surfaces: Datasets row-action menu +
      dataset-detail action (`datasets.refresh`); wizard breadcrumb (`upload.refresh.crumb`);
      wizard title (`upload.refresh.title`); commit button (`upload.refresh.commitLabel`);
      source banner (`upload.refresh.sourceBannerTitle`); sheet note (`upload.refresh.sheetNote`);
      confirm-replace body (`upload.refresh.confirmReplaceBody`).
- [ ] **F (apply)**: edit `vi.json` only (EN unchanged); replace the `Làm mới` family with the
      context-appropriate `Cập nhật` wording. No code/route/design changes ("refresh" stays the
      internal/dev vocabulary).
- [ ] **Verify**: i18n JSON valid + en/vi key parity intact (values-only change); FE `tsc` +
      `vitest` unaffected (no key renames); human eyeball of each surface in the app.
- [x] **Full-corpus audit (expanded scope)**: scan all 772 en+vi keys for VN false-friends /
      context mismatch, literal-translation misses, terminology drift, and ease-persona jargon;
      produce a ranked findings table; **get human steer** on which to rephrase before applying.
      Apply the approved set (values-only, parity preserved); re-verify. _(done 2026-07-04 —
      24 findings, human steered, approved set applied, all gates green)_

## Risks / unknowns

- **EN scope**: this round leaves EN as "Refresh" per the R145 discussion (the human's ask was
  the VN label). If the human later prefers EN "Update" too, that's a one-line follow.
- **VN register consistency**: keep the `Cập nhật` family consistent across surfaces (don't mix
  `Cập nhật` and a stray `Làm mới`). The verify step greps for residual `Làm mới` in the refresh
  namespace.

## Do

**Wording table (applied 2026-07-04 — `vi.json` only; EN unchanged):**

| Surface (key)                        | Context           | EN (kept) | VN before | VN after |
| ------------------------------------ | ----------------- | --------- | --------- | -------- |
| `datasets.refresh`                   | row menu + detail action | Refresh | Làm mới | **Cập nhật dữ liệu** |
| `upload.refresh.crumb`               | breadcrumb tail (short) | Refresh | Làm mới | **Cập nhật** |
| `upload.refresh.title`               | wizard title (fuller) | Refresh dataset | Làm mới tập dữ liệu | **Cập nhật tập dữ liệu** |
| `upload.refresh.commitLabel`         | primary button (outcome) | Refresh dataset | Làm mới tập dữ liệu | **Cập nhật dữ liệu** |
| `upload.refresh.sourceBannerTitle`   | banner            | Refreshing … | Đang làm mới … | **Đang cập nhật …** |
| `upload.refresh.sheetNote`           | sheet-step note   | (n/a) | Làm mới áp dụng … | **Cập nhật áp dụng …** |
| `upload.refresh.confirmReplaceBody`  | confirm alert     | (unchanged) | Làm mới thay thế … | **Cập nhật thay thế …** |

Unchanged (no `Làm mới`): `subtitle`, `sourceBannerBody`, `confirmReplaceTitle`, `legacyNote`,
`steps.drift`. **EN kept as "Refresh"** (Excel/Power-Query category-standard) per the R145
discussion — the human's ask was the VN label.

**Full-corpus audit (2026-07-04 — deep scan of all 772 keys, en+vi, value-only greps + key→surface
mapping; external-convention research via web agent, evidence column below):**

Two **surgical fixes applied immediately** (bug-level, not product-voice — completions of the
already-approved refresh slice):

- `upload.drift.subtitle`: residual "làm mới" → "cập nhật" (slice 1's grep only covered
  `upload.refresh.*` / `datasets.refresh`; the drift step is refresh vocabulary too).
- `upload.confirm.errorCoercionFailedHint`: "hãy chỉnh ở bước Metadata" → "bước Cấu trúc" — the VN
  step tab is labeled "Cấu trúc" (`upload.steps.metadata`), so the hint pointed at a step name
  that doesn't exist on screen.

**Ranked findings — awaiting human steer before applying** (rephrasing = product-voice call):

_Class A — terminology drift (one concept, two+ VN words):_

| #   | Finding | Where | Recommendation |
| --- | ------- | ----- | -------------- |
| A1  | **"bộ dữ liệu" (26) vs "tập dữ liệu" (24)** for _dataset_ — the product's core noun, split by namespace (nav/datasets/upload = "bộ"; queries/relationships/upload.refresh/drift/dashboard.cap = "tập") | ~50 strings | Unify. **Rec: "tập dữ liệu"** (research: see evidence) — but either is fine; consistency is the point |
| A2  | _Cardinality_ = "Số lượng" (relationships) vs "Lực lượng quan hệ" (canvas). "Lực lượng" is set-theory jargon; "Số lượng" reads as "quantity" | 3 strings | Unify to a paraphrase, e.g. **"Kiểu ghép (1:1, 1:nhiều)"** — avoid colliding with `canvasEdgeRelTypeLabel` "Loại quan hệ" |
| A3  | _Measure_ = "Giá trị đo" (dashboard builder) vs "Số đo" (query steps) | 5 strings | Unify → "Giá trị đo" |
| A4  | _Stale_ = "cần chú ý" (query badge) vs "Lỗi thời" (relationships status; reads as "old-fashioned") | 3 strings | Unify → "Cần chú ý" (badge) / "Không còn hợp lệ" (status column) |
| A5  | _Override_ = "Ghi đè" / "Thay đổi" / "thay đổi thủ công" across the upload wizard | 4 strings | Unify → "Thay đổi thủ công" family (ease persona; "ghi đè" is dev-speak) |
| A6  | dtype names: `dtype.string` "chuỗi" vs help "Văn bản"; `dtype.boolean` "luận lý" (academic) vs help "Đúng/Sai" | 4 strings | Align to ease persona: "văn bản", "đúng/sai" |
| A7  | _Sheet_: "sheet" kept everywhere **except** `upload.refresh.sheetNote` "trang tính" — drift introduced by the R146 slice itself | 1 string | Unify → "sheet" (matches wizard tabs + VN office colloquial) |
| A8  | _Governed_ = "đã quản trị" / "được quản trị" / "Có quản trị" | 4 strings | Unify → "được quản trị" |
| A9  | _Promote_ = "thăng cấp" (canvas help) vs "Đưa lên" (buttons/toasts) | 1 string | → "đưa lên" |

_Class B — untranslated EN left inside VN prose:_

| #   | Finding | Where | Recommendation |
| --- | ------- | ----- | -------------- |
| B1  | "workspace" raw in 7 query-builder strings while the app noun is "không gian làm việc" | `queries.builder.joinNone/addJoinNone/promoted/canvasPromoteTip/canvasDivergedChanged/canvasDivergedRemoved/canvasPromoteFailed` | Mechanical → "không gian làm việc" |
| B2  | "canvas" raw in 4 strings while the tab the user sees is labeled **"Sơ đồ"** — help text names a surface the UI never shows | `canvasUnstageSource/canvasHelpTitle/canvasConnect_cyclic/canvasAddSourceNone` | → "sơ đồ" |
| B3  | "widget" kept as loanword (17 strings) | dashboard.* | **Keep** (industry norm; see evidence) — steer if you prefer "thẻ"/"tiện ích" |
| B4  | "Slug" raw (label + help) | `dashboard.slugLabel` | Low. Option: "Định danh URL (slug)" |
| B5  | Join types inner/left/right/full raw in the read-only detail view, while the builder glosses them ("Inner (chỉ khớp)") | `queries.detail.joinType.*` | Reuse the glossed forms |

_Class C — false friends / literal-translation misses:_

| #   | Finding | Where | Recommendation |
| --- | ------- | ----- | -------------- |
| C1  | "Chạy để làm mới" (workflow list) — same "làm mới"=reload false friend the round exists to kill | `workflows.list.subtitle` | → "Chạy để cập nhật kết quả." |
| C2  | "cắt lát widget này" — literal "slice" reads as food-slicing | `dashboard.filter.hint` | → "Thêm bộ lọc để thu hẹp dữ liệu của widget này." |
| C3  | "Tải lại tệp để thay thế dữ liệu" — "tải lại"=reload; EN is _re-upload_ | `datasets.detail.zeroRowsHint` | → "Tải tệp lên lại để thay thế dữ liệu." (or point at the new Cập nhật dữ liệu action) |
| C4  | "kết xuất" for _materialized_ (5 strings) — VN "kết xuất" ≈ export/render, misleading | `workflows.*` | Paraphrase: "chạy và lưu kết quả" family ("Đã lưu kết quả", "Chạy quy trình để tạo và lưu kết quả…") |
| C5  | **"Bảng điều khiển" for _Dashboard_** — in VN reads as Windows _Control Panel_; core noun | nav + dashboard.* (~15 strings) | Candidate: **"Trang tổng quan"** (Google convention). Big rename — needs explicit steer |
| C6  | "Khung nhìn đã lưu" for _Saved view_ — "khung nhìn" is academic; also EN itself mixes view/query | `queries.save.defaultName`, `queries.list.subtitle` | → "Truy vấn đã lưu" (match the product noun) |
| C7  | Cap tooltip: "tập dữ liệu này lớn so với bảng điều khiển trực tiếp" — awkward literal | `dashboard.cap.tooltip` | Rephrase: "dữ liệu khá lớn để hiển thị trực tiếp, nên số liệu tổng chỉ là một phần" |

_Class D — mechanical consistency (spelling / register):_

| #   | Finding | Where | Recommendation |
| --- | ------- | ----- | -------------- |
| D1  | Diacritic style mixed: "Xóa" (33) vs "Xoá" (8); "Hủy" (3) vs "Huỷ" (1) | scattered | Standardize to dominant old-style "óa/ủy" (MS convention; see evidence) |
| D2  | "file" (6) vs "tệp" (15) | upload.* | Unify → "tệp" (matches `fileLabel`; MS convention) |
| D3  | Example markers mixed: "ví dụ:" / "vd." / "vd:" | scattered | Unify → "ví dụ:" |
| D4  | `nav.dashboard` (Settings entry + breadcrumb) and `nav.dashboards` (main menu) both render "Bảng điều khiển" — two identical labels in one sidebar | AppLayout | Disambiguate if C5 lands (e.g. list = "Trang tổng quan", settings entry keeps context) |

**Convention evidence (web research, 2026-07-04 — primary sources: support.microsoft.com /
support.google.com vi pages fetched directly; learn.microsoft.com vi-vn is machine-translated =
weak evidence; BigQuery has no vi docs):**

| Term | Evidence | Effect on rec |
| ---- | -------- | ------------- |
| Dashboard | Google Analytics vi = **"Trang tổng quan"**; Power BI vi-vn (MT) = "bảng thông tin"; **"Bảng điều khiển" = admin/control panel** (Google Admin console vi; Windows Control Panel); MISA keeps EN "Dashboard" | **Confirms C5** — current label collides with "control panel". Rec: "Trang tổng quan" (or keep EN "Dashboard") |
| Dataset | Google Analytics vi UI = **"Tập dữ liệu"** ("Tạo Tập dữ liệu"); "bộ dữ liệu" only in community writing | **Confirms A1 rec** → unify on "tập dữ liệu" |
| File | MS vi style guide: "tệp" 12×, "tập tin" 0×; Google Drive vi help "tệp" 58× | **Confirms D2** → "tệp" |
| Widget | Windows 11 vi = "Tiện ích"; Google Analytics vi = "Tiện ích con" (dashboard-widget sense!); neither keeps EN. Caveat: bare "tiện ích" also = add-on | **Revises B3** — "Tiện ích" is the vendor convention; keep-EN is defensible but not evidence-backed. Steer |
| Sheet | Excel vi-vn UI = **"trang tính"**; Google's product name = "Google Trang tính"; colloquial office speech = "sheet" (secondary evidence) | **Revises A7** — either direction is defensible: "trang tính" (vendor standard) or "sheet" (colloquial; most VN offices run *English* Excel). Steer; whichever wins, unify |
| Cardinality | No VN UI standard exists; VN Power BI training keeps EN "Cardinality" + explains "quan hệ 1-1 / 1-n"; "lực lượng" = set-theory only | **Confirms A2** → paraphrase "Kiểu ghép (1:1, 1:nhiều)" |
| **Refresh** | **Excel vi-VN + Power BI vi UI standard = "Làm mới (dữ liệu)"** ("Làm mới kết nối dữ liệu bên ngoài trong Excel"; "Làm mới theo lịch trình"). MS always pairs it with an object; bare "Làm mới" is the reload-ish reading | **⚠ Challenges the applied slice 1.** Options: (a) keep "Cập nhật dữ liệu" (clearer to users of *English* Excel; human's original read), (b) realign to "Làm mới dữ liệu" (matches what Excel-vi/Power-BI-vi users see; never bare "Làm mới"). Surfaced for steer, not re-decided |
| Saved view | Google "view" = "chế độ xem"; MS Office = "dạng xem"; "khung nhìn" = zero UI hits (SQL/CAD textbooks only) | **Confirms C6** — kill "khung nhìn"; "Truy vấn đã lưu" (product noun) or "chế độ xem đã lưu" |
| Diacritics | Microsoft = uniformly **old style "óa/ủy"** (style guide cites Hoàng Phê); Google = mixed, newer strings new-style | **Confirms D1** → old style ("Xóa", "Hủy"), matching the corpus's dominant form |

**Human steer (2026-07-04) + application:**

- **Refresh**: keep "Cập nhật dữ liệu" — the MS-vi "Làm mới dữ liệu" convention was surfaced as a
  challenge and consciously declined (audience runs English Excel; original user-read stands).
- **Dataset**: unify → **"tập dữ liệu"** (Google-vi standard).
- **EN loanwords kept** (human: "some words should keep in English"): **Dashboard** (replaces
  "Bảng điều khiển", which read as Control Panel), **sheet** (drifted "trang tính" string
  realigned), **widget** (unchanged). Register call: office code-switching familiarity over
  vendor-VN polish.
- **Applied**: consistency batch (A1–A9, B1/B2/B5, D1–D3) + false-friend rephrasings
  (C1–C4, C6, C7) — 52 per-key rewrites + 55 global word-swap hits, `vi.json` values only.
- **Not applied**: B3/B4 (widget/slug stay EN per steer; slug gloss deferred), D4 duplicate
  sidebar label persists (pre-existing: `nav.dashboard` and `nav.dashboards` both "Dashboard"
  now, mirroring the prior duplicate "Bảng điều khiển" — cosmetic, EN has the same
  singular/plural pair).

## Check

- [x] No residual `Làm mới` in the `upload.refresh.*` / `datasets.refresh` VN strings. _(grep: none)_
- [x] Widened residual sweep: whole-file grep found 2 more `làm mới` — `upload.drift.subtitle`
      (fixed, in-scope) and `workflows.list.subtitle` (→ finding C1, awaits steer).
- [x] en/vi key sets identical (only values changed). _(parity check OK, re-run after the 2
      surgical fixes; `jq` valid)_
- [x] FE `tsc` green (values-only, no key renames).
- [x] Post-batch residual sweep on **values only** (keys excluded): "bộ dữ liệu", "Bảng điều
      khiển", "làm mới", "khung nhìn", "kết xuất", "Lực lượng", "thăng cấp", "xoá/huỷ/khoá",
      "canvas", "luận lý", "trang tính", "vd." — **all 0**; "workspace" remains only as the
      `{{workspace}}` placeholder.
- [x] Post-batch: JSON valid, en/vi key parity intact, `tsc` OK, `vitest` 277/277 passed.
- [ ] Human eyeball: each surface reads right in VN (menu, breadcrumb, title, button, banner,
      confirm) — now including the corpus-wide renames (Dashboard nav/pages, tập dữ liệu,
      workflow result copy).

## Act

**Learnings:** _(pending)_

**Promotions:** _(pending)_

**Prune check:** _(pending)_

## Feeds into → Round_147 (⑥ merge)

⑥ round 2 — **F5+F6 merge-on-key / precedence** (overlapping non-cumulative exports; identity
key + precedence are domain decisions), slid from R146 by this round's re-rank. Then F8
multi-range wizard → UI-batch (F7/F3/F4/F12/F13 + R140 list). **Carried**: R145 slice **1b**
(drift blast-radius preview).
