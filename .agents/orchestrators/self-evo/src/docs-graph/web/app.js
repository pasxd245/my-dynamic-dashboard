// docs-graph UI — @antv/g6 v5 loaded from CDN (no bundler).
import { Graph } from "https://esm.sh/@antv/g6@5";

const TRACK_COLOR = {
  "product": "#2563eb",
  "agent-method": "#16a34a",
  "self-evo": "#d97706",
  "unknown": "#6b7280",
};

const ENTITY_COLOR = "#7c3aed";

const SEV_COLOR = { error: "#dc2626", warn: "#f59e0b", info: "#6b7280" };

const state = {
  graph: null,
  scanId: null,
  positions: {},
  selectedId: null,
};

async function api(path, init) {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return res.json();
}

function severityFor(path, findings) {
  const mine = findings.filter((f) => f.nodePath === path);
  if (mine.some((f) => f.severity === "error")) return "error";
  if (mine.some((f) => f.severity === "warn")) return "warn";
  return null;
}

function basename(p) {
  return p.split("/").pop() ?? p;
}

function buildData(graph, findings) {
  const seen = new Set(graph.nodes.map((n) => n.path));
  const nodes = graph.nodes.map((n) => {
    const sev = severityFor(n.path, findings);
    const pos = state.positions[n.path];
    return {
      id: n.path,
      data: {
        label: basename(n.path),
        path: n.path,
        track: n.track,
        kind: n.kind,
        wordCount: n.wordCount,
        inboundRefs: n.inboundRefs,
        outboundRefs: n.outboundRefs,
        lastModified: n.lastModified,
        severity: sev,
        color: TRACK_COLOR[n.track] ?? "#9ca3af",
        pinned: !!pos?.pinned,
      },
      // G6 accepts {x, y} when present; force layout respects fixed positions.
      ...(pos ? { style: { x: pos.x, y: pos.y } } : {}),
    };
  });
  const edges = graph.edges
    .filter((e) => seen.has(e.src) && seen.has(e.dst))
    .map((e, i) => ({
      id: `e${i}`,
      source: e.src,
      target: e.dst,
      data: { kind: e.kind, line: e.line, broken: e.broken },
    }));
  return { nodes, edges };
}

async function buildSemanticData(graph, findings) {
  // Pull entity list + per-node mentions. Show entity nodes (purple) and the
  // file nodes that mention them, with mention edges between.
  const entRes = await api(`/api/entities${state.scanId ? `?scan=${encodeURIComponent(state.scanId)}` : ""}`);
  const entities = entRes.entities || [];

  // Fetch mentions for each entity (small N — dict has <30 entries).
  const mentionMap = new Map(); // entityId -> Set(filePath)
  for (const e of entities) {
    const det = await api(`/api/entity?id=${encodeURIComponent(e.id)}${state.scanId ? `&scan=${encodeURIComponent(state.scanId)}` : ""}`);
    const set = new Set();
    for (const m of det.mentions || []) {
      // Reduce to file-level (drop heading anchors for cleaner semantic layout).
      const filePath = m.nodePath.split("#")[0];
      set.add(filePath);
    }
    mentionMap.set(e.id, set);
  }

  const fileSet = new Set();
  for (const set of mentionMap.values()) for (const p of set) fileSet.add(p);

  const nodeByPath = new Map(graph.nodes.map((n) => [n.path, n]));
  const fileNodes = [...fileSet]
    .filter((p) => nodeByPath.has(p))
    .map((p) => {
      const n = nodeByPath.get(p);
      const sev = severityFor(n, findings);
      return {
        id: p,
        data: {
          label: basename(p),
          path: p,
          track: n.track,
          kind: n.kind,
          wordCount: n.wordCount,
          inboundRefs: n.inboundRefs,
          outboundRefs: n.outboundRefs,
          lastModified: n.lastModified,
          severity: sev,
          color: TRACK_COLOR[n.track] ?? "#9ca3af",
          isEntity: false,
        },
      };
    });

  const entityNodes = entities.map((e) => ({
    id: `entity:${e.id}`,
    data: {
      label: e.display,
      path: `entity:${e.id}`,
      track: "entity",
      kind: e.kind,
      wordCount: 0,
      inboundRefs: e.mentionCount,
      outboundRefs: e.codeUsageCount,
      lastModified: 0,
      severity: e.codeUsageCount === 0 ? "warn" : null,
      color: ENTITY_COLOR,
      isEntity: true,
      entityId: e.id,
      mentionCount: e.mentionCount,
      codeUsageCount: e.codeUsageCount,
    },
  }));

  const edges = [];
  let i = 0;
  for (const [entityId, fileSet] of mentionMap) {
    for (const filePath of fileSet) {
      if (!nodeByPath.has(filePath)) continue;
      edges.push({
        id: `m${i++}`,
        source: filePath,
        target: `entity:${entityId}`,
        data: { kind: "mention" },
      });
    }
  }

  return { nodes: [...fileNodes, ...entityNodes], edges };
}

function nodeStyle() {
  // G6 v5 takes style as static object OR functions of the (datum) tuple.
  // We compose a card-style rect with track-coloured fill, kind chip
  // below the name, severity ring via badges, and size driven by inbound.
  return {
    type: "rect",
    style: {
      size: (d) => {
        const base = 22 + Math.min(28, (d.data.inboundRefs ?? 0) * 2);
        return [Math.max(120, base * 4), 44];
      },
      radius: 8,
      fill: (d) => withAlpha(d.data.color, 0.12),
      stroke: (d) => d.data.color,
      lineWidth: 1.5,
      shadowColor: "rgba(15, 23, 42, 0.08)",
      shadowBlur: 6,
      shadowOffsetY: 1,
      cursor: "grab",

      // Main label — basename
      labelText: (d) => truncate(d.data.label, 22),
      labelFill: "#0f172a",
      labelFontSize: 12,
      labelFontWeight: 600,
      labelPlacement: "center",
      labelOffsetY: -6,

      // Kind chip — second line beneath the basename
      iconText: (d) => `${d.data.kind} · ↘${d.data.inboundRefs}`,
      iconFill: "#475569",
      iconFontSize: 10,
      iconOffsetY: 10,

      // Severity border + corner badge
      badge: true,
      badges: (d) => d.data.severity ? [{
        text: d.data.severity.toUpperCase(),
        placement: "right-top",
        backgroundFill: SEV_COLOR[d.data.severity],
        fill: "#fff",
        fontSize: 9,
        padding: [1, 4],
      }] : [],
    },
    state: {
      selected: {
        lineWidth: 3,
        stroke: "#111827",
        shadowBlur: 12,
        shadowColor: "rgba(15, 23, 42, 0.25)",
      },
      "highlight-related": {
        lineWidth: 2,
      },
      inactive: {
        opacity: 0.18,
      },
    },
  };
}

function edgeStyle() {
  return {
    type: "line",
    style: {
      stroke: (d) => (d.data?.kind === "pair" ? "#a78bfa" :
                      d.data?.kind === "code-ref" ? "#cbd5f5" : "#d1d5db"),
      lineDash: (d) => (d.data?.kind === "pair" ? [4, 3] : null),
      lineWidth: 1,
      endArrow: true,
      endArrowSize: 6,
      opacity: 0.7,
    },
    state: {
      "highlight-related": {
        stroke: "#0f172a",
        lineWidth: 1.8,
        opacity: 1,
      },
      inactive: { opacity: 0.08 },
    },
  };
}

function layoutSpec() {
  return {
    type: "d3-force",
    preventOverlap: true,
    nodeSize: 100,
    link: { distance: 110, strength: 0.4 },
    manyBody: { strength: -260 },
    collide: { radius: 60 },
    x: { strength: 0.05 },
    y: { strength: 0.05 },
  };
}

function withAlpha(hex, a) {
  // hex like "#2563eb" → rgba
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${a})`;
}

function truncate(s, n) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

async function loadGraph() {
  const view = document.getElementById("filter-view").value;
  const params = new URLSearchParams();
  const track = document.getElementById("filter-track").value;
  const kind = document.getElementById("filter-kind").value;
  if (track) params.set("track", track);
  if (kind) params.set("kind", kind);
  const data = await api(`/api/graph?${params}`);
  state.scanId = data.scanId;
  state.positions = data.positions || {};

  const findingsRes = await api(`/api/findings${data.scanId ? `?scan=${encodeURIComponent(data.scanId)}` : ""}`);
  const findings = findingsRes.findings || [];

  const scansRes = await api("/api/scans");
  renderTopbarMeta(scansRes.scans[0]);
  renderAllFindings(findings);

  const g6Data = view === "semantic"
    ? await buildSemanticData(data, findings)
    : buildData(data, findings);

  if (state.graph) {
    state.graph.setData(g6Data);
    await state.graph.render();
    return;
  }

  state.graph = new Graph({
    container: "cy",
    autoResize: true,
    data: g6Data,
    node: nodeStyle(),
    edge: edgeStyle(),
    layout: layoutSpec(),
    behaviors: [
      "drag-canvas",
      "zoom-canvas",
      "drag-element",
      {
        type: "hover-activate",
        degree: 1,
        state: "highlight-related",
        inactiveState: "inactive",
      },
      {
        type: "click-select",
        state: "selected",
      },
    ],
  });

  bindEvents();
  await state.graph.render();
  state.graph.fitView({ padding: 30 });
}

function bindEvents() {
  state.graph.on("node:click", async (e) => {
    const id = e.target?.id ?? e.itemId;
    if (!id) return;
    state.selectedId = id;
    if (id.startsWith("entity:")) {
      await renderEntityPanel(id.slice("entity:".length));
    } else {
      await renderPanel(id);
    }
  });

  state.graph.on("canvas:click", () => {
    state.selectedId = null;
    document.getElementById("panel-body").hidden = true;
    document.getElementById("panel-empty").hidden = false;
  });

  state.graph.on("node:dragend", async (e) => {
    const id = e.target?.id ?? e.itemId;
    if (!id) return;
    if (id.startsWith("entity:")) return; // pseudo-nodes; don't persist positions
    const node = state.graph.getNodeData(id);
    const { x, y } = node?.style ?? {};
    if (typeof x !== "number" || typeof y !== "number") return;
    try {
      await api("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: id, x, y, pinned: true }),
      });
    } catch (err) {
      console.error("position save failed", err);
    }
  });
}

async function renderPanel(path) {
  document.getElementById("panel-empty").hidden = true;
  document.getElementById("panel-body").hidden = false;
  const data = await api(`/api/node?path=${encodeURIComponent(path)}`);
  document.getElementById("np-path").textContent = data.node.path;
  document.getElementById("np-track").textContent = data.node.track;
  document.getElementById("np-kind").textContent = data.node.kind;
  document.getElementById("np-words").textContent = data.node.wordCount;
  document.getElementById("np-out").textContent = data.node.outboundRefs;
  document.getElementById("np-in").textContent = data.node.inboundRefs;
  document.getElementById("np-mtime").textContent = new Date(data.node.lastModified).toISOString().slice(0, 19);

  renderList("np-findings", data.findings, (f) => `[${f.severity}] ${f.detector}: ${f.body}`);
  document.getElementById("np-finding-count").textContent = data.findings.length;
  renderList(
    "np-outbound",
    data.outbound,
    (e) => `${e.line}: → ${e.dst} (${e.kind}${e.broken ? ", BROKEN" : ""})`,
    (e) => !e.broken && selectByPath(e.dst),
  );
  renderList(
    "np-inbound",
    data.inbound,
    (e) => `${e.src}:${e.line} (${e.kind})`,
    (e) => selectByPath(e.src),
  );
  renderList(
    "np-annotations",
    data.annotations,
    (a) => `[${new Date(a.createdAt).toISOString().slice(0, 10)}] ${a.author}: ${a.body}`,
  );
  document.getElementById("np-anno-count").textContent = data.annotations.length;
}

async function renderEntityPanel(entityId) {
  document.getElementById("panel-empty").hidden = true;
  document.getElementById("panel-body").hidden = false;
  const scanQ = state.scanId ? `&scan=${encodeURIComponent(state.scanId)}` : "";
  const data = await api(`/api/entity?id=${encodeURIComponent(entityId)}${scanQ}`);
  document.getElementById("np-path").textContent = `entity: ${data.entity.display}`;
  document.getElementById("np-track").textContent = "—";
  document.getElementById("np-kind").textContent = data.entity.kind;
  document.getElementById("np-words").textContent = "—";
  document.getElementById("np-out").textContent = `${data.codeUsages.length} code`;
  document.getElementById("np-in").textContent = `${data.mentions.length} docs`;
  document.getElementById("np-mtime").textContent = "—";

  renderList("np-findings", [], () => "");
  document.getElementById("np-finding-count").textContent = 0;

  // Reuse the outbound/inbound lists for code usages / doc mentions.
  renderList(
    "np-outbound",
    data.codeUsages,
    (u) => `${u.filePath}:${u.line ?? "?"} — ${u.surface.trim().slice(0, 80)}`,
  );
  renderList(
    "np-inbound",
    data.mentions,
    (m) => `${m.nodePath}:${m.line ?? "?"} (${m.source})`,
    (m) => selectByPath(m.nodePath.split("#")[0]),
  );
  renderList("np-annotations", [], () => "");
  document.getElementById("np-anno-count").textContent = 0;
}

function renderList(elId, items, fmt, onClick) {
  const ul = document.getElementById(elId);
  ul.innerHTML = "";
  for (const it of items) {
    const li = document.createElement("li");
    li.textContent = fmt(it);
    if (onClick) {
      li.classList.add("clickable");
      li.addEventListener("click", () => onClick(it));
    }
    ul.appendChild(li);
  }
}

function selectByPath(path) {
  if (!state.graph) return;
  const node = state.graph.getNodeData(path);
  if (!node) return;
  state.graph.focusElement(path, { animation: { duration: 250 } });
  state.selectedId = path;
  renderPanel(path).catch(console.error);
}

function renderTopbarMeta(scan) {
  const el = document.getElementById("scan-meta");
  if (!scan) {
    el.textContent = "(no scans)";
    return;
  }
  const when = new Date(scan.startedAt).toISOString().slice(0, 19).replace("T", " ");
  el.textContent = `${scan.id}  •  ${when}  •  ${scan.nodeCount} nodes  •  ${scan.edgeCount} edges  •  ${scan.findingCount} findings`;
}

function renderAllFindings(findings) {
  const ul = document.getElementById("all-findings");
  ul.innerHTML = "";
  const rank = { error: 3, warn: 2, info: 1 };
  const sorted = [...findings].sort((a, b) => (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0));
  for (const f of sorted) {
    const li = document.createElement("li");
    li.className = `sev-${f.severity} ${f.nodePath ? "clickable" : ""}`;
    li.textContent = `[${f.severity}] ${f.detector}: ${f.body}`;
    if (f.nodePath) li.addEventListener("click", () => selectByPath(f.nodePath));
    ul.appendChild(li);
  }
  document.getElementById("all-finding-count").textContent = findings.length;
}

function bindControls() {
  document.getElementById("filter-view").addEventListener("change", async () => {
    // Force a fresh Graph instance so layout/styles fully reset between modes.
    if (state.graph) {
      state.graph.destroy();
      state.graph = null;
    }
    await loadGraph();
  });
  document.getElementById("filter-track").addEventListener("change", loadGraph);
  document.getElementById("filter-kind").addEventListener("change", loadGraph);
  document.getElementById("btn-relayout").addEventListener("click", async () => {
    if (!state.graph) return;
    await state.graph.layout();
    state.graph.fitView({ padding: 30 });
  });
  document.getElementById("btn-fit").addEventListener("click", () => state.graph?.fitView({ padding: 30 }));
  document.getElementById("btn-rescan").addEventListener("click", async (e) => {
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = "scanning…";
    try {
      await api("/api/scan", { method: "POST" });
      await loadGraph();
    } finally {
      btn.disabled = false;
      btn.textContent = "re-scan";
    }
  });
  document.getElementById("anno-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.selectedId) return;
    const author = document.getElementById("anno-author").value.trim();
    const body = document.getElementById("anno-body").value.trim();
    const tagsRaw = document.getElementById("anno-tags").value.trim();
    if (!author || !body) return;
    const tags = tagsRaw ? tagsRaw.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    await api("/api/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: state.selectedId, author, body, tags }),
    });
    document.getElementById("anno-body").value = "";
    document.getElementById("anno-tags").value = "";
    await renderPanel(state.selectedId);
  });
}

bindControls();
loadGraph().catch((err) => {
  document.getElementById("scan-meta").textContent = `error: ${err.message}`;
  console.error(err);
});
