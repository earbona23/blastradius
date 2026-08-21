/**
 * Graph-based test coverage: which source files a test could exercise, without running
 * anything.
 *
 * A test file exercises every source file it can reach through imports. So the union of
 * forward-reachable sets from all test files is the set of source files under test; a
 * source file outside that union is a **test gap** -- no test even loads it, let alone
 * asserts on it. This is a coverage *proxy*, not line coverage: it proves a file is
 * reachable from a test, not that its branches are checked. But a file no test can reach
 * is unambiguously untested, and that is the signal the risk score needs.
 *
 * @module analysis/tests
 */

import { reachableSet } from './reach.js';

/**
 * @param {import('../graph/build.js').DepGraph} graph
 * @returns {{ covered: Set<string>, gaps: Set<string>, testFiles: Set<string> }}
 */
export function coverageByGraph(graph) {
  const covered = reachableSet(graph.forward, graph.testFiles);
  // A test file also "covers" itself for the purpose of not being flagged as a gap.
  for (const t of graph.testFiles) covered.add(t);

  const gaps = new Set();
  for (const file of graph.files) {
    if (!covered.has(file)) gaps.add(file);
  }
  return { covered, gaps, testFiles: graph.testFiles };
}

/**
 * Whether a single file is reachable from any test.
 * @param {string} file
 * @param {{ covered: Set<string> }} coverage
 * @returns {boolean}
 */
export function isCovered(file, coverage) {
  return coverage.covered.has(file);
}
