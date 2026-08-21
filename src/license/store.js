/**
 * Where an activated license lives on disk, and the single question the rest of the tool
 * asks: is this a Pro session?
 *
 * The license is stored in the user's config directory (XDG on Linux, %APPDATA% on
 * Windows, ~/Library on macOS). Activation writes it; every run reads it and verifies it
 * afresh, so an expired or tampered file simply stops being Pro. No network, ever.
 *
 * @module license/store
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import path from 'node:path';
import { verifyLicenseKey } from './verify.js';
import { PRO_FEATURES } from './keys.js';

/** @returns {string} Absolute path to the license file. */
export function licensePath() {
  const home = homedir();
  let base;
  if (process.env.BLASTRADIUS_CONFIG_DIR) base = process.env.BLASTRADIUS_CONFIG_DIR;
  else if (platform() === 'win32') base = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');
  else if (platform() === 'darwin') base = path.join(home, 'Library', 'Application Support');
  else base = process.env.XDG_CONFIG_HOME ?? path.join(home, '.config');
  return path.join(base, 'blastradius', 'license.json');
}

/**
 * Persist a verified license key. Rejects an invalid key rather than storing junk.
 * @param {string} key
 * @returns {Promise<import('./verify.js').LicensePayload>}
 */
export async function activate(key) {
  const result = verifyLicenseKey(key);
  if (!result.valid) {
    throw new Error(result.reason ?? 'Invalid license key.');
  }
  const file = licensePath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ key }, null, 2) + '\n', { mode: 0o600 });
  return /** @type {import('./verify.js').LicensePayload} */ (result.payload);
}

/**
 * The current entitlement, re-verified from disk on every call.
 * @param {Object} [options]
 * @param {string} [options.key]  Use this key instead of the stored one (e.g. env var).
 * @returns {Promise<{ pro: boolean, plan: string | null, features: string[], sub: string | null, reason: string | null }>}
 */
export async function entitlement(options = {}) {
  let key = options.key ?? process.env.BLASTRADIUS_LICENSE_KEY ?? null;
  if (!key) {
    try {
      const raw = await readFile(licensePath(), 'utf8');
      key = JSON.parse(raw).key;
    } catch {
      return { pro: false, plan: null, features: [], sub: null, reason: 'No license activated.' };
    }
  }
  const result = verifyLicenseKey(key);
  if (!result.valid) {
    return { pro: false, plan: null, features: [], sub: null, reason: result.reason };
  }
  const payload = /** @type {import('./verify.js').LicensePayload} */ (result.payload);
  const features = payload.features && payload.features.length ? payload.features : [...PRO_FEATURES];
  return { pro: true, plan: payload.plan ?? 'pro', features, sub: payload.sub ?? null, reason: null };
}
