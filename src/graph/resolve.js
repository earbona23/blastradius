/**
 * Resolves an import specifier to a file inside the project, the way Node and bundlers
 * do: try the literal path, then a set of extensions, then an index file in a directory.
 * Bare specifiers (`react`, `node:fs`) resolve to nothing here -- they are external and
 * form no internal edge, though the caller may count them separately.
 *
 * @module graph/resolve
 */

import path from 'node:path';

/** Extensions tried, in order, when a specifier has none. */
export const RESOLVE_EXTENSIONS = ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.json'];

/** Index files tried when a specifier resolves to a directory. */
const INDEX_BASENAMES = RESOLVE_EXTENSIONS.map((ext) => `index${ext}`);

/**
 * @param {string} specifier            The raw import string.
 * @param {string} importerRel          Importer path, project-relative, POSIX.
 * @param {Set<string>} fileSet         All project files, project-relative, POSIX.
 * @param {Object} [options]
 * @param {Record<string, string>} [options.aliases]  Prefix→prefix rewrites (e.g. '@/'→'src/').
 * @returns {{ target: string | null, external: boolean }}
 */
export function resolveSpecifier(specifier, importerRel, fileSet, options = {}) {
  if (!specifier || specifier.startsWith('node:') || specifier.startsWith('data:')) {
    return { target: null, external: true };
  }

  // An alias rewrites to a path relative to the PROJECT ROOT, not to the importer.
  let aliasedRoot = null;
  if (options.aliases) {
    for (const [from, to] of Object.entries(options.aliases).sort((a, b) => b[0].length - a[0].length)) {
      const fromClean = from.replace(/\/$/, '');
      if (specifier === fromClean || specifier.startsWith(fromClean + '/') || specifier.startsWith(from)) {
        const rest = specifier.slice(fromClean.length).replace(/^\//, '');
        aliasedRoot = path.posix.normalize(`${to.replace(/\/$/, '')}/${rest}`.replace(/\/$/, ''));
        break;
      }
    }
  }

  const isRelative =
    aliasedRoot === null &&
    (specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/'));

  if (aliasedRoot === null && !isRelative) {
    // Bare specifier with no alias applied: external package.
    return { target: null, external: true };
  }

  let base;
  if (aliasedRoot !== null) {
    base = aliasedRoot; // already project-root-relative
  } else if (specifier.startsWith('/')) {
    base = specifier.replace(/^\/+/, '');
  } else {
    const importerDir = path.posix.dirname(importerRel);
    base = path.posix.normalize(path.posix.join(importerDir, specifier));
  }

  const found = tryCandidates(base, fileSet);
  return { target: found, external: found === null ? true : false };
}

/**
 * @param {string} base   A project-relative path with or without extension.
 * @param {Set<string>} fileSet
 * @returns {string | null}
 */
function tryCandidates(base, fileSet) {
  const cleaned = base.replace(/^\.\//, '');

  // 1. Exact file.
  if (fileSet.has(cleaned)) return cleaned;

  // 2. Rewrite a compiled-style extension to a source one (import './x.js' -> x.ts).
  const extMatch = cleaned.match(/\.(js|jsx|mjs|cjs)$/);
  if (extMatch) {
    const stem = cleaned.slice(0, -extMatch[0].length);
    for (const ext of RESOLVE_EXTENSIONS) {
      if (fileSet.has(stem + ext)) return stem + ext;
    }
  }

  // 3. Append each extension.
  for (const ext of RESOLVE_EXTENSIONS) {
    if (fileSet.has(cleaned + ext)) return cleaned + ext;
  }

  // 4. Directory index.
  for (const idx of INDEX_BASENAMES) {
    const candidate = cleaned === '' ? idx : `${cleaned}/${idx}`;
    if (fileSet.has(candidate)) return candidate;
  }

  return null;
}
