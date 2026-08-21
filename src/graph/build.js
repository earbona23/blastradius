/**
 * Assembles the dependency graph: which files import which, forward and reverse.
 *
 * The reverse graph is where the value is. "A imports B" forward becomes "B is depended
 * on by A" reverse, and reverse reachability from a node is exactly its blast radius --
 * every file that would feel a change to it. The rest of the tool is graph algorithms on
 * top of what this builds.
 *
 * @module graph/build
 */

import { extractImports } from './imports.js';
import { resolveSpecifier } from './resolve.js';
import { scanProject, readSource } from './scan.js';

/** Filename patterns treated as tests. */
const TEST_RE = /(\.|_)(test|spec)\.[cm]?[jt]sx?$/i;
const TEST_DIR_RE = /(^|\/)(__tests__|tests?|__specs?__)(\/|$)/i;

/**
 * @typedef {Object} DepGraph
 * @property {string} root
 * @property {string[]} files                    All analysed files (POSIX relative).
 * @property {Map<string, Set<string>>} forward  file -> files it imports (internal).
 * @property {Map<string, Set<string>>} reverse  file -> files that import it.
 * @property {Map<string, string[]>} external     file -> external specifiers it imports.
 * @property {Map<string, number>} dynamic        file -> count of unresolved dynamic imports.
 * @property {Map<string, string[]>} unresolved   file -> specifiers that resolved to nothing.
 * @property {Set<string>} testFiles
 * @property {boolean} truncated
 */

/**
 * @param {string} root  Absolute project root.
 * @param {Object} [options]
 * @param {Record<string, string>} [options.aliases]
 * @param {Set<string>} [options.ignoreDirs]
 * @param {number} [options.maxFiles]
 * @returns {Promise<DepGraph>}
 */
export async function buildGraph(root, options = {}) {
  const { files, truncated } = await scanProject(root, options);
  const fileSet = new Set(files);

  const forward = new Map(files.map((f) => [f, new Set()]));
  const reverse = new Map(files.map((f) => [f, new Set()]));
  const external = new Map();
  const dynamic = new Map();
  const unresolved = new Map();
  const testFiles = new Set(files.filter(isTestFile));

  for (const file of files) {
    let source;
    try {
      source = await readSource(root, file);
    } catch {
      continue;
    }
    const { specifiers, dynamicUnresolved } = extractImports(source);
    if (dynamicUnresolved) dynamic.set(file, dynamicUnresolved);

    const ext = [];
    const unres = [];
    for (const spec of specifiers) {
      const { target, external: isExt } = resolveSpecifier(spec, file, fileSet, {
        aliases: options.aliases,
      });
      if (target) {
        if (target !== file) {
          forward.get(file).add(target);
          reverse.get(target).add(file);
        }
      } else if (isExt && (spec.startsWith('.') || spec.startsWith('/'))) {
        // A relative specifier that resolved to nothing: a real dangling reference.
        unres.push(spec);
      } else if (isExt) {
        ext.push(spec);
      }
    }
    if (ext.length) external.set(file, ext);
    if (unres.length) unresolved.set(file, unres);
  }

  return { root, files, forward, reverse, external, dynamic, unresolved, testFiles, truncated };
}

/** @param {string} file @returns {boolean} */
export function isTestFile(file) {
  return TEST_RE.test(file) || TEST_DIR_RE.test(file);
}
