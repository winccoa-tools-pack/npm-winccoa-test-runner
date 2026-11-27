import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Utility functions for managing WinCC OA test result files
 */

const FULL_RESULT_FILE = 'fullResult.json';
const QUICK_RESULT_FILE = 'quickResult.json';

/**
 * Create empty result files in project root before test execution
 * WinCC OA expects these files to exist and will write results to them
 *
 * @param projectPath Path to WinCC OA project root
 */
export async function createResultFiles(projectPath: string): Promise<void> {
    const fullResultPath = path.join(projectPath, FULL_RESULT_FILE);
    const quickResultPath = path.join(projectPath, QUICK_RESULT_FILE);

    // Create empty JSON objects
    await fs.writeFile(fullResultPath, '{}', 'utf-8');
    await fs.writeFile(quickResultPath, '{}', 'utf-8');
}

/**
 * Delete result files after parsing (cleanup)
 *
 * @param projectPath Path to WinCC OA project root
 */
export async function deleteResultFiles(projectPath: string): Promise<void> {
    const fullResultPath = path.join(projectPath, FULL_RESULT_FILE);
    const quickResultPath = path.join(projectPath, QUICK_RESULT_FILE);

    try {
        await fs.unlink(fullResultPath);
    } catch {
        // Ignore if file doesn't exist
    }

    try {
        await fs.unlink(quickResultPath);
    } catch {
        // Ignore if file doesn't exist
    }
}

/**
 * Check if result files exist in project root
 *
 * @param projectPath Path to WinCC OA project root
 * @returns True if fullResult.json exists
 */
export async function resultFilesExist(projectPath: string): Promise<boolean> {
    const fullResultPath = path.join(projectPath, FULL_RESULT_FILE);

    try {
        await fs.access(fullResultPath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get path to fullResult.json
 *
 * @param projectPath Path to WinCC OA project root
 * @returns Full path to fullResult.json
 */
export function getFullResultPath(projectPath: string): string {
    return path.join(projectPath, FULL_RESULT_FILE);
}

/**
 * Get path to quickResult.json
 *
 * @param projectPath Path to WinCC OA project root
 * @returns Full path to quickResult.json
 */
export function getQuickResultPath(projectPath: string): string {
    return path.join(projectPath, QUICK_RESULT_FILE);
}
