/**
 * JUnit XML Formatter - JUnit XML output for CI/CD integration
 *
 * Format specification: https://llg.cubic.org/docs/junit/
 */

import { TestSummary } from '../types/index.js';

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Format test results as JUnit XML
 */
export function formatTestReportJUnit(
    summary: TestSummary,
    results: Array<{
        testId: string;
        status: 'passed' | 'failed' | 'aborted' | 'skipped';
        message?: string;
        duration?: number;
        location?: {
            file: string;
            line: number;
        };
    }>,
    suiteName: string = 'WinCC OA Tests',
): string {
    const lines: string[] = [];

    // XML header
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');

    // Testsuite element
    const timestamp = new Date().toISOString();
    const durationSeconds = (summary.duration / 1000).toFixed(3);

    lines.push(
        `<testsuite name="${escapeXml(suiteName)}" tests="${summary.total}" failures="${summary.failed}" skipped="${summary.aborted}" time="${durationSeconds}" timestamp="${timestamp}">`,
    );

    // Individual test cases
    for (const result of results) {
        const testDurationSeconds = result.duration ? (result.duration / 1000).toFixed(3) : '0.000';
        const className = result.testId.split('.')[0] || 'UnknownClass';
        const testName = result.testId.split('.').slice(1).join('.') || result.testId;

        lines.push(
            `  <testcase name="${escapeXml(testName)}" classname="${escapeXml(className)}" time="${testDurationSeconds}">`,
        );

        if (result.status === 'failed') {
            const message = result.message || 'Test failed';
            const location = result.location
                ? `${result.location.file}:${result.location.line}`
                : '';

            lines.push(`    <failure message="${escapeXml(message)}">`);
            lines.push(`      ${escapeXml(message)}`);
            if (location) {
                lines.push(`      Location: ${escapeXml(location)}`);
            }
            lines.push('    </failure>');
        } else if (result.status === 'aborted') {
            const message = result.message || 'Test aborted';
            lines.push(`    <skipped message="${escapeXml(message)}"/>`);
        }

        lines.push('  </testcase>');
    }

    // Close testsuite
    lines.push('</testsuite>');

    return lines.join('\n');
}

/**
 * Format multiple test suites as JUnit XML
 */
export function formatMultipleTestSuitesJUnit(
    testSuites: Array<{
        name: string;
        summary: TestSummary;
        results: Array<{
            testId: string;
            status: 'passed' | 'failed' | 'aborted' | 'skipped';
            message?: string;
            duration?: number;
            location?: {
                file: string;
                line: number;
            };
        }>;
    }>,
): string {
    const lines: string[] = [];

    // XML header
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');

    // Testsuites container
    const totalTests = testSuites.reduce((sum, suite) => sum + suite.summary.total, 0);
    const totalFailures = testSuites.reduce((sum, suite) => sum + suite.summary.failed, 0);
    const totalSkipped = testSuites.reduce((sum, suite) => sum + suite.summary.aborted, 0);

    lines.push(
        `<testsuites tests="${totalTests}" failures="${totalFailures}" skipped="${totalSkipped}">`,
    );

    // Individual test suites
    for (const suite of testSuites) {
        const timestamp = new Date().toISOString();
        const durationSeconds = (suite.summary.duration / 1000).toFixed(3);

        lines.push(
            `  <testsuite name="${escapeXml(suite.name)}" tests="${suite.summary.total}" failures="${suite.summary.failed}" skipped="${suite.summary.aborted}" time="${durationSeconds}" timestamp="${timestamp}">`,
        );

        // Individual test cases
        for (const result of suite.results) {
            const testDurationSeconds = result.duration
                ? (result.duration / 1000).toFixed(3)
                : '0.000';
            const className = result.testId.split('.')[0] || 'UnknownClass';
            const testName = result.testId.split('.').slice(1).join('.') || result.testId;

            lines.push(
                `    <testcase name="${escapeXml(testName)}" classname="${escapeXml(className)}" time="${testDurationSeconds}">`,
            );

            if (result.status === 'failed') {
                const message = result.message || 'Test failed';
                const location = result.location
                    ? `${result.location.file}:${result.location.line}`
                    : '';

                lines.push(`      <failure message="${escapeXml(message)}">`);
                lines.push(`        ${escapeXml(message)}`);
                if (location) {
                    lines.push(`        Location: ${escapeXml(location)}`);
                }
                lines.push('      </failure>');
            } else if (result.status === 'aborted') {
                const message = result.message || 'Test aborted';
                lines.push(`      <skipped message="${escapeXml(message)}"/>`);
            }

            lines.push('    </testcase>');
        }

        lines.push('  </testsuite>');
    }

    // Close testsuites
    lines.push('</testsuites>');

    return lines.join('\n');
}
