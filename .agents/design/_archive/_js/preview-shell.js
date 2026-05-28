/*
 * Shared JS for HIxAI design previews.
 *
 * Loaded as a classic <script src="..."> (no `type="module"`) so it works
 * directly from file:// — same constraint the README's "self-contained,
 * no build, no server" requirement places on the previews themselves.
 * The functions below are global on purpose; inline preview-specific
 * scripts call them by name (toggleGroup, toggleCollapse).
 *
 * Triggered by R14 polish pass (post-Complete append): four previews each
 * carried identical copies of toggleGroup + toggleCollapse + the
 * MenuFold/Unfold SVG path constants. Extracting saved ~30 lines per
 * preview and means future previews inherit the chrome interactions for
 * free — same pattern as the N=2 _css/ extraction.
 *
 * NOT here: page-specific state toggles, modal open/close, wizard
 * branching logic. Those stay inline in the preview that owns them.
 */

/* Sidebar nav group expand/collapse — used by .mdd-nav-group-header in
   every preview's sidebar. The element with the given id gets its
   .is-expanded class toggled. */
function toggleGroup(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('is-expanded');
}

/* MenuFoldOutlined and MenuUnfoldOutlined path data from
   @ant-design/icons-svg. Swapped in/out on the topbar fold button by
   toggleCollapse(). The paths are visually noisy in source; pinning them
   here keeps the previews readable. */
const FOLD_PATH =
  'M408 442h480c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H408c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8zm-8 204c0 4.4 3.6 8 8 8h480c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H408c-4.4 0-8 3.6-8 8v56zm504-486H120c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zm0 632H120c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zM142.4 642.1L298.7 519a8.84 8.84 0 000-13.9L142.4 381.9c-5.8-4.6-14.4-.5-14.4 6.9v246.3a8.9 8.9 0 0014.4 7z';
const UNFOLD_PATH =
  'M408 442h480c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H408c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8zm-8 204c0 4.4 3.6 8 8 8h480c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H408c-4.4 0-8 3.6-8 8v56zm504-486H120c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zm0 632H120c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zM880.1 638l-156.3-123a8.84 8.84 0 010-13.9L880.1 378c5.8-4.6 14.4-.5 14.4 6.9v246.3c0 7.4-8.6 11.5-14.4 6.8z';

/* Topbar fold/unfold sidebar toggle. Expects:
   - #shell — the .mdd-shell element (gains/loses .is-collapsed)
   - #toggle-icon-path — the <path> inside the topbar's SVG icon
   Index page (no topbar fold) simply omits both elements; the function
   no-ops cleanly. */
function toggleCollapse() {
  const shell = document.getElementById('shell');
  if (!shell) return;
  shell.classList.toggle('is-collapsed');
  const collapsed = shell.classList.contains('is-collapsed');
  const path = document.getElementById('toggle-icon-path');
  if (path) path.setAttribute('d', collapsed ? UNFOLD_PATH : FOLD_PATH);
}
