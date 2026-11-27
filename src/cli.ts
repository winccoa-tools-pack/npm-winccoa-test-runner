#!/usr/bin/env node
/**
 * WinCC OA Test Runner CLI
 * Headless test execution for CI/CD and automation
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
    discoverTests,
    executeTest,
    executeTestFiles,
    parseTestResults,
    findResultFiles,
    setLogger,
} from './index.js';
import {
    formatDiscoveredTests,
    formatDiscoveredTestsVerbose,
    formatTestExecutionStart,
    formatTestExecutionResult,
    formatMultipleTestResults,
    formatTestReport,
    formatDiscoveredTestsJson,
    formatTestReportJson,
    formatTestReportJUnit,
} from './formatters/index.js';

const program = new Command();

program
    .name('winccoa-test')
    .description('WinCC OA test runner - headless test execution and reporting')
    .version('0.2.0');

// Global options
program
    .option('--project <path>', 'WinCC OA project path')
    .option('--install-path <path>', 'WinCC OA installation path')
    .option('--oa-version <version>', 'WinCC OA version (e.g., 3.20)')
    .option('--verbose', 'Enable verbose output');

// Diagnostics of the library go to stderr, and only with --verbose
program.hook('preAction', () => {
    if (program.opts().verbose) {
        setLogger((message) => console.error(`[test-runner] ${message}`));
    }
});

/**
 * Write a machine-readable report (json, junit) to a file.
 * It is never printed to stdout or stderr: other output (for example of WinCC OA
 * tools) could end up in the same stream and corrupt the report.
 */
async function writeReport(
    content: string,
    outputFile: string | undefined,
    defaultName: string,
): Promise<void> {
    const target = path.resolve(outputFile ?? defaultName);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf-8');
    console.log(`Report written to ${target}`);
}
/**
 * Command: discover
 * Discover all tests in a project
 */
program
    .command('discover')
    .description('Discover test files in a WinCC OA project')
    .option('-s, --subdirectory <path>', 'Subdirectory to search (default: scripts)', 'scripts')
    .option('-o, --output <format>', 'Output format: console, json', 'console')
    .option('--output-file <path>', 'File for the json output (default: discovered-tests.json)')
    .action(async (options) => {
        try {
            const projectPath = program.opts().project || process.cwd();
            const verbose = program.opts().verbose;

            if (verbose) {
                console.error(`[Discovery] Project: ${projectPath}`);
                console.error(`[Discovery] Subdirectory: ${options.subdirectory}`);
            }

            // Discover tests
            const tests = await discoverTests({
                rootPath: projectPath,
                subdirectory: options.subdirectory,
            });

            // Output results
            if (options.output === 'json') {
                await writeReport(
                    formatDiscoveredTestsJson(tests),
                    options.outputFile,
                    'discovered-tests.json',
                );
            } else {
                // Console format
                if (verbose) {
                    console.log(formatDiscoveredTestsVerbose(tests, projectPath));
                } else {
                    console.log(formatDiscoveredTests(tests, projectPath));
                }
            }

            process.exit(0);
        } catch (error) {
            console.error('❌ Discovery failed:', error);
            process.exit(1);
        }
    });

/**
 * Command: run
 * Execute tests
 */
program
    .command('run')
    .description('Execute WinCC OA tests')
    .option('-f, --file <path>', 'Specific test file to run')
    .option('-t, --test <id>', 'Specific test case ID to run')
    .option('-a, --all', 'Run all tests in project')
    .option('-o, --output-format <format>', 'Output format: console, json, junit', 'console')
    .option(
        '--output-file <path>',
        'File for the json or junit output (default: test-results.json or test-results.xml)',
    )
    .option('--timeout <ms>', 'Test timeout in milliseconds', '60000')
    .action(async (options) => {
        try {
            const projectPath = program.opts().project || process.cwd();
            const verbose = program.opts().verbose;
            const timeout = parseInt(options.timeout, 10);

            if (verbose) {
                console.error(`[Execution] Project: ${projectPath}`);
                console.error(`[Execution] Timeout: ${timeout}ms`);
            }

            // Execution options
            const execOptions = {
                projectPath,
                installPath: program.opts().installPath,
                version: program.opts().oaVersion,
                timeout,
            };

            let exitCode: number | null = 0;

            // Run specific file
            if (options.file) {
                const filePath = path.isAbsolute(options.file)
                    ? options.file
                    : path.join(projectPath, options.file);

                console.log(formatTestExecutionStart(filePath, options.test, projectPath));

                exitCode = await executeTest(filePath, execOptions, options.test);

                console.log(formatTestExecutionResult(exitCode));
            }
            // Run all tests
            else if (options.all) {
                console.log(`\n🚀 Running all tests in project...\n`);

                // Discover tests first
                const tests = await discoverTests({
                    rootPath: projectPath,
                    subdirectory: 'scripts',
                });

                console.log(`Found ${tests.length} test file(s)\n`);

                // Execute all
                const results = await executeTestFiles(tests, execOptions);

                // Show results
                console.log(formatMultipleTestResults(results, projectPath));

                exitCode = results.some((r) => r.exitCode !== 0) ? 1 : 0;
            } else {
                console.error('❌ No test specified. Use --file, --test, or --all');
                process.exit(1);
            }

            // Parse results if available (parse regardless of exit code)
            console.log(`\n📋 Parsing test results...`);

            const resultFiles = await findResultFiles(projectPath);

            if (resultFiles.fullResult) {
                const result = await parseTestResults({
                    resultPath: resultFiles.fullResult,
                    projectPath,
                });

                if (options.outputFormat === 'json') {
                    await writeReport(
                        formatTestReportJson(result.summary, result.results, result.environment),
                        options.outputFile,
                        'test-results.json',
                    );
                } else if (options.outputFormat === 'junit') {
                    await writeReport(
                        formatTestReportJUnit(result.summary, result.results),
                        options.outputFile,
                        'test-results.xml',
                    );
                } else {
                    // Console format
                    console.log(
                        formatTestReport(result.summary, result.results, result.environment),
                    );
                }

                // Set exit code based on test results
                exitCode = result.summary.failed > 0 ? 1 : 0;
            } else {
                console.log('   ⚠️  No result files found (fullResult.json)');
                console.log('   Note: Test may have failed before writing results.');
            }

            process.exit(exitCode === 0 ? 0 : 1);
        } catch (error) {
            console.error('❌ Execution failed:', error);
            process.exit(1);
        }
    });

/**
 * Command: parse
 * Parse existing test results
 */
program
    .command('parse')
    .description('Parse test results from fullResult.json or log files')
    .option('-r, --result-file <path>', 'Path to result file')
    .option('-f, --format <format>', 'Result format: auto, json, log', 'auto')
    .option('-o, --output <format>', 'Output format: console, json, junit', 'console')
    .option(
        '--output-file <path>',
        'File for the json or junit output (default: test-results.json or test-results.xml)',
    )
    .action(async (options) => {
        try {
            const projectPath = program.opts().project || process.cwd();
            const verbose = program.opts().verbose;

            // Determine result file path
            let resultPath = options.resultFile;

            if (!resultPath) {
                // Try to find fullResult.json in project
                const resultFiles = await findResultFiles(projectPath);
                resultPath = resultFiles.fullResult;

                if (!resultPath) {
                    console.error('❌ No result file found. Specify with --result-file');
                    process.exit(1);
                }
            } else if (!path.isAbsolute(resultPath)) {
                resultPath = path.join(projectPath, resultPath);
            }

            if (verbose) {
                console.error(`[Parser] Result file: ${resultPath}`);
                console.error(`[Parser] Format: ${options.format}`);
            }

            // Parse results
            const result = await parseTestResults({
                resultPath,
                format: options.format,
                projectPath,
            });

            // Output results
            if (options.output === 'json') {
                await writeReport(
                    formatTestReportJson(result.summary, result.results, result.environment),
                    options.outputFile,
                    'test-results.json',
                );
            } else if (options.output === 'junit') {
                await writeReport(
                    formatTestReportJUnit(result.summary, result.results),
                    options.outputFile,
                    'test-results.xml',
                );
            } else {
                // Console format
                console.log(`\n📊 Test Results from: ${path.basename(resultPath)}`);
                console.log(formatTestReport(result.summary, result.results, result.environment));
            }

            // Exit with appropriate code
            const hasFailures = result.summary.failed > 0 || result.summary.aborted > 0;
            process.exit(hasFailures ? 1 : 0);
        } catch (error) {
            console.error('❌ Parse failed:', error);
            process.exit(1);
        }
    });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
