# Contributing

Contributions welcome. A few invariants are load-bearing and enforced by
`test/guard.test.js` — a change that needs to weaken that test is out of scope:

- **Static only.** blastradius must never execute the code it analyses: no `eval`, no
  `Function`, no `vm`, no dynamic import of scanned files. It reads source as text.
- **Zero runtime dependencies.** `src/` and `bin/` import only `node:` builtins and the
  package's own files. The whole point is a tool you can audit and trust.
- **One child process, read-only.** Only `src/git.js` may spawn, only the `git` binary,
  only read-only subcommands.
- **Deterministic.** Same project in, same ranking out. PageRank uses fixed damping and a
  fixed iteration cap; no wall-clock or randomness in the analysis.

## Adding analysis

The collection (`src/graph/`) and the algorithms (`src/analysis/`) are separate, and the
algorithms are pure over the graph. Add tests to `test/` against the fixture project in
`test/fixtures/project`, whose graph is documented in `test/graph.test.js`. New tests go
in flat `test/*.test.js` files (the runner ignores `test/fixtures`).

## Before a pull request

```sh
npm test           # node --test test/*.test.js
npm run typecheck  # tsc --checkJs
```

Both must pass on Node 18, 20 and 22. Never commit the license signing key or real report
output.
