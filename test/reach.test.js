/** Transitive reachability + PageRank, the algorithmic core. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reachWithDistance, reachableSet } from '../src/analysis/reach.js';
import { pagerank } from '../src/analysis/pagerank.js';

// reverse graph of the fixture: who imports X
const reverse = new Map([
  ['core', new Set(['util', 'b'])],
  ['util', new Set(['a', 'b'])],
  ['a', new Set(['entry', 'a.test'])],
  ['b', new Set(['entry'])],
  ['entry', new Set()],
  ['a.test', new Set()],
]);

test('reverse reachability from core is its full blast radius, with distances', () => {
  const dist = reachWithDistance(reverse, ['core']);
  assert.equal(dist.get('core'), 0);
  assert.equal(dist.get('util'), 1);
  assert.equal(dist.get('b'), 1);
  assert.equal(dist.get('a'), 2);
  assert.equal(dist.get('entry'), 2);
  assert.equal(dist.get('a.test'), 3);
  assert.equal(reachableSet(reverse, ['core']).size, 5);
});

test('a leaf has an empty blast radius', () => {
  assert.equal(reachableSet(reverse, ['entry']).size, 0);
});

// Forward graph (X imports Y): rank flows toward the most-depended-upon node.
const forward = new Map([
  ['core', new Set()],
  ['util', new Set(['core'])],
  ['a', new Set(['util'])],
  ['b', new Set(['util', 'core'])],
  ['entry', new Set(['a', 'b'])],
  ['a.test', new Set(['a'])],
]);

test('PageRank on the forward graph ranks the load-bearing node highest', () => {
  const nodes = [...forward.keys()];
  const pr = pagerank(nodes, forward);
  const ranked = [...pr.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  assert.equal(ranked[0], 'core', 'core carries the most transitive weight');
  const sum = [...pr.values()].reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-6, 'ranks form a probability distribution');
});

test('PageRank is deterministic', () => {
  const nodes = [...forward.keys()];
  assert.deepEqual([...pagerank(nodes, forward)], [...pagerank(nodes, forward)]);
});
