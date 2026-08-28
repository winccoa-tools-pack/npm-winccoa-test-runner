/**
 * JSON Result Parser
 * Parses WinCC OA fullResult.json test output files
 * Ported from vscode-winccoa-tests extension (VS Code-agnostic version)
 */

import * as fs from 'fs/promises';
import { TestResult, TestLocation, TestRunResult, TestSummary } from '../../types/index.js';

/**
 * JSON result structure from WinCC OA test framework
 */
interface WinCCOATestResult {
    Environment: {
        TestVersion: string;
        Version: string;
        Hostname: string;
        SystemEnvironment?: Record<string, string>;
    };
    Time: {
        Start: string;
        End: string;
    };
    TestManager?: {
        ProgName: string;
        Num: string;
        Type: string;
        Id: string;
    };
    Statistic: {
        Aborted: number;
        Failed: number;
        Passed: number;
        KnownBugs?: number;
    };
    TestCases: TestCaseEntry[];
}

/**
 * Individual test case entry (each assertion is a separate entry)
 */
interface TestCaseEntry {
    TcId: string;
    Result: 'Pass' | 'Fail' | 'KnownBug' | 'Aborted' | 'Undefined';
    Note?: string;
    StartTimeStamp?: string;
    EndTimeStamp?: string;
    Duration?: number;
    Method?: string;
    Location?: string;
    StackTrace?: string[];
    ErrMsg?: string;
    CurrentValue?: any;
    ReferenceValue?: any;
}

/**
 * Parse JSON test results from fullResult.json
 *
 * @param jsonPath - Path to fullResult.json file
 * @returns Parsed test results
 *
 * @example
 * ```typescript
 * const result = await parseJsonResults('/path/to/project/fullResult.json');
 *
 * console.log(`Total: ${result.summary.total}`);
 * console.log(`Passed: ${result.summary.passed}`);
 * console.log(`Failed: ${result.summary.failed}`);
 *
 * result.results.forEach(test => {
 *     console.log(`${test.testId}: ${test.status}`);
 *     if (test.message) {
 *         console.log(`  ${test.message}`);
 *     }
 * });
 * ```
 */
export async function parseJsonResults(jsonPath: string): Promise<TestRunResult> {
    try {
        // Read and parse JSON
        const content = await fs.readFile(jsonPath, 'utf-8');
        const testResult: WinCCOATestResult = JSON.parse(content);

        if (!testResult || !Array.isArray(testResult.TestCases)) {
            throw new Error('Invalid result file format (missing TestCases array)');
        }

        console.log(
            `[JsonParser] Parsing ${testResult.TestCases.length} test entries from ${jsonPath}`,
        );

        // Group test cases by TcId (multiple entries per test = multiple assertions)
        const groupedByCaseId = groupByTestCaseId(testResult.TestCases);

        // Parse each test case
        const results: TestResult[] = [];
        for (const [testId, entries] of groupedByCaseId.entries()) {
            const parsedCase = parseTestCase(testId, entries);
            results.push(parsedCase);
        }

        // Build summary
        const summary: TestSummary = {
            total: results.length,
            passed: testResult.Statistic.Passed || 0,
            failed: testResult.Statistic.Failed || 0,
            aborted: testResult.Statistic.Aborted || 0,
            skipped: 0,
            duration: results.reduce((sum, r) => sum + (r.duration || 0), 0),
            startTime: testResult.Time.Start ? new Date(testResult.Time.Start) : undefined,
            endTime: testResult.Time.End ? new Date(testResult.Time.End) : undefined,
        };

        console.log(
            `[JsonParser] Parsed ${results.length} test case(s): ` +
                `${summary.passed} passed, ${summary.failed} failed, ${summary.aborted} aborted` +
                (testResult.Statistic.KnownBugs
                    ? `, ${testResult.Statistic.KnownBugs} known bugs`
                    : ''),
        );

        return {
            results,
            summary,
            environment: {
                hostname: testResult.Environment.Hostname,
                version: testResult.Environment.Version,
                testVersion: testResult.Environment.TestVersion,
            },
        };
    } catch (error) {
        console.error(`[JsonParser] Failed to parse test results from ${jsonPath}:`, error);
        throw error;
    }
}

/**
 * Parse JSON content directly (for testing or when content is already loaded)
 *
 * @param content - Parsed JSON object or JSON string
 * @returns Parsed test results
 */
export async function parseJsonContent(
    content: string | WinCCOATestResult,
): Promise<TestRunResult> {
    const testResult: WinCCOATestResult =
        typeof content === 'string' ? JSON.parse(content) : content;

    // Reuse parseJsonResults logic by creating temp file
    // Alternative: refactor parseJsonResults to accept object
    // For now, just parse inline:

    if (!testResult || !Array.isArray(testResult.TestCases)) {
        throw new Error('Invalid result format (missing TestCases array)');
    }

    const groupedByCaseId = groupByTestCaseId(testResult.TestCases);
    const results: TestResult[] = [];

    for (const [testId, entries] of groupedByCaseId.entries()) {
        const parsedCase = parseTestCase(testId, entries);
        results.push(parsedCase);
    }

    const summary: TestSummary = {
        total: results.length,
        passed: testResult.Statistic.Passed || 0,
        failed: testResult.Statistic.Failed || 0,
        aborted: testResult.Statistic.Aborted || 0,
        skipped: 0,
        duration: results.reduce((sum, r) => sum + (r.duration || 0), 0),
        startTime: testResult.Time.Start ? new Date(testResult.Time.Start) : undefined,
        endTime: testResult.Time.End ? new Date(testResult.Time.End) : undefined,
    };

    return {
        results,
        summary,
        environment: {
            hostname: testResult.Environment.Hostname,
            version: testResult.Environment.Version,
            testVersion: testResult.Environment.TestVersion,
        },
    };
}

/**
 * Group test case entries by TcId
 */
function groupByTestCaseId(entries: TestCaseEntry[]): Map<string, TestCaseEntry[]> {
    const grouped = new Map<string, TestCaseEntry[]>();

    for (const entry of entries) {
        const existing = grouped.get(entry.TcId) || [];
        existing.push(entry);
        grouped.set(entry.TcId, existing);
    }

    return grouped;
}

/**
 * Parse a single test case from its entries (multiple entries = multiple assertions)
 */
function parseTestCase(testId: string, entries: TestCaseEntry[]): TestResult {
    let overallStatus: 'passed' | 'failed' | 'aborted' = 'passed';
    let totalDuration = 0;
    const messages: string[] = [];
    const stackTraces: string[] = [];
    let location: TestLocation | undefined;

    for (const entry of entries) {
        // Skip "Undefined" entries (INFO messages without assertions)
        if (entry.Result === 'Undefined') {
            continue;
        }

        // Track overall status (aborted has highest priority, then failed)
        if (entry.Result === 'Aborted') {
            overallStatus = 'aborted';
        } else if (
            (entry.Result === 'Fail' || entry.Result === 'KnownBug') &&
            overallStatus !== 'aborted'
        ) {
            overallStatus = 'failed';
        }

        // Accumulate duration
        totalDuration += entry.Duration ?? 0;

        // Collect messages
        if (entry.Result !== 'Pass') {
            const msg = buildAssertionMessage(entry);
            if (msg) {
                messages.push(msg);
            }
        }

        // Parse location from first failure/abort
        if (!location && entry.Result !== 'Pass') {
            location = parseLocation(entry);
        }

        // Collect stack traces
        if (entry.StackTrace && entry.StackTrace.length > 0) {
            stackTraces.push(...entry.StackTrace);
        }
    }

    // Build overall message
    const message = messages.length > 0 ? messages.join('\n') : `All assertions passed`;

    return {
        testId,
        status: overallStatus,
        message,
        duration: totalDuration,
        stackTrace: stackTraces.length > 0 ? stackTraces.join('\n') : undefined,
        location,
        method: entries.find((e) => e.Method)?.Method,
        note: entries.find((e) => e.Note)?.Note,
    };
}

/**
 * Build assertion message from entry
 */
function buildAssertionMessage(entry: TestCaseEntry): string {
    const parts: string[] = [];

    // Add result type
    parts.push(`[${entry.Result}]`);

    // Add note
    if (entry.Note) {
        parts.push(entry.Note);
    }

    // Add values for failed assertions
    if (entry.Result === 'Fail' || entry.Result === 'KnownBug') {
        if (entry.CurrentValue !== undefined && entry.ReferenceValue !== undefined) {
            parts.push(`Expected: ${JSON.stringify(entry.ReferenceValue)}`);
            parts.push(`Actual: ${JSON.stringify(entry.CurrentValue)}`);
        }
    }

    // Add error message
    if (entry.ErrMsg) {
        parts.push(`Error: ${entry.ErrMsg}`);
    }

    // Add method
    if (entry.Method && entry.Method !== 'oaUnitInfo') {
        parts.push(`Method: ${entry.Method}`);
    }

    return parts.join(' | ');
}

/**
 * Parse location from test case entry
 * Uses StackTrace to get the actual line in the test script
 */
function parseLocation(entry: TestCaseEntry): TestLocation | undefined {
    const stackTrace = entry.StackTrace ?? [];

    // For failed assertions, use the first stack frame (actual assertion location)
    if (entry.Result === 'Fail' || entry.Result === 'KnownBug') {
        for (const frame of stackTrace) {
            const loc = parseStackFrame(frame);
            if (loc) {
                return loc;
            }
        }
    }

    // For aborted tests, Location field might have the info
    if (entry.Location) {
        // Location format: "file.ctl:line"
        const match = entry.Location.match(/(.+?):(\d+)/);
        if (match) {
            return {
                file: match[1],
                line: parseInt(match[2], 10),
            };
        }
    }

    return undefined;
}

/**
 * Parse stack frame string into location
 * Format: "int TstParserStates::startTestCase(const string &tcId) at /path/to/file.ctl:79"
 */
function parseStackFrame(frame: string): TestLocation | undefined {
    const atMatch = frame.match(/\s+at\s+(.+?):(\d+)/);
    if (!atMatch) {
        return undefined;
    }

    const filePath = atMatch[1];
    const lineNum = parseInt(atMatch[2], 10);

    if (!filePath || isNaN(lineNum)) {
        return undefined;
    }

    return {
        file: filePath,
        line: lineNum,
    };
}
