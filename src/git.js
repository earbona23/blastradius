/**
 * Reads the set of changed files from git, so `blastradius impact --since main` works
 * without the caller listing files by hand. Uses the git plumbing directly; if git is
 * absent or the path is not a repository, it fails with a clear message rather than a
 * stack trace, and the caller can still pass explicit files instead.
 *
 * @module git
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const run = promisify(execFile);

/**
 * Changed files relative to a ref (default: the merge-base with the ref), as
 * project-relative POSIX paths. Includes staged, unstaged and committed-since changes.
 *
 * @param {string} root  Absolute project root (must be inside the repo).
 * @param {Object} [options]
 * @param {string} [options.since]  A ref/branch/commit. Default 'HEAD' (working changes).
 * @returns {Promise<string[]>}
 */
export async function changedFiles(root, options = {}) {
  const since = options.since ?? 'HEAD';
  await assertGitRepo(root);

  const args =
    since === 'HEAD'
      ? ['diff', '--name-only', 'HEAD']
      : ['diff', '--name-only', `${since}...HEAD`];

  const [committed, working] = await Promise.all([
    gitLines(root, args),
    gitLines(root, ['diff', '--name-only', 'HEAD']),
    // working-tree changes are always included so uncommitted edits count too
  ]);

  const gitRoot = (await gitLines(root, ['rev-parse', '--show-toplevel']))[0];
  const set = new Set([...committed, ...working]);
  return [...set]
    .filter(Boolean)
    .map((p) => toProjectRel(gitRoot, root, p))
    .filter((p) => p !== null);
}

async function assertGitRepo(root) {
  try {
    await run('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root });
  } catch {
    throw new Error(
      `Not a git repository (or git is not installed): ${root}. ` +
        'Pass changed files explicitly instead of --since.',
    );
  }
}

async function gitLines(root, args) {
  try {
    const { stdout } = await run('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    return stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * git reports paths relative to the repo root; the graph is keyed relative to the
 * analysed project root, which may be a subdirectory. Translate between them.
 */
function toProjectRel(gitRoot, projectRoot, repoRelPath) {
  const abs = path.resolve(gitRoot, repoRelPath);
  const rel = path.relative(projectRoot, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}
