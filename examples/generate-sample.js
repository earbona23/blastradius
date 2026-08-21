#!/usr/bin/env node
/**
 * Renders the sample HTML reports shown in the README, from synthetic data that mirrors
 * what a real run on a mid-size app produces. No project is scanned and nothing here is
 * real; the numbers are chosen to exercise the full range (a load-bearing core, a couple
 * of untested criticals, a contained change and a risky one).
 *
 * Usage: node examples/generate-sample.js [outDir]
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHtml } from '../src/report/html.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] || join(HERE, '..', 'docs', 'images');

const generatedAt = '2026-03-14 09:41 UTC';
const project = 'acme-storefront';
const stats = { files: 214, edges: 611, testFiles: 48, truncated: false };

const criticality = [
  { file: 'src/lib/http/client.ts', score: 98, dependents: 173, tested: true },
  { file: 'src/store/index.ts', score: 95, dependents: 158, tested: true },
  { file: 'src/lib/money.ts', score: 91, dependents: 96, tested: false },
  { file: 'src/lib/errors.ts', score: 84, dependents: 88, tested: true },
  { file: 'src/api/schema.ts', score: 79, dependents: 71, tested: true },
  { file: 'src/lib/date.ts', score: 72, dependents: 64, tested: false },
  { file: 'src/components/Button.tsx', score: 61, dependents: 44, tested: true },
  { file: 'src/hooks/useCart.ts', score: 58, dependents: 39, tested: true },
  { file: 'src/lib/format.ts', score: 47, dependents: 22, tested: true },
  { file: 'src/routes/checkout.tsx', score: 33, dependents: 9, tested: false },
  { file: 'src/routes/product.tsx', score: 28, dependents: 6, tested: true },
  { file: 'src/components/Footer.tsx', score: 12, dependents: 1, tested: true },
];

const impact = {
  changed: ['src/lib/money.ts', 'src/lib/date.ts'],
  changedUnknown: ['README.md'],
  risk: 71,
  verdict: 'high',
  factors: { blastRadius: 118, peakCriticality: 91, exposure: 74, testGapPercent: 38 },
  untestedTouched: ['src/lib/money.ts', 'src/lib/date.ts', 'src/routes/checkout.tsx'],
  impacted: [
    { file: 'src/store/cart.ts', distance: 1, criticality: 88, tested: true },
    { file: 'src/api/orders.ts', distance: 1, criticality: 76, tested: true },
    { file: 'src/routes/checkout.tsx', distance: 2, criticality: 33, tested: false },
    { file: 'src/components/PriceTag.tsx', distance: 2, criticality: 41, tested: true },
    { file: 'src/routes/product.tsx', distance: 3, criticality: 28, tested: true },
  ],
};

await mkdir(outDir, { recursive: true });
await writeFile(
  join(outDir, 'sample-criticality.html'),
  renderHtml({ kind: 'criticality', project, generatedAt, toolVersion: '1.0.0', payload: criticality, stats }),
);
await writeFile(
  join(outDir, 'sample-impact.html'),
  renderHtml({ kind: 'impact', project, generatedAt, toolVersion: '1.0.0', payload: impact, stats }),
);
console.log(`Wrote sample reports to ${outDir}`);
