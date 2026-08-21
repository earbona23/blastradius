/** @module util/num */

/** @param {number} n @param {number} lo @param {number} hi @returns {number} */
export function clamp(n, lo, hi) {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}
