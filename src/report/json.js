/**
 * Machine-readable output for both commands, and the SARIF export (Pro) that drops
 * blast-radius findings straight into GitHub's Security tab or any SARIF viewer.
 *
 * @module report/json
 */

/**
 * @param {Object} data
 * @returns {string}
 */
export function renderJson(data) {
  return JSON.stringify(data, null, 2) + '\n';
}

/**
 * SARIF 2.1.0 for an impact report. Each untested file in the blast radius becomes a
 * result, so a CI security dashboard shows exactly where a change reaches unproven code.
 *
 * @param {import('../analysis/impact.js').ImpactReport} report
 * @param {Object} [meta]
 * @param {string} [meta.version]
 * @returns {string}
 */
export function renderSarif(report, meta = {}) {
  const rules = [
    {
      id: 'untested-in-blast-radius',
      name: 'UntestedInBlastRadius',
      shortDescription: { text: 'File in a change blast radius with no test reaching it' },
      helpUri: 'https://github.com/earbona23/blastradius#readme',
      defaultConfiguration: { level: 'warning' },
    },
    {
      id: 'high-risk-change',
      name: 'HighRiskChange',
      shortDescription: { text: 'Change with a high blast-radius risk score' },
      defaultConfiguration: { level: 'note' },
    },
  ];

  const results = report.untestedTouched.map((file) => ({
    ruleId: 'untested-in-blast-radius',
    level: 'warning',
    message: {
      text: `${file} is in the blast radius of this change and no test reaches it.`,
    },
    locations: [
      { physicalLocation: { artifactLocation: { uri: file }, region: { startLine: 1 } } },
    ],
  }));

  if (report.verdict === 'high' || report.verdict === 'critical') {
    results.push({
      ruleId: 'high-risk-change',
      level: report.verdict === 'critical' ? 'error' : 'warning',
      message: {
        text: `This change has a ${report.verdict} blast-radius risk score of ${report.risk}/100 across ${report.factors.blastRadius} impacted file(s).`,
      },
      locations: report.changed.slice(0, 1).map((file) => ({
        physicalLocation: { artifactLocation: { uri: file }, region: { startLine: 1 } },
      })),
    });
  }

  return (
    JSON.stringify(
      {
        $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
        version: '2.1.0',
        runs: [
          {
            tool: {
              driver: {
                name: 'blastradius',
                informationUri: 'https://github.com/earbona23/blastradius',
                version: meta.version ?? '1.0.0',
                rules,
              },
            },
            results,
          },
        ],
      },
      null,
      2,
    ) + '\n'
  );
}
