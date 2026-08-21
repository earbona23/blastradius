/**
 * Invariants that keep the tool honest and cheap to trust, enforced so they cannot rot:
 *  - it is STATIC: it never executes the code it analyses (no eval, no vm, no dynamic
 *    import of scanned files, no child process except git plumbing);
 *  - it is ZERO-dependency at runtime: src/ and bin/ import only node: builtins and the
 *    package's own files;
 *  - the analysis is DETERMINISTIC: same project in, same ranking out.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildGraph } from '../src/graph/build.js';
import { computeCriticality } from '../src/analysis/criticality.js';
import { extractImports } from '../src/graph/imports.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/');

function shipped(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (['node_modules', '.git', 'test', 'examples', 'scripts', '.secrets', 'docs'].includes(e)) continue;
    const p = join(dir, e).replace(/\\/g, '/');
    if (statSync(p).isDirectory()) shipped(p, acc);
    else if (p.endsWith('.js')) acc.push(p);
  }
  return acc;
}
const files = shipped(ROOT);
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('there are shipped source files to inspect', () => {
  assert.ok(files.length > 15);
});

test('the tool never executes the code it analyses', () => {
  for (const f of files) {
    const code = strip(readFileSync(f, 'utf8'));
    assert.doesNotMatch(code, /\beval\s*\(/, `${f}: no eval`);
    assert.doesNotMatch(code, /new Function\s*\(/, `${f}: no Function constructor`);
    assert.doesNotMatch(code, /node:vm|require\(['"]vm['"]\)/, `${f}: no vm`);
  }
});

test('the only child process is git (read-only plumbing)', () => {
  const spawners = files.filter((f) => /child_process/.test(strip(readFileSync(f, 'utf8'))));
  assert.deepEqual(
    spawners.map((f) => f.replace(ROOT + '/', '')).sort(),
    ['src/git.js'],
    'only git.js may spawn a process',
  );
  const git = readFileSync(join(ROOT, 'src/git.js'), 'utf8');
  // git.js must only invoke the 'git' binary, and only read-only subcommands.
  assert.doesNotMatch(strip(git), /execFile\(\s*(?!['"]git['"])/, 'git.js runs only the git binary');
  assert.doesNotMatch(git, /\b(commit|push|checkout|reset|clean|rm)\b.*execFile/s, 'no mutating git');
});

test('runtime code imports only node: builtins and own files (zero dependencies)', () => {
  // Dogfood the tool's own import extractor, which requires an import/export keyword and
  // so does not mistake prose like "comes from 'x'" for a dependency.
  for (const f of files) {
    const { specifiers } = extractImports(readFileSync(f, 'utf8'));
    for (const spec of specifiers) {
      const ok = spec.startsWith('node:') || spec.startsWith('.') || spec.startsWith('/');
      assert.ok(ok, `${f.replace(ROOT + '/', '')} imports third-party '${spec}' — must stay zero-dependency`);
    }
  }
});

test('criticality ranking is deterministic across runs', async () => {
  const fixture = join(ROOT, 'test', 'fixtures', 'project');
  const g1 = await buildGraph(fixture);
  const g2 = await buildGraph(fixture);
  const r1 = computeCriticality(g1).map((c) => `${c.file}:${c.score}`);
  const r2 = computeCriticality(g2).map((c) => `${c.file}:${c.score}`);
  assert.deepEqual(r1, r2);
});
