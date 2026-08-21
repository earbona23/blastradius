/**
 * PageRank over a dependency graph, by power iteration.
 *
 * Counting direct importers alone would call a utility imported by two entry points as
 * important as one imported by two leaf files. PageRank fixes that: importance flows
 * along edges, so a file depended on by files that are themselves depended on scores
 * higher. Run on the *reverse* graph, rank flows toward the files the codebase leans on
 * -- which is exactly criticality.
 *
 * Deterministic: uniform initial vector, fixed damping, fixed iteration cap, dangling
 * mass redistributed uniformly. Same graph in, same ranks out.
 *
 * @module analysis/pagerank
 */

/**
 * @param {string[]} nodes
 * @param {Map<string, Set<string>>} graph  Directed adjacency; rank flows node -> neighbour.
 * @param {Object} [options]
 * @param {number} [options.damping]
 * @param {number} [options.iterations]
 * @param {number} [options.tolerance]
 * @returns {Map<string, number>}  node -> rank in [0,1], summing to ~1.
 */
export function pagerank(nodes, graph, options = {}) {
  const damping = options.damping ?? 0.85;
  const maxIter = options.iterations ?? 100;
  const tol = options.tolerance ?? 1e-9;
  const N = nodes.length;
  if (N === 0) return new Map();

  const index = new Map(nodes.map((n, i) => [n, i]));
  const outDeg = new Array(N).fill(0);
  /** @type {number[][]} */
  const outEdges = nodes.map(() => []);
  for (let i = 0; i < N; i++) {
    const neigh = graph.get(nodes[i]);
    if (neigh) {
      for (const m of neigh) {
        const j = index.get(m);
        if (j !== undefined) {
          outEdges[i].push(j);
          outDeg[i]++;
        }
      }
    }
  }

  let rank = new Array(N).fill(1 / N);
  const base = (1 - damping) / N;

  for (let iter = 0; iter < maxIter; iter++) {
    const next = new Array(N).fill(base);
    let dangling = 0;
    for (let i = 0; i < N; i++) {
      if (outDeg[i] === 0) {
        dangling += rank[i];
        continue;
      }
      const share = (damping * rank[i]) / outDeg[i];
      for (const j of outEdges[i]) next[j] += share;
    }
    // Redistribute rank from dangling nodes uniformly.
    const danglingShare = (damping * dangling) / N;
    let diff = 0;
    for (let i = 0; i < N; i++) {
      next[i] += danglingShare;
      diff += Math.abs(next[i] - rank[i]);
    }
    rank = next;
    if (diff < tol) break;
  }

  const out = new Map();
  for (let i = 0; i < N; i++) out.set(nodes[i], rank[i]);
  return out;
}
