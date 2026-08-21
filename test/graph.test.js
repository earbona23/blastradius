/**
 * The dependency graph: extraction, resolution, and the forward/reverse edges the whole
 * tool is built on. Verified against a fixture project with a hand-known graph.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildGraph, isTestFile } from '../src/graph/build.js';
import { extractImports, stripComments } from '../src/graph/imports.js';
import { resolveSpecifier } from '../src/graph/resolve.js';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'project');
let graph;
test.before(async () => { graph = await buildGraph(FIXTURE); });

test('imports are extracted; comments excluded, dynamic counted', () => {
  const src = `
    import a from './a.js';
    export { b } from './b';
    const c = require('./c');
    const d = await import('./d.js');
    // import z from './commented';
    const e = require(dynamicName);
  `;
  const r = extractImports(src);
  assert.ok(r.specifiers.includes('./a.js'));
  assert.ok(r.specifiers.includes('./b'));
  assert.ok(r.specifiers.includes('./c'));
  assert.ok(r.specifiers.includes('./d.js'));
  assert.ok(!r.specifiers.includes('./commented'), 'commented import must be ignored');
  assert.equal(r.dynamicUnresolved, 1);
});

test('stripComments preserves string contents but removes comments', () => {
  const out = stripComments(`const u = "http://x"; // trailing\n/* block */ const v = 1;`);
  assert.match(out, /http:\/\/x/);
  assert.doesNotMatch(out, /trailing/);
  assert.doesNotMatch(out, /block/);
});

test('specifiers resolve with extension and index inference', () => {
  const files = new Set(['src/a.js', 'src/util.js', 'src/dir/index.js']);
  assert.equal(resolveSpecifier('./util', 'src/a.js', files).target, 'src/util.js');
  assert.equal(resolveSpecifier('./util.js', 'src/a.js', files).target, 'src/util.js');
  assert.equal(resolveSpecifier('./dir', 'src/a.js', files).target, 'src/dir/index.js');
  assert.equal(resolveSpecifier('react', 'src/a.js', files).external, true);
  assert.equal(resolveSpecifier('react', 'src/a.js', files).target, null);
  assert.equal(resolveSpecifier('node:fs', 'src/a.js', files).external, true);
});

test('an import.js -> source.ts rewrite is resolved', () => {
  const files = new Set(['src/x.ts']);
  assert.equal(resolveSpecifier('./x.js', 'src/a.ts', files).target, 'src/x.ts');
});

test('aliases rewrite bare-looking specifiers into the project', () => {
  const files = new Set(['src/lib/x.js']);
  const r = resolveSpecifier('@/lib/x', 'app/y.js', files, { aliases: { '@/': 'src/' } });
  assert.equal(r.target, 'src/lib/x.js');
});

test('the fixture graph has the expected forward edges', () => {
  const fwd = (f) => [...(graph.forward.get(f) ?? [])].sort();
  assert.deepEqual(fwd('src/util.js'), ['src/core.js']);
  assert.deepEqual(fwd('src/a.js'), ['src/util.js']);
  assert.deepEqual(fwd('src/b.js'), ['src/core.js', 'src/util.js']);
  assert.deepEqual(fwd('src/entry.js'), ['src/a.js', 'src/b.js']);
  assert.deepEqual(fwd('src/leaf.js'), []);
});

test('reverse edges are the inverse of forward', () => {
  const rev = (f) => [...(graph.reverse.get(f) ?? [])].sort();
  assert.deepEqual(rev('src/core.js'), ['src/b.js', 'src/util.js']);
  assert.deepEqual(rev('src/util.js'), ['src/a.js', 'src/b.js']);
  assert.deepEqual(rev('src/entry.js'), []);
});

test('a dangling relative import is recorded, not silently dropped', () => {
  assert.ok(graph.unresolved.has('src/dangling.js'));
  assert.ok(graph.dynamic.has('src/dynamic.js'));
});

test('test files are detected by name', () => {
  assert.ok(isTestFile('test/a.test.js'));
  assert.ok(isTestFile('src/__tests__/x.js'));
  assert.ok(isTestFile('foo.spec.ts'));
  assert.ok(!isTestFile('src/core.js'));
  assert.ok(graph.testFiles.has('test/a.test.js'));
});
