/**
 * Console Formatter - Colorful terminal output for test results
 */

import chalk from 'chalk';
import { TestFile, TestExecutionResult, TestSummary } from '../types/index.js';
import * as path from 'path';

/**
 * Format discovered tests for console output
 */
export function formatDiscoveredTests(tests: TestFile[], basePath?: string): string {
    const lines: string[] = [];
    
    lines.push('');
    lines.push(chalk.green(`✓ Discovered ${tests.length} test file(s):`));
    lines.push('');
    
    for (const test of tests) {
        const relativePath = basePath ? path.relative(basePath, test.path) : test.path;
        
        lines.push(chalk.cyan(`  📄 ${relativePath}`));
        lines.push(`     Class: ${chalk.yellow(test.className)}`);
        lines.push(`     Tests: ${chalk.bold(test.testCases.length.toString())}`);
        lines.push(`     Format: ${test.format || 'unknown'}`);
        
        const supportsIndividual = test.supportsIndividualTests 
            ? chalk.green('✓') 
            : chalk.red('✗');
        lines.push(`     Individual execution: ${supportsIndividual}`);
        lines.push('');
    }
    
    // Summary
    const totalTests = tests.reduce((sum, t) => sum + t.testCases.length, 0);
    lines.push(chalk.bold(`📊 Summary: ${tests.length} file(s), ${totalTests} test case(s)`));
    
    return lines.join('\n');
}

/**
 * Format discovered tests with detailed test case listing
 */
export function formatDiscoveredTestsVerbose(tests: TestFile[], basePath?: string): string {
    const lines: string[] = [];
    
    lines.push('');
    lines.push(chalk.green(`✓ Discovered ${tests.length} test file(s):`));
    lines.push('');
    
    for (const test of tests) {
        const relativePath = basePath ? path.relative(basePath, test.path) : test.path;
        
        lines.push(chalk.cyan(`  📄 ${relativePath}`));
        lines.push(`     Class: ${chalk.yellow(test.className)}`);
        lines.push(`     Tests: ${chalk.bold(test.testCases.length.toString())}`);
        lines.push(`     Format: ${test.format || 'unknown'}`);
        
        const supportsIndividual = test.supportsIndividualTests 
            ? chalk.green('✓') 
            : chalk.red('✗');
        lines.push(`     Individual execution: ${supportsIndividual}`);
        
        // List all test cases
        lines.push('     Test cases:');
        for (const tc of test.testCases) {
            lines.push(chalk.dim(`       - ${tc.id}`));
        }
        
        lines.push('');
    }
    
    // Summary
    const totalTests = tests.reduce((sum, t) => sum + t.testCases.length, 0);
    lines.push(chalk.bold(`📊 Summary: ${tests.length} file(s), ${totalTests} test case(s)`));
    
    return lines.join('\n');
}

/**
 * Format test execution progress
 */
export function formatTestExecutionStart(filePath: string, testId?: string, basePath?: string): string {
    const lines: string[] = [];
    
    const relativePath = basePath ? path.relative(basePath, filePath) : filePath;
    
    lines.push('');
    lines.push(chalk.blue(`🚀 Running test: ${relativePath}`));
    
    if (testId) {
        lines.push(chalk.dim(`   Test case: ${testId}`));
    }
    
    lines.push('');
    
    return lines.join('\n');
}

/**
 * Format test execution result (single test)
 */
export function formatTestExecutionResult(exitCode: number | null): string {
    const lines: string[] = [];
    
    if (exitCode === 0) {
        lines.push('');
        lines.push(chalk.green('✓ Test execution completed successfully'));
    } else if (exitCode === null) {
        lines.push('');
        lines.push(chalk.yellow('⚠ Test execution was cancelled'));
    } else {
        lines.push('');
        lines.push(chalk.red(`✗ Test execution failed with exit code: ${exitCode}`));
    }
    
    return lines.join('\n');
}

/**
 * Format multiple test execution results
 */
export function formatMultipleTestResults(results: TestExecutionResult[], basePath?: string): string {
    const lines: string[] = [];
    
    let passCount = 0;
    let failCount = 0;
    
    for (const result of results) {
        const relativePath = basePath ? path.relative(basePath, result.file) : result.file;
        const testInfo = result.testId ? ` (${result.testId})` : '';
        
        if (result.exitCode === 0) {
            lines.push(chalk.green(`✓ ${relativePath}${testInfo}`));
            passCount++;
        } else {
            lines.push(chalk.red(`✗ ${relativePath}${testInfo}`));
            failCount++;
        }
    }
    
    lines.push('');
    
    const summary = failCount > 0
        ? chalk.red(`📊 Summary: ${passCount} passed, ${failCount} failed`)
        : chalk.green(`📊 Summary: ${passCount} passed, ${failCount} failed`);
    
    lines.push(summary);
    
    return lines.join('\n');
}

/**
 * Format parsed test results summary
 */
export function formatTestResultsSummary(summary: TestSummary, environment?: {
    hostname?: string;
    version?: string;
    testVersion?: string;
}): string {
    const lines: string[] = [];
    
    lines.push('');
    lines.push(chalk.bold('📊 Test Results:'));
    lines.push(`   Total tests: ${chalk.bold(summary.total.toString())}`);
    lines.push(`   ${chalk.green('✓')} Passed: ${summary.passed}`);
    lines.push(`   ${chalk.red('✗')} Failed: ${summary.failed}`);
    lines.push(`   ${chalk.yellow('⚠')} Aborted: ${summary.aborted}`);
    lines.push(`   ${chalk.blue('⏱')} Duration: ${summary.duration}ms`);
    
    if (environment) {
        lines.push('');
        lines.push(chalk.dim('   Environment:'));
        if (environment.hostname) {
            lines.push(chalk.dim(`     Host: ${environment.hostname}`));
        }
        if (environment.version) {
            lines.push(chalk.dim(`     Version: ${environment.version}`));
        }
        if (environment.testVersion) {
            lines.push(chalk.dim(`     Test Framework: ${environment.testVersion}`));
        }
    }
    
    return lines.join('\n');
}

/**
 * Format failed test details
 */
export function formatFailedTests(results: Array<{
    testId: string;
    status: 'passed' | 'failed' | 'aborted' | 'skipped';
    message?: string;
    location?: {
        file: string;
        line: number;
    };
}>): string {
    const lines: string[] = [];
    
    const failedTests = results.filter(r => r.status !== 'passed');
    
    if (failedTests.length === 0) {
        return '';
    }
    
    lines.push('');
    lines.push(chalk.red('❌ Failed/Aborted tests:'));
    
    for (const test of failedTests) {
        lines.push('');
        
        const statusColor = test.status === 'aborted' ? chalk.yellow : chalk.red;
        lines.push(`   ${statusColor(test.testId)} - ${statusColor(test.status.toUpperCase())}`);
        
        if (test.message) {
            const messageLines = test.message.split('\n');
            for (const line of messageLines) {
                lines.push(chalk.dim(`     ${line}`));
            }
        }
        
        if (test.location) {
            lines.push(chalk.dim(`     📍 ${test.location.file}:${test.location.line}`));
        }
    }
    
    return lines.join('\n');
}

/**
 * Format complete test result report
 */
export function formatTestReport(
    summary: TestSummary,
    results: Array<{
        testId: string;
        status: 'passed' | 'failed' | 'aborted' | 'skipped';
        message?: string;
        location?: {
            file: string;
            line: number;
        };
    }>,
    environment?: {
        hostname?: string;
        version?: string;
        testVersion?: string;
    }
): string {
    const parts: string[] = [];
    
    parts.push(formatTestResultsSummary(summary, environment));
    
    const failedSection = formatFailedTests(results);
    if (failedSection) {
        parts.push(failedSection);
    }
    
    return parts.join('\n');
}
