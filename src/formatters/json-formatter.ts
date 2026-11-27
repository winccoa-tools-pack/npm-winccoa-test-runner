/**
 * JSON Formatter - Structured JSON output for test results
 */

import { TestFile, TestRunResult, TestSummary } from '../types/index.js';

/**
 * Format discovered tests as JSON
 */
export function formatDiscoveredTestsJson(tests: TestFile[]): string {
    return JSON.stringify(tests, null, 2);
}

/**
 * Format test execution results as JSON
 */
export function formatTestExecutionResultsJson(results: TestRunResult[]): string {
    return JSON.stringify(results, null, 2);
}

/**
 * Format complete test report as JSON
 */
export function formatTestReportJson(
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
    environment?: {
        hostname?: string;
        version?: string;
        testVersion?: string;
    },
): string {
    const report = {
        summary,
        results,
        environment,
        timestamp: new Date().toISOString(),
    };

    return JSON.stringify(report, null, 2);
}
