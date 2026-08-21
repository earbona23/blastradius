/**
 * blastradius — change-impact analysis for JavaScript & TypeScript.
 *
 * Public API. `survey()` ranks a whole project by criticality; `impact()` computes the
 * blast radius of a set of changed files. Everything is a pure analysis over a graph the
 * tool builds by reading source files — no code is executed.
 *
 * @module blastradius
 */

import { buildGraph } from './graph/build.js';
import { computeCriticality } from './analysis/criticality.js';
import { coverageByGraph } from './analysis/tests.js';
import { analyzeImpact } from './analysis/impact.js';
import { changedFiles } from './git.js';

export { buildGraph } from './graph/build.js';
export { computeCriticality } from './analysis/criticality.js';
export { coverageByGraph } from './analysis/tests.js';
export { analyzeImpact } from './analysis/impact.js';
export { changedFiles } from './git.js';
export { extractImports } from './graph/imports.js';
export { pagerank } from './analysis/pagerank.js';
export { verifyLicenseKey } from './license/verify.js';
export { entitlement, activate } from './license/store.js';

/**
 * Build the graph and rank every file by criticality.
 * @param {string} root
 * @param {Object} [options]  Forwarded to buildGraph.
 * @returns {Promise<{ graph: import('./graph/build.js').DepGraph, criticality: import('./analysis/criticality.js').CriticalityEntry[], coverage: ReturnType<typeof coverageByGraph> }>}
 */
export async function survey(root, options = {}) {
  const graph = await buildGraph(root, options);
  const coverage = coverageByGraph(graph);
  const criticality = computeCriticality(graph, { coverage });
  return { graph, criticality, coverage };
}

/**
 * Compute the blast radius of a change.
 * @param {string} root
 * @param {Object} [options]
 * @param {string[]} [options.files]   Explicit changed files (project-relative POSIX).
 * @param {string} [options.since]     A git ref; changed files are read from git.
 * @param {Record<string, string>} [options.aliases]  Path aliases, forwarded to buildGraph.
 * @param {Set<string>} [options.ignoreDirs]
 * @param {number} [options.maxFiles]
 * @returns {Promise<{ graph: import('./graph/build.js').DepGraph, report: import('./analysis/impact.js').ImpactReport }>}
 */
export async function impact(root, options = {}) {
  const graph = await buildGraph(root, options);
  const coverage = coverageByGraph(graph);
  const criticality = computeCriticality(graph, { coverage });

  let files = options.files;
  if (!files) files = await changedFiles(root, { since: options.since });

  const report = analyzeImpact(graph, files, criticality, coverage);
  return { graph, report };
}
