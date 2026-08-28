/**
 * Test Result Parsers API
 * Entry point for all result parsing functions
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { TestRunResult, ParseOptions, ParseFormat } from '../../types/index.js';
import { parseJsonResults } from './json-parser.js';

// Re-export specific parsers
export { parseJsonResults } from './json-parser.js';
// TODO: Add log parser when implemented
// export { parseLogFile } from './log-parser.js';

/**
 * Parse test results from a file (auto-detects format)
 *
 * @param options - Parse options
 * @returns Parsed test results
 *
 * @example
 * ```typescript
 * // Auto-detect format
 * const result = await parseTestResults({
 *     resultPath: '/path/to/project/fullResult.json'
 * });
 *
 * // Force specific format
 * const result2 = await parseTestResults({
 *     resultPath: '/path/to/project/result.log',
 *     format: 'log'
 * });
 * ```
 */
export async function parseTestResults(options: ParseOptions): Promise<TestRunResult> {
    const { resultPath, format = 'auto' } = options;

    // Determine format
    let detectedFormat: ParseFormat = format;

    if (format === 'auto') {
        detectedFormat = detectFormat(resultPath);
    }

    console.log(`[ResultParser] Parsing ${resultPath} as ${detectedFormat}`);

    // Parse based on format
    switch (detectedFormat) {
        case 'json':
            return parseJsonResults(resultPath);

        case 'log':
            // TODO: Implement log parser
            throw new Error('Log format parsing not yet implemented');

        default:
            throw new Error(`Unknown format: ${detectedFormat}`);
    }
}

/**
 * Detect format from file path/extension
 */
function detectFormat(filePath: string): 'json' | 'log' {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.json') {
        return 'json';
    }

    if (ext === '.log' || path.basename(filePath).includes('.log')) {
        return 'log';
    }

    // Default to JSON (fullResult.json is most common)
    return 'json';
}

/**
 * Find result files in a project directory
 *
 * @param projectPath - Path to WinCC OA project
 * @returns Paths to found result files
 *
 * @example
 * ```typescript
 * const files = await findResultFiles('/path/to/project');
 *
 * if (files.fullResult) {
 *     const result = await parseJsonResults(files.fullResult);
 * }
 * ```
 */
export async function findResultFiles(projectPath: string): Promise<{
    fullResult?: string;
    quickResult?: string;
    logFiles?: string[];
}> {
    const result: {
        fullResult?: string;
        quickResult?: string;
        logFiles?: string[];
    } = {};

    try {
        // Check for fullResult.json
        const fullResultPath = path.join(projectPath, 'fullResult.json');
        try {
            await fs.access(fullResultPath);
            result.fullResult = fullResultPath;
        } catch {
            // File doesn't exist, skip
        }

        // Check for quickResult.json
        const quickResultPath = path.join(projectPath, 'quickResult.json');
        try {
            await fs.access(quickResultPath);
            result.quickResult = quickResultPath;
        } catch {
            // File doesn't exist, skip
        }

        // TODO: Find log files in log/ directory
        result.logFiles = [];
    } catch (error) {
        console.error(`[ResultParser] Error finding result files in ${projectPath}:`, error);
    }

    return result;
}
