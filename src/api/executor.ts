/**
 * Test Execution API
 * Provides functions to execute WinCC OA tests using CtrlComponent
 */

import * as path from 'path';
import { CtrlComponent } from '@winccoa-tools-pack/npm-winccoa-core/types/components/implementations/CtrlComponent';
import {
    TestExecutionOptions,
    TestResult,
    TestFilter,
    TestFile,
} from '../types/index.js';

/**
 * Execution queue to serialize test runs
 * WinCC OA has issues with parallel test execution (JSON file conflicts)
 */
class ExecutionQueue {
    private queue: Array<() => Promise<any>> = [];
    private running = false;

    async add<T>(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await task();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });

            if (!this.running) {
                this.processQueue();
            }
        });
    }

    private async processQueue(): Promise<void> {
        if (this.queue.length === 0) {
            this.running = false;
            return;
        }

        this.running = true;
        const task = this.queue.shift();
        
        if (task) {
            await task();
        }

        // Process next task
        this.processQueue();
    }
}

// Global execution queue
const executionQueue = new ExecutionQueue();

/**
 * Execute a single test file or test case
 * 
 * @param scriptPath - Absolute path to the test script (.ctl file)
 * @param options - Execution options
 * @param testCaseId - Optional test case ID for individual test execution
 * @returns Exit code (0 = success, non-zero = error, null = cancelled)
 * 
 * @example
 * ```typescript
 * // Execute entire test file
 * const exitCode = await executeTest(
 *     '/path/to/MyTest.ctl',
 *     { projectPath: '/path/to/project' }
 * );
 * 
 * // Execute single test case
 * const exitCode = await executeTest(
 *     '/path/to/MyTest.ctl',
 *     { projectPath: '/path/to/project' },
 *     'testCase1'
 * );
 * ```
 */
export async function executeTest(
    scriptPath: string,
    options: TestExecutionOptions,
    testCaseId?: string,
): Promise<number | null> {
    // Queue execution to prevent parallel runs
    return executionQueue.add(async () => {
        return executeTestInternal(scriptPath, options, testCaseId);
    });
}

/**
 * Internal test execution (not queued)
 */
async function executeTestInternal(
    scriptPath: string,
    options: TestExecutionOptions,
    testCaseId?: string,
): Promise<number | null> {
    try {
        // Create CtrlComponent instance
        const ctrl = new CtrlComponent();

        // Set version if provided
        if (options.version) {
            ctrl.setVersion(options.version);
        }

        // Resolve project name from path if not provided
        const projectName = options.projectName || path.basename(options.projectPath);

        // Build arguments
        // Format: scriptPath -proj projectName [-ETM.oaTest.testCases=testId]
        const args: string[] = [scriptPath, '-proj', projectName];

        // Add individual test case filter if provided
        if (testCaseId) {
            args.push(`-ETM.oaTest.testCases=${testCaseId}`);
        }

        console.log(`[TestRunner] Executing: ${ctrl.getName()} ${args.join(' ')}`);

        // Execute via CtrlComponent
        // Use start() method with direct args (not startWithScript which uses -f flag)
        const exitCode = await ctrl.start(args, {
            timeout: options.timeout || 60000,
        });

        // Handle abort signal
        if (options.signal?.aborted) {
            console.log('[TestRunner] Execution aborted');
            return null;
        }

        console.log(`[TestRunner] Process exited with code: ${exitCode}`);
        return exitCode;

    } catch (error) {
        console.error('[TestRunner] Execution error:', error);
        
        // Check if cancelled
        if (options.signal?.aborted) {
            return null;
        }
        
        return -1;
    }
}

/**
 * Execute multiple tests sequentially
 * 
 * @param tests - Array of tests to execute
 * @param options - Execution options
 * @returns Array of exit codes
 * 
 * @example
 * ```typescript
 * const tests = [
 *     { file: '/path/to/Test1.ctl' },
 *     { file: '/path/to/Test2.ctl', testId: 'specificTest' }
 * ];
 * 
 * const results = await executeMultipleTests(tests, {
 *     projectPath: '/path/to/project'
 * });
 * 
 * results.forEach((code, i) => {
 *     console.log(`Test ${i}: ${code === 0 ? 'PASSED' : 'FAILED'}`);
 * });
 * ```
 */
export async function executeMultipleTests(
    tests: Array<{ file: string; testId?: string }>,
    options: TestExecutionOptions,
): Promise<Array<number | null>> {
    const results: Array<number | null> = [];

    for (const test of tests) {
        // Check for cancellation before each test
        if (options.signal?.aborted) {
            console.log('[TestRunner] Batch execution cancelled');
            // Fill remaining with null
            results.push(...Array(tests.length - results.length).fill(null));
            break;
        }

        const exitCode = await executeTest(test.file, options, test.testId);
        results.push(exitCode);
    }

    return results;
}

/**
 * Execute all tests from discovered test files
 * 
 * @param testFiles - Array of discovered test files
 * @param options - Execution options
 * @param filter - Optional filter to select specific tests
 * @returns Array of test execution results
 * 
 * @example
 * ```typescript
 * const testFiles = await discoverTests({ rootPath: '/path/to/project' });
 * 
 * // Run all tests
 * const results = await executeTestFiles(testFiles, {
 *     projectPath: '/path/to/project'
 * });
 * 
 * // Run only tests matching filter
 * const filteredResults = await executeTestFiles(testFiles, 
 *     { projectPath: '/path/to/project' },
 *     { pattern: /^test.*$/i }
 * );
 * ```
 */
export async function executeTestFiles(
    testFiles: TestFile[],
    options: TestExecutionOptions,
    filter?: TestFilter,
): Promise<Array<{ file: string; testId?: string; exitCode: number | null }>> {
    const results: Array<{ file: string; testId?: string; exitCode: number | null }> = [];

    for (const testFile of testFiles) {
        // Check for cancellation
        if (options.signal?.aborted) {
            break;
        }

        // Apply file filter
        if (filter?.file && testFile.path !== filter.file) {
            continue;
        }

        // If individual test execution is supported and filter specifies test ID
        if (testFile.supportsIndividualTests && filter?.testId) {
            const testCase = testFile.testCases.find(tc => tc.id === filter.testId);
            
            if (testCase) {
                const exitCode = await executeTest(testFile.path, options, testCase.id);
                results.push({
                    file: testFile.path,
                    testId: testCase.id,
                    exitCode,
                });
            }
        } else if (testFile.supportsIndividualTests && filter?.pattern) {
            // Execute matching tests individually
            for (const testCase of testFile.testCases) {
                const pattern = typeof filter.pattern === 'string' 
                    ? new RegExp(filter.pattern) 
                    : filter.pattern;
                
                if (pattern.test(testCase.id)) {
                    const exitCode = await executeTest(testFile.path, options, testCase.id);
                    results.push({
                        file: testFile.path,
                        testId: testCase.id,
                        exitCode,
                    });
                }
            }
        } else {
            // Execute entire file
            const exitCode = await executeTest(testFile.path, options);
            results.push({
                file: testFile.path,
                exitCode,
            });
        }
    }

    return results;
}
