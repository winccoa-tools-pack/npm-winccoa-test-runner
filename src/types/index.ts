/**
 * Core type definitions for WinCC OA test runner
 * 
 * These types are platform-agnostic and can be used by both CLI and VS Code Extension.
 */

/**
 * Represents a single test case within a test file
 */
export interface TestCase {
    /**
     * Unique identifier for the test case
     * For 3.19 format: from makeDynString("testId1", "testId2")
     * For 3.20 format: method name (e.g., "testSomething")
     */
    id: string;

    /**
     * Method name for 3.20 format tests (public int testXxx())
     * Undefined for 3.19 format tests
     */
    method?: string;
}

/**
 * Represents a test file containing one or more test cases
 */
export interface TestFile {
    /**
     * Absolute path to the test file
     */
    path: string;

    /**
     * Name of the test class (e.g., "MyTest" from "class MyTest : OaTest")
     */
    className: string;

    /**
     * List of test cases found in this file
     */
    testCases: TestCase[];

    /**
     * Whether this file supports individual test execution
     * Determined by presence of main(...) with varargs signature
     */
    supportsIndividualTests: boolean;

    /**
     * Test format version detected
     * - '3.19': Uses getAllTestCaseIds() method
     * - '3.20': Uses public int test*() methods  
     * - 'mixed': Both formats found (invalid)
     */
    format?: '3.19' | '3.20' | 'mixed';
}

/**
 * Status of a test result
 */
export type TestStatus = 'passed' | 'failed' | 'aborted' | 'skipped';

/**
 * Represents the result of a single test case execution
 */
export interface TestResult {
    /**
     * Test case identifier
     */
    testId: string;

    /**
     * Test execution status
     */
    status: TestStatus;

    /**
     * Test duration in milliseconds
     */
    duration?: number;

    /**
     * Error or failure message (for failed/aborted tests)
     */
    message?: string;

    /**
     * Stack trace (for failed/aborted tests)
     */
    stackTrace?: string;

    /**
     * Source code location of the assertion/error
     */
    location?: TestLocation;

    /**
     * Additional note or description
     */
    note?: string;

    /**
     * Test method name (for 3.20 format)
     */
    method?: string;
}

/**
 * Source code location within a test file
 */
export interface TestLocation {
    /**
     * File path
     */
    file: string;

    /**
     * Line number (1-based)
     */
    line: number;

    /**
     * Column number (1-based, optional)
     */
    column?: number;
}

/**
 * Result of a single test file execution
 */
export interface TestExecutionResult {
    /**
     * Path to the test file
     */
    file: string;

    /**
     * Optional test case ID (if individual test was executed)
     */
    testId?: string;

    /**
     * Exit code of the test execution (null if cancelled)
     */
    exitCode: number | null;
}

/**
 * Options for test discovery
 */
export interface DiscoveryOptions {
    /**
     * Root path to discover tests from
     */
    rootPath: string;

    /**
     * Glob pattern for test files
     * @default `**\/*.ctl`
     */
    filePattern?: string;

    /**
     * Whether to include subprojects
     * @default true
     */
    includeSubprojects?: boolean;

    /**
     * Specific subdirectory to search (e.g., "scripts/tests")
     * If not provided, searches entire rootPath
     */
    subdirectory?: string;
}

/**
 * Options for test execution
 */
export interface TestExecutionOptions {
    /**
     * Path to the WinCC OA project
     */
    projectPath: string;

    /**
     * Project name (if not auto-detected from path)
     */
    projectName?: string;

    /**
     * WinCC OA installation path
     * If not provided, will be auto-detected
     */
    installPath?: string;

    /**
     * WinCC OA version (e.g., "3.20")
     * If not provided, will be auto-detected
     */
    version?: string;

    /**
     * Abort signal for cancellation
     */
    signal?: AbortSignal;

    /**
     * Timeout in milliseconds
     * @default 60000
     */
    timeout?: number;

    /**
     * Additional environment variables
     */
    env?: Record<string, string>;
}

/**
 * Filter for test execution
 */
export interface TestFilter {
    /**
     * Specific test file path
     */
    file?: string;

    /**
     * Specific test case ID
     */
    testId?: string;

    /**
     * Pattern to match test IDs
     */
    pattern?: string | RegExp;
}

/**
 * Result summary statistics
 */
export interface TestSummary {
    /**
     * Total number of tests
     */
    total: number;

    /**
     * Number of passed tests
     */
    passed: number;

    /**
     * Number of failed tests
     */
    failed: number;

    /**
     * Number of aborted tests
     */
    aborted: number;

    /**
     * Number of skipped tests
     */
    skipped: number;

    /**
     * Total duration in milliseconds
     */
    duration: number;

    /**
     * Start time
     */
    startTime?: Date;

    /**
     * End time
     */
    endTime?: Date;
}

/**
 * Complete test run result
 */
export interface TestRunResult {
    /**
     * Individual test results
     */
    results: TestResult[];

    /**
     * Summary statistics
     */
    summary: TestSummary;

    /**
     * Environment information
     */
    environment?: {
        hostname?: string;
        version?: string;
        testVersion?: string;
        os?: string;
    };
}

/**
 * Parse result format
 */
export type ParseFormat = 'auto' | 'json' | 'log';

/**
 * Result parser options
 */
export interface ParseOptions {
    /**
     * Path to result file (fullResult.json or log file)
     */
    resultPath: string;

    /**
     * Format hint
     * @default 'auto'
     */
    format?: ParseFormat;

    /**
     * Project path for resolving relative paths
     */
    projectPath?: string;
}
