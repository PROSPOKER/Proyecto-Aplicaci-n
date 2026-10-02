/* Merge staged runs; later reports replace earlier outcomes for the same check. */
const fs = require('node:fs');
const inputs = process.argv.slice(2);
if (!inputs.length) throw Error('Pass result JSON paths in chronological order');
const checks = new Map();
for (const file of inputs) for (const result of JSON.parse(fs.readFileSync(file))) checks.set(`${result.group}:${result.name}`, { ...result, report: file });
const results = [...checks.values()];
const report = { checks: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results };
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (report.failed) process.exitCode = 1;
