/**
 * Exports the dependency graph (or the blast radius of a change) as a Mermaid diagram,
 * which renders inline on GitHub and in most Markdown viewers. Free: seeing the graph is
 * core value, not an upsell.
 *
 * @module report/mermaid
 */

/**
 * @param {import('../graph/build.js').DepGraph} graph
 * @param {Object} [options]
 * @param {Set<string>} [options.highlight]  Nodes to mark (e.g. changed files).
 * @param {number} [options.maxNodes]
 * @returns {string}
 */
export function renderMermaid(graph, options = {}) {
  const maxNodes = options.maxNodes ?? 150;
  const highlight = options.highlight ?? new Set();
  const nodes = graph.files.slice(0, maxNodes);
  const included = new Set(nodes);
  const id = new Map(nodes.map((f, i) => [f, `n${i}`]));

  const lines = ['graph LR'];
  for (const f of nodes) {
    lines.push(`  ${id.get(f)}["${escapeLabel(f)}"]`);
  }
  for (const f of nodes) {
    for (const dep of graph.forward.get(f) ?? []) {
      if (included.has(dep)) lines.push(`  ${id.get(f)} --> ${id.get(dep)}`);
    }
  }
  for (const f of nodes) {
    if (highlight.has(f)) lines.push(`  style ${id.get(f)} fill:#f9d,stroke:#c36,stroke-width:2px`);
  }
  if (graph.files.length > maxNodes) {
    lines.push(`  %% truncated: showing ${maxNodes} of ${graph.files.length} files`);
  }
  return lines.join('\n');
}

function escapeLabel(s) {
  return s.replace(/"/g, "'");
}
