const fs = require("node:fs/promises");
const path = require("node:path");

const THRESHOLD = 100;
const METRICS = ["statements", "branches", "functions", "lines"];
const COVERAGE_SUMMARY_PATH = path.join(process.cwd(), "coverage", "coverage-summary.json");
const COVERAGE_JSON_PATH = path.join(process.cwd(), "coverage.json");

function metricPercent(metric) {
  if (!metric || metric.total === 0) {
    return 100;
  }

  return Number(((metric.covered / metric.total) * 100).toFixed(2));
}

function makeCounter(total = 0, covered = 0) {
  return { total, covered };
}

function sumCounter(target, totalIncrement, coveredIncrement) {
  target.total += totalIncrement;
  target.covered += coveredIncrement;
}

function aggregateFromCoverageJson(rawCoverage) {
  const statements = makeCounter();
  const branches = makeCounter();
  const functions = makeCounter();
  const lines = makeCounter();

  for (const fileCoverage of Object.values(rawCoverage)) {
    const statementHits = Object.values(fileCoverage.s || {});
    sumCounter(
      statements,
      statementHits.length,
      statementHits.filter((count) => Number(count) > 0).length,
    );

    const functionHits = Object.values(fileCoverage.f || {});
    sumCounter(
      functions,
      functionHits.length,
      functionHits.filter((count) => Number(count) > 0).length,
    );

    const branchHits = Object.values(fileCoverage.b || {});
    for (const branch of branchHits) {
      const hits = Array.isArray(branch) ? branch : [];
      sumCounter(
        branches,
        hits.length,
        hits.filter((count) => Number(count) > 0).length,
      );
    }

    const lineHits = Object.values(fileCoverage.l || {});
    sumCounter(
      lines,
      lineHits.length,
      lineHits.filter((count) => Number(count) > 0).length,
    );
  }

  return { statements, branches, functions, lines };
}

async function loadCoverageTotals() {
  try {
    const summaryRaw = await fs.readFile(COVERAGE_SUMMARY_PATH, "utf-8");
    const summary = JSON.parse(summaryRaw);
    if (!summary.total) {
      throw new Error(`Missing total coverage data in ${COVERAGE_SUMMARY_PATH}`);
    }
    return summary.total;
  } catch {
    const coverageRaw = await fs.readFile(COVERAGE_JSON_PATH, "utf-8");
    const coverage = JSON.parse(coverageRaw);
    return aggregateFromCoverageJson(coverage);
  }
}

async function main() {
  const total = await loadCoverageTotals();

  const failures = [];

  for (const metricName of METRICS) {
    const percent = metricPercent(total[metricName]);
    if (percent < THRESHOLD) {
      failures.push(`${metricName}=${percent}%`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Coverage threshold failed (required ${THRESHOLD}%): ${failures.join(", ")}`);
  }

  console.log(`Coverage threshold passed: ${THRESHOLD}% across ${METRICS.join(", ")}.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});



