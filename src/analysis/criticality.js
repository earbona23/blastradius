/**
 * Criticality: how much of the codebase leans on each file, as a 0-100 score.
 *
 * Two independent signals, because each is fooled on its own:
 *
 *  - **Reach mass** -- the size of a file's reverse-reachable set (its blast radius),
 *    as a fraction of the project. Answers "how many files would feel a change here".
 *  - **PageRank** on the reverse graph -- answers "are those dependents themselves
 *    important", so a utility under the entry points outranks one under two leaves.
 *
 * They are combined on a log scale (blast radius is heavy-tailed: a handful of files are
 * depended on by almost everything) and normalised to 0-100. A file's coverage does not
 * change its criticality -- criticality is about position in the graph -- but it does
 * change the *risk* of touching it, which is a separate score.
 *
 * @module analysis/criticality
 */

import { reachableSet } from './reach.js';
import { pagerank } from './pagerank.js';

/**
 * @typedef {Object} CriticalityEntry
 * @property {string} file
 * @property {number} score          0-100.
 * @property {number} dependents     Size of the reverse-reachable set (transitive).
 * @property {number} directDependents
 * @property {number} pagerank
 * @property {boolean} tested
 */

/**
 * @param {import('../graph/build.js').DepGraph} graph
 * @param {Object} [options]
 * @param {{ covered: Set<string> }} [options.coverage]
 * @returns {CriticalityEntry[]}  Sorted by score descending.
 */
export function computeCriticality(graph, options = {}) {
  const files = graph.files;
  const N = files.length || 1;
  // PageRank on the FORWARD graph: rank flows toward dependencies and accumulates on
  // the most-depended-upon files, which is exactly what criticality means. (Reach mass,
  // above, uses the reverse graph to measure the literal blast-radius size.)
  const pr = pagerank(files, graph.forward);

  // Normalisers computed across the project.
  const reachMass = new Map();
  let maxLogReach = 0;
  for (const file of files) {
    const reach = reachableSet(graph.reverse, [file]).size;
    reachMass.set(file, reach);
    const lr = Math.log1p(reach);
    if (lr > maxLogReach) maxLogReach = lr;
  }
  let maxPr = 0;
  for (const v of pr.values()) if (v > maxPr) maxPr = v;

  const covered = options.coverage?.covered;

  const entries = files.map((file) => {
    const reach = reachMass.get(file) ?? 0;
    const reachComponent = maxLogReach > 0 ? Math.log1p(reach) / maxLogReach : 0;
    const prComponent = maxPr > 0 ? (pr.get(file) ?? 0) / maxPr : 0;
    // Weighted blend; reach mass leads because it is the literal blast radius, PageRank
    // refines the ordering among files with similar reach.
    const score = Math.round(100 * (0.65 * reachComponent + 0.35 * prComponent));
    return {
      file,
      score,
      dependents: reach,
      directDependents: graph.reverse.get(file)?.size ?? 0,
      pagerank: pr.get(file) ?? 0,
      tested: covered ? covered.has(file) : true,
    };
  });

  entries.sort((a, b) => b.score - a.score || b.dependents - a.dependents || a.file.localeCompare(b.file));
  return entries;
}
