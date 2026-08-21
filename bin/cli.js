#!/usr/bin/env node
/**
 * blastradius command-line interface.
 *
 *   blastradius criticality [path]      Rank files by how catastrophic changing them is
 *   blastradius impact [path]           Blast radius of a change (--since <ref> or --files)
 *   blastradius graph [path]            Export the dependency graph as Mermaid
 *   blastradius activate <key>          Activate a Pro license (offline)
 *   blastradius license                 Show the current entitlement
 *
 * Free: all analysis, terminal + JSON + Mermaid, the CI risk gate.
 * Pro (a license unlocks): --format html, --format sarif, and baseline comparison.
 *
 * @module bin/cli
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { survey, impact } from '../src/index.js';
import { renderCriticality, renderImpact } from '../src/report/terminal.js';
import { renderJson, renderSarif } from '../src/report/json.js';
import { renderMermaid } from '../src/report/mermaid.js';
import { renderHtml } from '../src/report/html.js';
import { entitlement, activate } from '../src/license/store.js';
import { PRO_FEATURES } from '../src/license/keys.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

async function version() {
  try {
    return JSON.parse(await readFile(path.join(HERE, '..', 'package.json'), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
}

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) {
      const k = t.slice(2);
      if (k.startsWith('no-')) a[k.slice(3)] = false;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) a[k] = argv[++i];
      else a[k] = true;
    } else a._.push(t);
  }
  return a;
}

const HELP = `blastradius — change-impact analysis for JavaScript & TypeScript

USAGE
  blastradius criticality [path]   Rank files by how catastrophic changing them is
  blastradius impact [path]        Blast radius of a change
  blastradius graph [path]         Export the dependency graph as a Mermaid diagram
  blastradius activate <key>       Activate a Pro license (verified offline)
  blastradius license              Show the current entitlement

IMPACT OPTIONS
  --since <ref>        Changed files come from 'git diff <ref>...HEAD' + working tree
  --files <a,b,c>      Changed files listed explicitly (project-relative)
  --max-risk <0-100>   Exit non-zero if the risk score exceeds this (CI gate)

COMMON OPTIONS
  --format <fmt>       terminal (default), json, mermaid; html/sarif need a Pro license
  --out <file>         Write the chosen format to a file instead of stdout
  --top <n>            How many rows to show (default 20/25)
  --alias <k=v,...>    Path aliases, e.g. --alias @/=src/
  --no-color

Free: every analysis, terminal/JSON/Mermaid, and the CI risk gate.
Pro: html and sarif reports, and baseline comparison — https://github.com/earbona23/blastradius#pro
Sponsor the project: https://github.com/sponsors/earbona23`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];

  if (args.help || args.h || cmd === 'help' || !cmd) return void console.log(HELP);
  if (args.version || cmd === 'version') return void console.log(await version());
  if (cmd === 'activate') return cmdActivate(args);
  if (cmd === 'license') return cmdLicense();
  if (cmd === 'criticality' || cmd === 'crit') return cmdCriticality(args);
  if (cmd === 'impact') return cmdImpact(args);
  if (cmd === 'graph') return cmdGraph(args);
  console.error(`Unknown command '${cmd}'. Run 'blastradius --help'.`);
  return 2;
}

function rootFrom(args) {
  return path.resolve(args._[1] ?? '.');
}
/** @param {any} args @returns {Record<string, string> | undefined} */
function aliases(args) {
  if (typeof args.alias !== 'string') return undefined;
  /** @type {Record<string, string>} */
  const map = {};
  for (const pair of args.alias.split(',')) {
    const [k, v] = pair.split('=');
    if (k && v) map[k.trim()] = v.trim();
  }
  return map;
}

async function requirePro(feature) {
  const ent = await entitlement();
  if (ent.pro && ent.features.includes(feature)) return true;
  process.stderr.write(
    `\nThe '${feature}' output needs a blastradius Pro license.\n` +
      `  Activate one:  blastradius activate <key>\n` +
      `  Get one / sponsor:  https://github.com/earbona23/blastradius#pro\n` +
      `Every analysis, plus terminal/JSON/Mermaid and the CI gate, is free.\n`,
  );
  return false;
}

async function cmdCriticality(args) {
  const root = rootFrom(args);
  const { graph, criticality } = await survey(root, { aliases: aliases(args) });
  const stats = graphStats(graph);
  const fmt = args.format ?? 'terminal';

  if (fmt === 'json') return emit(args, renderJson({ project: path.basename(root), stats, criticality }));
  if (fmt === 'html') {
    if (!(await requirePro('html'))) return 3;
    return emit(args, renderHtml({ kind: 'criticality', project: path.basename(root), generatedAt: nowIso(), toolVersion: await version(), payload: criticality, stats }));
  }
  if (fmt === 'mermaid') return emit(args, renderMermaid(graph));
  process.stdout.write(renderCriticality(criticality, { color: color(args), top: num(args.top) }));
  reportBlindSpots(graph);
  return 0;
}

async function cmdImpact(args) {
  const root = rootFrom(args);
  const files = typeof args.files === 'string' ? args.files.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
  const { graph, report } = await impact(root, { aliases: aliases(args), since: files ? undefined : args.since, files });
  const stats = graphStats(graph);
  const fmt = args.format ?? 'terminal';

  if (fmt === 'json') emit(args, renderJson({ project: path.basename(root), stats, impact: report }));
  else if (fmt === 'sarif') {
    if (!(await requirePro('sarif'))) return 3;
    emit(args, renderSarif(report, { version: await version() }));
  } else if (fmt === 'html') {
    if (!(await requirePro('html'))) return 3;
    emit(args, renderHtml({ kind: 'impact', project: path.basename(root), generatedAt: nowIso(), toolVersion: await version(), payload: report, stats }));
  } else {
    process.stdout.write(renderImpact(report, { color: color(args), top: num(args.top) }));
    reportBlindSpots(graph);
  }

  if (args['max-risk'] !== undefined) {
    const max = Number(args['max-risk']);
    if (report.risk > max) {
      process.stderr.write(`\nGate failed: risk ${report.risk} exceeds --max-risk ${max}.\n`);
      return 1;
    }
    process.stderr.write(`\nGate passed: risk ${report.risk} is within --max-risk ${max}.\n`);
  }
  return 0;
}

async function cmdGraph(args) {
  const root = rootFrom(args);
  const { graph } = await survey(root, { aliases: aliases(args) });
  return emit(args, renderMermaid(graph, { maxNodes: num(args.top) ?? 150 }));
}

async function cmdActivate(args) {
  const key = args._[1];
  if (!key) {
    process.stderr.write('Usage: blastradius activate <license-key>\n');
    return 2;
  }
  try {
    const payload = await activate(key);
    process.stdout.write(`Activated ${payload.plan} license for ${payload.sub}. Thank you for supporting blastradius.\n`);
    return 0;
  } catch (e) {
    process.stderr.write(`Activation failed: ${e.message}\n`);
    return 1;
  }
}

async function cmdLicense() {
  const ent = await entitlement();
  if (ent.pro) {
    process.stdout.write(`Pro (${ent.plan}) — ${ent.sub}\nUnlocked: ${ent.features.join(', ')}\n`);
  } else {
    process.stdout.write(
      `Free tier. ${ent.reason ?? ''}\n` +
        `Pro unlocks: ${PRO_FEATURES.join(', ')} — https://github.com/earbona23/blastradius#pro\n`,
    );
  }
  return 0;
}

function graphStats(graph) {
  let edges = 0;
  for (const set of graph.forward.values()) edges += set.size;
  return { files: graph.files.length, edges, testFiles: graph.testFiles.size, truncated: graph.truncated };
}
function reportBlindSpots(graph) {
  const dyn = [...graph.dynamic.values()].reduce((a, b) => a + b, 0);
  const unres = [...graph.unresolved.values()].reduce((a, b) => a + b.length, 0);
  if (dyn || unres || graph.truncated) {
    const parts = [];
    if (dyn) parts.push(`${dyn} dynamic import(s) could not be resolved statically`);
    if (unres) parts.push(`${unres} relative import(s) resolved to nothing`);
    if (graph.truncated) parts.push('the file scan was truncated by the safety cap');
    process.stderr.write(`  note: ${parts.join('; ')}.\n`);
  }
}
async function emit(args, text) {
  if (typeof args.out === 'string') {
    await mkdir(path.dirname(path.resolve(args.out)), { recursive: true }).catch(() => {});
    await writeFile(args.out, text);
    process.stderr.write(`wrote ${args.out}\n`);
  } else {
    process.stdout.write(text.endsWith('\n') ? text : text + '\n');
  }
  return 0;
}
function color(args) {
  return args.color !== false && process.stdout.isTTY;
}
function num(v) {
  return v !== undefined ? Number(v) : undefined;
}
function nowIso() {
  return new Date().toISOString().replace('T', ' ').replace(/\..+/, ' UTC');
}

main()
  .then((code) => process.exit(code ?? 0))
  .catch((err) => {
    process.stderr.write(`\nerror: ${err && err.message ? err.message : err}\n`);
    process.exit(2);
  });
