#!/usr/bin/env node
/**
 * Mints a signed blastradius license key. Owner-only: it needs the private signing key,
 * which never ships with the package. Not part of the published tool.
 *
 * Usage:
 *   BLASTRADIUS_SIGNING_KEY=./.secrets/license-signing-key.pem \
 *     node scripts/mint-license.js --sub "Acme Inc" --plan team --days 365
 *
 * Prints a key of the form BLASTRADIUS-<payload>.<signature> to stdout.
 */
import { readFileSync } from 'node:fs';
import { sign, createPrivateKey } from 'node:crypto';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const keyPath = process.env.BLASTRADIUS_SIGNING_KEY ?? './.secrets/license-signing-key.pem';
const sub = arg('sub', null);
const plan = arg('plan', 'pro');
const days = Number(arg('days', '0'));

if (!sub) {
  console.error('Usage: node scripts/mint-license.js --sub "<name/email>" [--plan pro|team] [--days N]');
  process.exit(2);
}

const privateKey = createPrivateKey(readFileSync(keyPath));
const now = Math.floor(Date.now() / 1000);
const payload = { sub, plan, iat: now };
if (days > 0) payload.exp = now + days * 86400;

const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8');
const signature = sign(null, payloadBytes, privateKey);
const key = `BLASTRADIUS-${payloadBytes.toString('base64url')}.${signature.toString('base64url')}`;

console.error(`Minted ${plan} license for "${sub}"${days > 0 ? `, expires in ${days} days` : ' (perpetual)'}:`);
console.log(key);
