/**
 * Extracts the module specifiers a source file depends on.
 *
 * A lightweight static extractor, not a full parser. It removes comments first -- while
 * preserving string contents -- so a commented-out import or a URL in a comment never
 * becomes a false edge, then matches the four forms that account for essentially every
 * real dependency edge:
 *
 *   import ... from 'x'     export ... from 'x'     require('x')     import('x')
 *
 * A `require(variable)` or `import(expr)` whose argument is not a string literal cannot
 * be resolved statically by anyone; it is counted as `dynamicUnresolved` so the caller
 * can report the blind spot honestly instead of pretending the graph is complete.
 *
 * @module graph/imports
 */

/**
 * @typedef {Object} ExtractResult
 * @property {string[]} specifiers        Static string specifiers, de-duplicated.
 * @property {number} dynamicUnresolved   import()/require() calls with a non-literal argument.
 */

const FROM_RE = /\b(?:import|export)\b[\s\S]{0,400}?\bfrom\s*['"]([^'"\n]+)['"]/g;
const BARE_IMPORT_RE = /\bimport\s*['"]([^'"\n]+)['"]/g;
const CALL_RE = /\b(?:require|import)\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g;
const DYN_CALL_RE = /\b(?:require|import)\s*\(\s*(?!\s*['"])[^)\s]/g;

/**
 * @param {string} source
 * @returns {ExtractResult}
 */
export function extractImports(source) {
  const code = stripComments(source);
  const specifiers = new Set();

  for (const re of [FROM_RE, BARE_IMPORT_RE, CALL_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(code)) !== null) {
      const spec = m[1].trim();
      if (spec) specifiers.add(spec);
    }
  }

  DYN_CALL_RE.lastIndex = 0;
  let dynamicUnresolved = 0;
  let d;
  while ((d = DYN_CALL_RE.exec(code)) !== null) dynamicUnresolved++;

  return { specifiers: [...specifiers], dynamicUnresolved };
}

/**
 * Remove line and block comments while keeping the contents of strings and template
 * literals intact. A single pass tracks string state so that a `//` inside a string is
 * preserved and only real comments are dropped.
 *
 * Regex literals are not tracked; in the rare case one contains comment-like text it may
 * be trimmed, which cannot manufacture a false import and so is acceptable here.
 *
 * @param {string} src
 * @returns {string}
 */
export function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];

    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      out += c;
      i++;
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') {
          out += src[i] + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += src[i];
        i++;
      }
      if (i < n) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
