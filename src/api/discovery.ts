/**
 * Test Discovery API
 * Provides functions to discover WinCC OA test files and extract test cases
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TestFile, DiscoveryOptions } from '../types/index.js';
import { parseTestFile, containsOaTest } from '../utils/test-parser.js';

/**
 * Discover all test files in a directory
 * 
 * @param options - Discovery options
 * @returns Array of discovered test files
 * 
 * @example
 * ```typescript
 * const tests = await discoverTests({
 *     rootPath: '/path/to/project',
 *     subdirectory: 'scripts/tests',
 *     filePattern: '**\/*.ctl'
 * });
 * 
 * console.log(`Found ${tests.length} test files`);
 * tests.forEach(test => {
 *     console.log(`${test.className}: ${test.testCases.length} tests`);
 * });
 * ```
 */
export async function discoverTests(options: DiscoveryOptions): Promise<TestFile[]> {
    const {
        rootPath,
        subdirectory = 'scripts',
        filePattern = '**/*.ctl',
        includeSubprojects = true,
    } = options;

    // Determine search directory
    const searchPath = subdirectory
        ? path.join(rootPath, subdirectory)
        : rootPath;

    // Check if search path exists
    try {
        await fs.access(searchPath);
    } catch {
        console.warn(`Search path does not exist: ${searchPath}`);
        return [];
    }

    // Find all .ctl files recursively
    const ctlFiles = await findCtlFiles(searchPath);

    // Parse each file and filter out non-test files
    const tests: TestFile[] = [];
    
    for (const filePath of ctlFiles) {
        const testFile = await parseTestFile(filePath);
        if (testFile) {
            tests.push(testFile);
        }
    }

    return tests;
}

/**
 * Parse a single test file
 * 
 * @param filePath - Absolute path to the test file
 * @returns Parsed test file or null if not a valid test file
 * 
 * @example
 * ```typescript
 * const testFile = await parseSingleTestFile('/path/to/MyTest.ctl');
 * 
 * if (testFile) {
 *     console.log(`Class: ${testFile.className}`);
 *     console.log(`Tests: ${testFile.testCases.map(t => t.id).join(', ')}`);
 *     console.log(`Supports individual execution: ${testFile.supportsIndividualTests}`);
 * }
 * ```
 */
export async function parseSingleTestFile(filePath: string): Promise<TestFile | null> {
    return parseTestFile(filePath);
}

/**
 * Check if a file is a test file (quick check without full parsing)
 * 
 * @param filePath - Path to check
 * @returns true if file contains OaTest classes
 * 
 * @example
 * ```typescript
 * if (await isTestFile('/path/to/file.ctl')) {
 *     const testFile = await parseSingleTestFile('/path/to/file.ctl');
 *     // ... process test file
 * }
 * ```
 */
export async function isTestFile(filePath: string): Promise<boolean> {
    return containsOaTest(filePath);
}

/**
 * Recursively find all .ctl files in a directory
 */
async function findCtlFiles(dirPath: string): Promise<string[]> {
    const ctlFiles: string[] = [];

    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                // Recursively search subdirectories
                const subFiles = await findCtlFiles(fullPath);
                ctlFiles.push(...subFiles);
            } else if (entry.isFile() && entry.name.endsWith('.ctl')) {
                ctlFiles.push(fullPath);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
    }

    return ctlFiles;
}

/**
 * Get test statistics from discovered tests
 * 
 * @param tests - Array of test files
 * @returns Statistics about the discoveries tests
 * 
 * @example
 * ```typescript
 * const tests = await discoverTests({ rootPath: '/path/to/project' });
 * const stats = getDiscoveryStats(tests);
 * 
 * console.log(`Files: ${stats.totalFiles}`);
 * console.log(`Total tests: ${stats.totalTestCases}`);
 * console.log(`Individual execution support: ${stats.filesWithIndividualSupport}/${stats.totalFiles}`);
 * ```
 */
export function getDiscoveryStats(tests: TestFile[]) {
    return {
        totalFiles: tests.length,
        totalTestCases: tests.reduce((sum, file) => sum + file.testCases.length, 0),
        filesWithIndividualSupport: tests.filter(f => f.supportsIndividualTests).length,
        format319Count: tests.filter(f => f.format === '3.19').length,
        format320Count: tests.filter(f => f.format === '3.20').length,
        formatMixedCount: tests.filter(f => f.format === 'mixed').length,
    };
}
