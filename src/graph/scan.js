/**
 * Walks a project directory and returns the source files worth analysing, skipping the
 * places dependency edges never usefully lead (node_modules, build output, VCS).
 *
 * @module graph/scan
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

/** Source extensions analysed. */
export const SOURCE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts',
]);

/** Directories never descended into. */
export const DEFAULT_IGNORES = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.nuxt',
  '.svelte-kit', '.turbo', '.cache', 'vendor', '.venv', '__pycache__',
]);

/**
 * @param {string} root  Absolute project root.
 * @param {Object} [options]
 * @param {Set<string>} [options.ignoreDirs]
 * @param {number} [options.maxFiles]   Safety cap; scanning stops after this many files.
 * @returns {Promise<{ root: string, files: string[], truncated: boolean }>} POSIX relative paths.
 */
export async function scanProject(root, options = {}) {
  const ignore = options.ignoreDirs ?? DEFAULT_IGNORES;
  const maxFiles = options.maxFiles ?? 50_000;
  /** @type {string[]} */
  const files = [];
  let truncated = false;

  /** @param {string} dir */
  async function walk(dir) {
    if (truncated) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (truncated) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (ignore.has(entry.name) || entry.name.startsWith('.')) continue;
        await walk(full);
      } else if (entry.isFile()) {
        if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
          files.push(toPosixRel(root, full));
          if (files.length >= maxFiles) {
            truncated = true;
            return;
          }
        }
      }
    }
  }

  const info = await stat(root).catch(() => null);
  if (!info || !info.isDirectory()) {
    throw new Error(`Not a directory: ${root}`);
  }
  await walk(root);
  files.sort();
  return { root, files, truncated };
}

/**
 * Read a project-relative file's contents.
 * @param {string} root @param {string} rel
 * @returns {Promise<string>}
 */
export async function readSource(root, rel) {
  return readFile(path.join(root, rel), 'utf8');
}

/** @param {string} root @param {string} full @returns {string} */
function toPosixRel(root, full) {
  return path.relative(root, full).split(path.sep).join('/');
}
