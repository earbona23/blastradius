/**
 * The license activation layer. Verified with an ephemeral keypair injected as the
 * public key, so the real signing key is never needed to test the mechanism.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyLicenseKey } from '../src/license/verify.js';

function mint(payload, privateKey) {
  const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = sign(null, bytes, privateKey);
  return `BLASTRADIUS-${bytes.toString('base64url')}.${sig.toString('base64url')}`;
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const pub = publicKey.export({ type: 'spki', format: 'pem' });

test('a properly signed key verifies', () => {
  const key = mint({ sub: 'Acme', plan: 'team', iat: 1000 }, privateKey);
  const r = verifyLicenseKey(key, { publicKeyPem: pub, now: 2000 });
  assert.equal(r.valid, true);
  assert.equal(r.payload.plan, 'team');
});

test('an expired key is rejected', () => {
  const key = mint({ sub: 'Acme', plan: 'pro', iat: 1000, exp: 1500 }, privateKey);
  const r = verifyLicenseKey(key, { publicKeyPem: pub, now: 2000 });
  assert.equal(r.valid, false);
  assert.match(r.reason, /expired/i);
});

test('a key signed by a different key does not verify', () => {
  const other = generateKeyPairSync('ed25519');
  const key = mint({ sub: 'Attacker', plan: 'team', iat: 1000 }, other.privateKey);
  const r = verifyLicenseKey(key, { publicKeyPem: pub, now: 2000 });
  assert.equal(r.valid, false);
  assert.match(r.reason, /signature/i);
});

test('a tampered payload invalidates the signature', () => {
  const key = mint({ sub: 'Acme', plan: 'free', iat: 1000 }, privateKey);
  const [head, sig] = key.split('.');
  const forgedPayload = Buffer.from(JSON.stringify({ sub: 'Acme', plan: 'team', iat: 1000 })).toString('base64url');
  const forged = `${head.split('-')[0]}-${forgedPayload}.${sig}`;
  const r = verifyLicenseKey(forged, { publicKeyPem: pub, now: 2000 });
  assert.equal(r.valid, false);
});

test('garbage and non-license strings are rejected cleanly', () => {
  for (const junk of ['', 'hello', 'BLASTRADIUS-nope', 'BLASTRADIUS-a.b.c']) {
    const r = verifyLicenseKey(junk, { publicKeyPem: pub });
    assert.equal(r.valid, false);
    assert.ok(typeof r.reason === 'string');
  }
});

test('the embedded default public key is a real Ed25519 SPKI key', async () => {
  const { LICENSE_PUBLIC_KEY_PEM } = await import('../src/license/keys.js');
  assert.match(LICENSE_PUBLIC_KEY_PEM, /BEGIN PUBLIC KEY/);
  // A key not signed by the real private key must fail against the embedded default.
  const key = mint({ sub: 'x', plan: 'pro', iat: 1 }, privateKey);
  assert.equal(verifyLicenseKey(key).valid, false, 'ephemeral key must not pass the embedded key');
});
