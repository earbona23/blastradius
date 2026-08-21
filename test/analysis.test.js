/**
 * Criticality, coverage-by-graph, and impact — end to end over the fixture project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildGraph } from '../src/graph/build.js';
import { computeCriticality } from '../src/analysis/criticality.js';
import { coverageByGraph } from '../src/analysis/tests.js';
import { analyzeImpact } from '../src/analysis/impact.js';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'project');
let graph, coverage, criticality;
test.before(async () => {
  graph = await buildGraph(FIXTURE);
  coverage = coverageByGraph(graph);
  criticality = computeCriticality(graph, { coverage });
});

test('core is the most critical file; a leaf is near the bottom', () => {
  assert.equal(criticality[0].file, 'src/core.js');
  const leaf = criticality.find((c) => c.file === 'src/leaf.js');
  const core = criticality[0];
  assert.ok(core.score > leaf.score);
  assert.equal(core.dependents, 5, 'core reverse-reaches util,a,b,entry,a.test');
});

test('coverage by graph: a.js/util/core are covered; b is a test gap', () => {
  assert.ok(coverage.covered.has('src/a.js'));
  assert.ok(coverage.covered.has('src/util.js'));
  assert.ok(coverage.covered.has('src/core.js'));
  assert.ok(coverage.gaps.has('src/b.js'), 'b is imported only by entry, no test reaches it');
  assert.ok(coverage.gaps.has('src/leaf.js'));
});

test('criticality carries the tested flag from coverage', () => {
  const b = criticality.find((c) => c.file === 'src/b.js');
  assert.equal(b.tested, false);
  const core = criticality.find((c) => c.file === 'src/core.js');
  assert.equal(core.tested, true);
});

test('changing core impacts its whole reverse-reachable set, ranked by distance', () => {
  const r = analyzeImpact(graph, ['src/core.js'], criticality, coverage);
  const impactedFiles = r.impacted.map((i) => i.file);
  assert.deepEqual(
    [...impactedFiles].sort(),
    ['src/a.js', 'src/b.js', 'src/entry.js', 'src/util.js', 'test/a.test.js'].sort(),
  );
  const util = r.impacted.find((i) => i.file === 'src/util.js');
  const entry = r.impacted.find((i) => i.file === 'src/entry.js');
  assert.equal(util.distance, 1);
  assert.ok(entry.distance >= 2, 'entry is farther than util');
});

test('changing a leaf has an empty blast radius and low risk', () => {
  const r = analyzeImpact(graph, ['src/leaf.js'], criticality, coverage);
  assert.equal(r.impacted.length, 0);
  assert.equal(r.verdict, 'low');
});

test('a change to untested critical code scores riskier than to a leaf', () => {
  const risky = analyzeImpact(graph, ['src/b.js'], criticality, coverage); // b is untested
  const safe = analyzeImpact(graph, ['src/leaf.js'], criticality, coverage);
  assert.ok(risky.risk > safe.risk);
  assert.ok(risky.untestedTouched.includes('src/b.js'));
});

test('a changed path outside the graph is reported, not silently ignored', () => {
  const r = analyzeImpact(graph, ['README.md', 'src/core.js'], criticality, coverage);
  assert.ok(r.changedUnknown.includes('README.md'));
  assert.ok(r.changed.includes('src/core.js'));
});
