/**
 * Terminal output for both commands. It leads with the number that matters -- the risk
 * verdict for a change, the top of the criticality ranking for a survey -- and shows the
 * factors behind the score so nobody has to take it on faith.
 *
 * @module report/terminal
 */

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', gray: '\x1b[90m',
};

const VERDICT_COLOR = { low: C.green, moderate: C.yellow, high: C.yellow, critical: C.red };

function paint(on) {
  if (on) return C;
  const b = {}; for (const k of Object.keys(C)) b[k] = ''; return b;
}

/**
 * @param {import('../analysis/criticality.js').CriticalityEntry[]} entries
 * @param {Object} [options]
 * @param {number} [options.top]
 * @param {boolean} [options.color]
 * @returns {string}
 */
export function renderCriticality(entries, options = {}) {
  const c = paint(options.color !== false);
  const top = options.top ?? 20;
  const shown = entries.slice(0, top);
  const lines = [''];
  lines.push(`${c.bold}Criticality${c.reset} ${c.dim}· how much of the codebase leans on each file${c.reset}`);
  lines.push('');
  const width = Math.min(60, Math.max(...shown.map((e) => e.file.length), 4));
  for (const e of shown) {
    const bar = scoreBar(e.score, c);
    const testFlag = e.tested ? '' : `  ${c.red}⚠ no test reaches it${c.reset}`;
    lines.push(
      `  ${String(e.score).padStart(3)}  ${bar}  ${c.bold}${e.file.padEnd(width)}${c.reset}` +
        `  ${c.dim}${e.dependents} dependents${c.reset}${testFlag}`,
    );
  }
  if (entries.length > top) lines.push(`  ${c.dim}… and ${entries.length - top} more${c.reset}`);
  lines.push('');
  return lines.join('\n');
}

/**
 * @param {import('../analysis/impact.js').ImpactReport} report
 * @param {Object} [options]
 * @param {number} [options.top]
 * @param {boolean} [options.color]
 * @returns {string}
 */
export function renderImpact(report, options = {}) {
  const c = paint(options.color !== false);
  const top = options.top ?? 25;
  const vc = VERDICT_COLOR[report.verdict] ?? c.reset;
  const lines = [''];

  lines.push(`${c.bold}Blast radius${c.reset} ${c.dim}· impact of ${report.changed.length} changed file(s)${c.reset}`);
  lines.push('');
  lines.push(`  Risk: ${c.bold}${vc}${report.risk}/100 (${report.verdict})${c.reset}`);
  const f = report.factors;
  lines.push(
    `  ${c.dim}blast radius ${f.blastRadius} files · peak criticality ${f.peakCriticality} · ` +
      `exposure ${f.exposure} · test gap ${f.testGapPercent}%${c.reset}`,
  );
  lines.push('');

  if (report.changed.length === 0) {
    lines.push(`  ${c.yellow}No changed files were found in the dependency graph.${c.reset}`);
    if (report.changedUnknown.length) {
      lines.push(`  ${c.dim}${report.changedUnknown.length} changed path(s) are outside the analysed sources.${c.reset}`);
    }
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`  ${c.bold}Changed${c.reset}`);
  for (const file of report.changed) {
    const untested = report.untestedTouched.includes(file) ? `  ${c.red}⚠ untested${c.reset}` : '';
    lines.push(`    ${c.cyan}●${c.reset} ${file}${untested}`);
  }
  lines.push('');

  if (report.impacted.length === 0) {
    lines.push(`  ${c.green}Nothing else imports the changed files — the radius is contained.${c.reset}`);
  } else {
    lines.push(`  ${c.bold}Impacted${c.reset} ${c.dim}(ranked by closeness, then criticality)${c.reset}`);
    for (const i of report.impacted.slice(0, top)) {
      const untested = i.tested ? '' : `  ${c.red}⚠ no test${c.reset}`;
      lines.push(
        `    ${c.dim}${('+' + i.distance).padStart(3)}${c.reset}  ${critTag(i.criticality, c)} ${i.file}${untested}`,
      );
    }
    if (report.impacted.length > top) {
      lines.push(`    ${c.dim}… and ${report.impacted.length - top} more${c.reset}`);
    }
  }

  if (report.untestedTouched.length) {
    lines.push('');
    lines.push(`  ${c.red}${report.untestedTouched.length} file(s) in the blast radius have no test reaching them.${c.reset}`);
  }
  lines.push('');
  return lines.join('\n');
}

function scoreBar(score, c) {
  const width = 12;
  const filled = Math.round((score / 100) * width);
  const color = score >= 70 ? c.red : score >= 40 ? c.yellow : c.green;
  return `${color}${'█'.repeat(filled)}${c.gray}${'░'.repeat(width - filled)}${c.reset}`;
}
function critTag(score, c) {
  const color = score >= 70 ? c.red : score >= 40 ? c.yellow : c.gray;
  return `${color}c${String(score).padStart(3)}${c.reset}`;
}
