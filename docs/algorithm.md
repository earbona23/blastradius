# How blastradius scores things

Two questions, one graph.

## The graph

blastradius reads every source file (never runs it), extracts its imports, and resolves
each to a file inside the project. That yields a directed **dependency graph**: an edge
`A → B` means "A imports B". Its reverse — `B → A`, "B is depended on by A" — is where the
value is, because reverse reachability from a node is exactly its **blast radius**: every
file that would feel a change to it.

External packages and `node:` builtins form no internal edge. Dynamic `import(expr)` and
`require(variable)` with non-literal arguments cannot be resolved by anyone statically;
they are counted and reported as blind spots rather than silently dropped.

## Criticality (the `criticality` command)

How catastrophic is changing this file? Two signals, because each is fooled alone:

1. **Reach mass** — the size of a file's reverse-reachable set, as a fraction of the
   project. The literal blast radius. But it counts a file behind two leaves the same as
   one behind two entry points.
2. **PageRank** on the *forward* graph — importance flows toward dependencies and
   accumulates on the most-depended-upon files, so a utility under the entry points
   outranks one under two leaves. This breaks ties reach mass can't.

Blast radius is heavy-tailed — a handful of files are depended on by nearly everything —
so reach mass is combined on a log scale, blended 65/35 with PageRank, and normalised to
0–100. Coverage does **not** affect criticality: criticality is position in the graph. It
affects *risk*, which is a different score.

## Risk (the `impact` command)

Given the files a diff touches, risk in 0–100 comes from four bounded factors, so none can
dominate and each is printed alongside the score:

| Factor | What it measures |
|---|---|
| **blast** | how much of the project is in the radius (log-scaled) |
| **critical** | the peak criticality among the changed files |
| **exposure** | the criticality-weighted size of the radius |
| **testgap** | the untested share of the change and its radius |

`risk = 100 × (0.30·blast + 0.28·critical + 0.20·exposure + 0.22·testgap)`, mapped to
low / moderate / high / critical. A large radius through well-tested code is routine; a
small one through critical, untested code is where regressions hide — and the test-gap
term makes the score say so.

## Coverage without running tests

Test files are found by name. A test file exercises every source file it can reach through
imports, so the union of forward-reachable sets from all test files is the set of files
under test. A file outside that union is a **test gap** — no test even loads it. This is a
reachability proxy, not line coverage: it proves a file *can* be exercised by a test, not
that its branches are asserted. But a file no test can reach is unambiguously untested,
which is the signal the risk score needs.

## Determinism

Same project in, same numbers out. PageRank uses a uniform start, fixed damping (0.85) and
a fixed iteration cap with dangling-mass redistribution; nothing in the analysis reads the
clock or a random source. That is what lets the CI gate be a stable check rather than a
flaky one, and it is pinned by `test/guard.test.js`.
