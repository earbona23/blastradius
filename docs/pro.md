# blastradius Pro

**Everything that computes an answer is free** — the full criticality and impact analysis,
the terminal, JSON and Mermaid outputs, and the `--max-risk` CI gate. blastradius is
MIT-licensed and its whole engine is open. Pro exists so that teams who get ongoing value
can fund the maintenance, and it unlocks *additive* outputs, never the core result.

## What Pro unlocks

| Feature | Flag |
|---|---|
| Self-contained **HTML report** (criticality & impact, light/dark, printable) | `--format html` |
| **SARIF** export — blast-radius findings in GitHub's Security tab or any SARIF viewer | `--format sarif` |
| **Baseline comparison** — score a change against a stored baseline to catch regressions | `baseline` |

## How activation works

A license key is an Ed25519-signed token. Activation is **entirely offline** — the key is
verified locally against a public key embedded in the tool. There is no account, no
telemetry, and nothing ever leaves your machine.

```sh
blastradius activate BLASTRADIUS-xxxxx.yyyyy
blastradius license          # show what's active
```

The key can also be supplied per-run with the `BLASTRADIUS_LICENSE_KEY` environment
variable, which is convenient in CI secrets.

## Getting a license

Pro licensing is being set up. Until the storefront is live, sponsor the project (below) or
open an issue — the mechanism is built and ready.

## Just want to help?

- **GitHub Sponsors:** https://github.com/sponsors/earbona23
- **Patreon:** https://www.patreon.com/EduardArbona

Sponsoring is not required to use anything the tool computes. It keeps the tool maintained.
