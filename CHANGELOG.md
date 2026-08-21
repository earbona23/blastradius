# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-20

First release.

### Added
- `criticality` — ranks every JS/TS file by how much of the codebase transitively depends
  on it, combining reverse-reachability mass with PageRank over the dependency graph.
- `impact` — the blast radius of a change: what transitively imports the files you touched,
  ranked by distance and criticality, with a 0–100 risk score that folds in test coverage.
- Graph-based coverage: a file no test can even reach is flagged as a test gap, no test run
  required.
- `--max-risk` CI gate (exit non-zero above a threshold) and `--since <ref>` git integration.
- Outputs: terminal, JSON, and Mermaid (free); HTML report and SARIF (Pro).
- Offline Ed25519 license activation (`activate`, `license`) — no telemetry, no phone-home.
- Zero runtime dependencies; the whole tool is Node built-ins.

### Notes
- Static analysis only: blastradius never executes the code it analyses. Enforced by
  `test/guard.test.js`, which also pins the zero-dependency and single-child-process
  (git, read-only) invariants.
