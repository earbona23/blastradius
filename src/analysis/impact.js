/**
 * The blast radius of a change: given the files a diff touches, what could break, ranked,
 * and how risky the change is.
 *
 * Impact = the union of the reverse-reachable sets of the changed files (everything that
 * transitively imports something you touched), each impacted file ranked by how close it
 * is to the change and how critical it is in its own right. The risk score then folds in
 * the part teams actually miss: how much of what you touched, and what it reaches, has no
 * test. A large blast radius through well-tested code is routine; a small one through
 * critical, untested code is where regressions hide, and the score says so.
 *
 * @module analysis/impact
 */

import { reachWithDistance } from './reach.js';
import { clamp } from '../util/num.js';

/**
 * @typedef {Object} ImpactedFile
 * @property {string} file
 * @property {number} distance       Hops from the nearest changed file.
 * @property {number} criticality    0-100, from computeCriticality.
 * @property {boolean} tested
 */

/**
 * @typedef {Object} ImpactReport
 * @property {string[]} changed        Changed files that are in the graph.
 * @property {string[]} changedUnknown Changed files not found in the graph (deleted, non-source).
 * @property {ImpactedFile[]} impacted Ranked, excluding the changed files themselves.
 * @property {number} risk             0-100 risk score for the change.
 * @property {string} verdict          'low' | 'moderate' | 'high' | 'critical'.
 * @property {Object} factors          The components behind the score, for transparency.
 * @property {string[]} untestedTouched Changed or impacted files with no test reaching them.
 */

/**
 * @param {import('../graph/build.js').DepGraph} graph
 * @param {string[]} changedFiles                     Project-relative POSIX paths.
 * @param {import('./criticality.js').CriticalityEntry[]} criticality
 * @param {{ covered: Set<string> }} coverage
 * @returns {ImpactReport}
 */
export function analyzeImpact(graph, changedFiles, criticality, coverage) {
  const critMap = new Map(criticality.map((c) => [c.file, c]));
  const fileSet = new Set(graph.files);

  const changed = changedFiles.filter((f) => fileSet.has(f));
  const changedUnknown = changedFiles.filter((f) => !fileSet.has(f));

  const dist = reachWithDistance(graph.reverse, changed);
  const changedSet = new Set(changed);

  /** @type {ImpactedFile[]} */
  const impacted = [];
  for (const [file, d] of dist) {
    if (changedSet.has(file)) continue;
    const crit = critMap.get(file);
    impacted.push({
      file,
      distance: d,
      criticality: crit?.score ?? 0,
      tested: coverage.covered.has(file),
    });
  }
  impacted.sort(
    (a, b) => a.distance - b.distance || b.criticality - a.criticality || a.file.localeCompare(b.file),
  );

  // Files in the change or its radius that no test reaches.
  const untestedTouched = [...changed, ...impacted.map((i) => i.file)].filter(
    (f) => !coverage.covered.has(f),
  );

  const risk = computeRisk({ graph, changed, impacted, criticality: critMap, coverage });

  return {
    changed,
    changedUnknown,
    impacted,
    risk: risk.score,
    verdict: risk.verdict,
    factors: risk.factors,
    untestedTouched,
  };
}

/**
 * Risk in [0,100] from four bounded factors, so no single one can dominate and each is
 * legible in the output:
 *   - blast    how much of the project is in the radius (log-scaled)
 *   - critical the peak criticality among changed files
 *   - exposure the criticality-weighted size of the radius
 *   - testgap  the untested share of the change and its radius
 */
function computeRisk({ graph, changed, impacted, criticality, coverage }) {
  const total = graph.files.length || 1;

  const blast = Math.log1p(impacted.length) / Math.log1p(total);

  let peakCrit = 0;
  for (const f of changed) peakCrit = Math.max(peakCrit, (criticality.get(f)?.score ?? 0) / 100);

  const exposure =
    impacted.length === 0
      ? 0
      : clamp(
          impacted.reduce((s, i) => s + i.criticality, 0) / (impacted.length * 100) +
            Math.log1p(impacted.length) / Math.log1p(total) / 2,
          0,
          1,
        );

  const universe = new Set([...changed, ...impacted.map((i) => i.file)]);
  let untested = 0;
  for (const f of universe) if (!coverage.covered.has(f)) untested++;
  const testgap = universe.size === 0 ? 0 : untested / universe.size;

  const score = Math.round(
    100 * clamp(0.30 * blast + 0.28 * peakCrit + 0.20 * exposure + 0.22 * testgap, 0, 1),
  );

  const verdict = score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low';

  return {
    score,
    verdict,
    factors: {
      blastRadius: impacted.length,
      peakCriticality: Math.round(peakCrit * 100),
      exposure: Math.round(exposure * 100),
      testGapPercent: Math.round(testgap * 100),
    },
  };
}
