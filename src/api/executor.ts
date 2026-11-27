/**
 * Test Execution API
 * Provides functions to execute WinCC OA tests using CtrlComponent
 */

import * as path from 'path';
import { CtrlComponent } from '@winccoa-tools-pack/npm-winccoa-core/types/components/implementations/CtrlComponent';
import { getProjectByProjectPath } from '@winccoa-tools-pack/npm-winccoa-core/utils/winccoa-project-environment';
import { TestExecutionOptions, TestExecutionResult, TestFile, TestFilter } from '../types/index.js';
import { errorMessage, log } from '../utils/logger.js';
import { runProcess } from '../utils/process.js';
import { createResultFiles, deleteResultFiles, resultFilesExist } from '../utils/result-files.js';

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
 * Find the registered WinCC OA project for the given path.
 * An explicit project name wins; without registration the folder name is used.
 */
async function resolveProject(
    options: TestExecutionOptions,
): Promise<{ name: string; version?: string }> {
    if (options.projectName) {
        return { name: options.projectName };
    }

    try {
        const project = await getProjectByProjectPath(options.projectPath);
        if (project) {
            return { name: project.getId(), version: project.getVersion() };
        }
        log(`No registered WinCC OA project found for ${options.projectPath}`);
    } catch (error) {
        log(`Project lookup failed: ${errorMessage(error)}`);
    }

    return { name: path.basename(options.projectPath) };
}

/**
 * Internal test execution (not queued)
 */
async function executeTestInternal(
    scriptPath: string,
    options: TestExecutionOptions,
    testCaseId?: string,
): Promise<number | null> {
    if (options.signal?.aborted) {
        return null;
    }

    try {
        // Step 1: Delete old result files if they exist
        if (await resultFilesExist(options.projectPath)) {
            log('Deleting old result files');
            await deleteResultFiles(options.projectPath);
        }

        // Step 2: Create empty result files for WinCC OA to write to
        log('Creating result files');
        await createResultFiles(options.projectPath);

        const project = await resolveProject(options);

        // Locate the control manager of the requested (or the project's) version
        const ctrl = new CtrlComponent();
        const version = options.version || project.version;
        if (version) {
            ctrl.setVersion(version);
        }

        const executable = ctrl.getPath();
        if (!executable) {
            throw new Error(`WinCC OA control manager ${ctrl.getName()} not found`);
        }

        // Format: scriptPath -proj projectName [-ETM.oaTest.testCases=testId]
        const args: string[] = [scriptPath, '-proj', project.name];
        if (testCaseId) {
            args.push(`-ETM.oaTest.testCases=${testCaseId}`);
        }

        log(`Executing: ${executable} ${args.join(' ')}`);

        const exitCode = await runProcess(executable, args, {
            timeout: options.timeout ?? 60000,
            signal: options.signal,
            env: options.env,
        });

        if (exitCode === null) {
            log('Execution aborted');
            await deleteResultFiles(options.projectPath);
            return null;
        }

        log(`Process exited with code: ${exitCode}`);
        return exitCode;
    } catch (error) {
        log(`Execution error: ${errorMessage(error)}`);

        // Clean up result files on error
        try {
            await deleteResultFiles(options.projectPath);
        } catch {
            // Ignore cleanup errors
        }

        return options.signal?.aborted ? null : -1;
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
            log('Batch execution cancelled');
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
): Promise<TestExecutionResult[]> {
    const results: TestExecutionResult[] = [];

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
            const testCase = testFile.testCases.find((tc) => tc.id === filter.testId);

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
                const pattern =
                    typeof filter.pattern === 'string'
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
