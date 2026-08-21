/**
 * Transitive reachability over the dependency graph.
 *
 * Forward reachability from F = everything F depends on, directly or not. Reverse
 * reachability from F = everything that depends on F -- its blast radius. Both are plain
 * breadth-first searches that also record the distance at which each node was first
 * reached, which the impact ranker uses so that a file one hop away weighs more than one
 * ten hops away.
 *
 * @module analysis/reach
 */

/**
 * @param {Map<string, Set<string>>} graph  Adjacency (forward or reverse).
 * @param {Iterable<string>} seeds
 * @returns {Map<string, number>}  Reached node -> shortest distance from any seed (seeds = 0).
 */
export function reachWithDistance(graph, seeds) {
  /** @type {Map<string, number>} */
  const dist = new Map();
  /** @type {string[]} */
  const queue = [];
  for (const s of seeds) {
    if (graph.has(s) && !dist.has(s)) {
      dist.set(s, 0);
      queue.push(s);
    }
  }
  let head = 0;
  while (head < queue.length) {
    const node = queue[head++];
    const d = dist.get(node);
    const neighbours = graph.get(node);
    if (!neighbours) continue;
    for (const next of neighbours) {
      if (!dist.has(next)) {
        dist.set(next, d + 1);
        queue.push(next);
      }
    }
  }
  return dist;
}

/**
 * The set reachable from seeds, excluding the seeds themselves.
 * @param {Map<string, Set<string>>} graph
 * @param {Iterable<string>} seeds
 * @returns {Set<string>}
 */
export function reachableSet(graph, seeds) {
  const dist = reachWithDistance(graph, seeds);
  const seedSet = new Set(seeds);
  const out = new Set();
  for (const node of dist.keys()) if (!seedSet.has(node)) out.add(node);
  return out;
}
