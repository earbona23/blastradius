/**
 * The embedded Ed25519 public key that license keys are verified against.
 *
 * This is public by design — it can only *verify* a signature, never *create* one. The
 * matching private key lives with the project owner and never ships. Anyone can read,
 * fork and run every feature of blastradius; a license key only flips on the additive
 * Pro outputs (see docs/pro.md). The point of signing is not to lock the tool down but
 * to let the owner issue keys that the tool can trust offline, with no phone-home.
 *
 * @module license/keys
 */

export const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAT1g2B4WXI/hBzR3eRW/mIKJBpyS9BiSthmw3olWjoAI=
-----END PUBLIC KEY-----`;

/** Feature flags a license may unlock. Kept small and additive. */
export const PRO_FEATURES = Object.freeze(['html', 'sarif', 'baseline']);
