#!/usr/bin/env node
/**
 * WinCC OA Test Runner CLI
 * Headless test execution for CI/CD and automation
 */

import { Command } from 'commander';
import * as path from 'path';
import { discoverTests, executeTest, executeTestFiles, parseTestResults, findResultFiles } from './index.js';
import { TestFile } from './types/index.js';

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

/**
 * Command: discover
 * Discover all tests in a project
 */
program
    .command('discover')
    .description('Discover test files in a WinCC OA project')
    .option('-s, --subdirectory <path>', 'Subdirectory to search (default: scripts)', 'scripts')
    .option('-o, --output <format>', 'Output format: console, json', 'console')
    .action(async (options) => {
        try {
            const projectPath = program.opts().project || process.cwd();
            const verbose = program.opts().verbose;

            if (verbose) {
                console.log(`[Discovery] Project: ${projectPath}`);
                console.log(`[Discovery] Subdirectory: ${options.subdirectory}`);
            }

            // Discover tests
            const tests = await discoverTests({
                rootPath: projectPath,
                subdirectory: options.subdirectory,
            });

            // Output results
            if (options.output === 'json') {
                console.log(JSON.stringify(tests, null, 2));
            } else {
                // Console format
                console.log(`\n✓ Discovered ${tests.length} test file(s):\n`);
                
                for (const test of tests) {
                    const relativePath = path.relative(projectPath, test.path);
                    console.log(`  📄 ${relativePath}`);
                    console.log(`     Class: ${test.className}`);
                    console.log(`     Tests: ${test.testCases.length}`);
                    console.log(`     Format: ${test.format || 'unknown'}`);
                    console.log(`     Individual execution: ${test.supportsIndividualTests ? '✓' : '✗'}`);
                    
                    if (verbose) {
                        console.log(`     Test cases:`);
                        for (const tc of test.testCases) {
                            console.log(`       - ${tc.id}`);
                        }
                    }
                    console.log();
                }

                // Summary
                const totalTests = tests.reduce((sum, t) => sum + t.testCases.length, 0);
                console.log(`📊 Summary: ${tests.length} file(s), ${totalTests} test case(s)`);
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
    .option('--timeout <ms>', 'Test timeout in milliseconds', '60000')
    .action(async (options) => {
        try {
            const projectPath = program.opts().project || process.cwd();
            const verbose = program.opts().verbose;
            const timeout = parseInt(options.timeout, 10);

            if (verbose) {
                console.log(`[Execution] Project: ${projectPath}`);
                console.log(`[Execution] Timeout: ${timeout}ms`);
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

                console.log(`\n🚀 Running test: ${path.relative(projectPath, filePath)}`);
                
                if (options.test) {
                    console.log(`   Test case: ${options.test}\n`);
                }

                exitCode = await executeTest(filePath, execOptions, options.test);

                if (exitCode === 0) {
                    console.log(`\n✓ Test execution completed successfully`);
                } else if (exitCode === null) {
                    console.log(`\n⚠ Test execution was cancelled`);
                } else {
                    console.log(`\n✗ Test execution failed with exit code: ${exitCode}`);
                }
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
                let passCount = 0;
                let failCount = 0;

                for (const result of results) {
                    const relativePath = path.relative(projectPath, result.file);
                    const status = result.exitCode === 0 ? '✓' : '✗';
                    const testInfo = result.testId ? ` (${result.testId})` : '';
                    
                    console.log(`${status} ${relativePath}${testInfo}`);
                    
                    if (result.exitCode === 0) {
                        passCount++;
                    } else {
                        failCount++;
                    }
                }

                console.log(`\n📊 Summary: ${passCount} passed, ${failCount} failed`);
                
                exitCode = failCount > 0 ? 1 : 0;
            } else {
                console.error('❌ No test specified. Use --file, --test, or --all');
                process.exit(1);
            }

            // Parse results if available
            if (exitCode === 0) {
                console.log(`\n📋 Parsing test results...`);
                
                const resultFiles = await findResultFiles(projectPath);
                
                if (resultFiles.fullResult) {
                    const result = await parseTestResults({
                        resultPath: resultFiles.fullResult,
                        projectPath,
                    });

                    if (options.outputFormat === 'json') {
                        console.log(JSON.stringify(result, null, 2));
                    } else if (options.outputFormat === 'junit') {
                        // TODO: JUnit formatter
                        console.log('JUnit format not yet implemented');
                    } else {
                        // Console format
                        console.log(`\n📊 Test Results:`);
                        console.log(`   Total: ${result.summary.total}`);
                        console.log(`   Passed: ${result.summary.passed}`);
                        console.log(`   Failed: ${result.summary.failed}`);
                        console.log(`   Aborted: ${result.summary.aborted}`);
                        console.log(`   Duration: ${result.summary.duration}ms`);

                        if (result.summary.failed > 0 || result.summary.aborted > 0) {
                            console.log(`\n❌ Failed tests:`);
                            for (const test of result.results) {
                                if (test.status !== 'passed') {
                                    console.log(`   - ${test.testId}: ${test.status}`);
                                    if (test.message) {
                                        console.log(`     ${test.message}`);
                                    }
                                }
                            }
                        }
                    }
                } else {
                    console.log('   No result files found (fullResult.json)');
                }
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
                console.log(`[Parser] Result file: ${resultPath}`);
                console.log(`[Parser] Format: ${options.format}`);
            }

            // Parse results
            const result = await parseTestResults({
                resultPath,
                format: options.format,
                projectPath,
            });

            // Output results
            if (options.output === 'json') {
                console.log(JSON.stringify(result, null, 2));
            } else if (options.output === 'junit') {
                // TODO: JUnit formatter
                console.log('JUnit format not yet implemented');
            } else {
                // Console format
                console.log(`\n📊 Test Results from: ${path.basename(resultPath)}`);
                console.log(`\n   Total tests: ${result.summary.total}`);
                console.log(`   ✓ Passed: ${result.summary.passed}`);
                console.log(`   ✗ Failed: ${result.summary.failed}`);
                console.log(`   ⚠ Aborted: ${result.summary.aborted}`);
                console.log(`   ⏱ Duration: ${result.summary.duration}ms`);

                if (result.environment) {
                    console.log(`\n   Environment:`);
                    console.log(`     Host: ${result.environment.hostname}`);
                    console.log(`     Version: ${result.environment.version}`);
                    console.log(`     Test Framework: ${result.environment.testVersion}`);
                }

                if (result.summary.failed > 0 || result.summary.aborted > 0) {
                    console.log(`\n❌ Failed/Aborted tests:`);
                    for (const test of result.results) {
                        if (test.status !== 'passed') {
                            console.log(`\n   ${test.testId} - ${test.status.toUpperCase()}`);
                            if (test.message) {
                                const lines = test.message.split('\n');
                                for (const line of lines) {
                                    console.log(`     ${line}`);
                                }
                            }
                            if (test.location) {
                                console.log(`     📍 ${test.location.file}:${test.location.line}`);
                            }
                        }
                    }
                }
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
