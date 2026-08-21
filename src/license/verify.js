/**
 * Offline verification of a license key.
 *
 * A key is `BLASTRADIUS-<base64url(payload)>.<base64url(signature)>`, where the payload
 * is JSON and the signature is Ed25519 over the payload bytes. Verification is entirely
 * local: no network, no telemetry, nothing leaves the machine. The tool can confirm a
 * key was issued by the owner and has not expired, and that is all it needs.
 *
 * @module license/verify
 */

import { verify as edVerify, createPublicKey } from 'node:crypto';
import { LICENSE_PUBLIC_KEY_PEM } from './keys.js';

const PREFIX = 'BLASTRADIUS-';

/**
 * @typedef {Object} LicensePayload
 * @property {string} sub       Who the license is for (name or email).
 * @property {string} plan      'pro' | 'team' | ...
 * @property {number} iat       Issued-at, epoch seconds.
 * @property {number} [exp]     Expiry, epoch seconds. Omitted = perpetual.
 * @property {string[]} [features]
 */

/**
 * @typedef {Object} VerifyResult
 * @property {boolean} valid
 * @property {LicensePayload | null} payload
 * @property {string | null} reason
 */

/**
 * @param {string} key
 * @param {Object} [options]
 * @param {string} [options.publicKeyPem]  Override, for tests.
 * @param {number} [options.now]           Epoch seconds, for deterministic tests.
 * @returns {VerifyResult}
 */
export function verifyLicenseKey(key, options = {}) {
  if (typeof key !== 'string' || !key.startsWith(PREFIX)) {
    return fail('The key is not a blastradius license key.');
  }
  const body = key.slice(PREFIX.length);
  const dot = body.indexOf('.');
  if (dot === -1) return fail('The key is malformed (missing signature).');

  const payloadB64 = body.slice(0, dot);
  const sigB64 = body.slice(dot + 1);

  let payloadBytes;
  let signature;
  try {
    payloadBytes = Buffer.from(payloadB64, 'base64url');
    signature = Buffer.from(sigB64, 'base64url');
  } catch {
    return fail('The key is not valid base64url.');
  }

  let publicKey;
  try {
    publicKey = createPublicKey(options.publicKeyPem ?? LICENSE_PUBLIC_KEY_PEM);
  } catch {
    return fail('The embedded public key could not be loaded.');
  }

  let ok = false;
  try {
    ok = edVerify(null, payloadBytes, publicKey, signature);
  } catch {
    ok = false;
  }
  if (!ok) return fail('The signature does not verify. This key was not issued for blastradius.');

  let payload;
  try {
    payload = JSON.parse(payloadBytes.toString('utf8'));
  } catch {
    return fail('The signed payload is not valid JSON.');
  }

  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && now > payload.exp) {
    return { valid: false, payload, reason: 'The license expired.' };
  }

  return { valid: true, payload, reason: null };
}

/** @param {string} reason @returns {VerifyResult} */
function fail(reason) {
  return { valid: false, payload: null, reason };
}
