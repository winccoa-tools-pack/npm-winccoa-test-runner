/**
 * Utility functions for parsing WinCC OA test files
 * Ported from vscode-winccoa-tests extension
 */

import * as fs from 'fs/promises';
import { TestFile } from '../types/index.js';

/**
 * Internal representation of a parsed test class
 */
interface ParsedTestClass {
    className: string;
    line: number;
    testCases: Array<{ id: string; line?: number }>;
}

/**
 * Regular expression patterns for parsing test files
 */
const PATTERNS = {
    /** Matches: class ClassName : OaTest */
    CLASS: /class\s+(\w+)\s*:\s*OaTest/g,

    /** Matches: getAllTestCaseIds() { ... } (3.19 format) */
    GET_ALL_TEST_CASE_IDS: /getAllTestCaseIds\s*\(\s*\)\s*\{([^}]+)\}/s,

    /** Matches: makeDynString(...) */
    MAKE_DYN_STRING: /makeDynString\s*\(([\s\S]*?)\)/,

    /** Matches: "string literal" */
    STRING_LITERAL: /"([^"]+)"/g,

    /** Matches: public int testXxx() (3.20 format) */
    TEST_METHOD: /public\s+int\s+(test\w*)\s*\(/gm,

    /** Matches: main(...) with varargs */
    MAIN_WITH_VARARGS: /\b(void\s+)?main\s*\(\s*\.\.\.\s*\)/,

    /** Quick check for OaTest presence */
    OATEST_QUICK: /:\s*OaTest/,
};

/**
 * Parse a CTRL test file and extract test information
 *
 * @param filePath - Absolute path to the .ctl file
 * @returns TestFile object or null if no tests found
 */
export async function parseTestFile(filePath: string): Promise<TestFile | null> {
    try {
        // Read file content
        const content = await fs.readFile(filePath, 'utf-8');

        // Quick check if file contains OaTest classes
        if (!PATTERNS.OATEST_QUICK.test(content)) {
            return null;
        }

        // Find all test classes
        const testClasses = findTestClasses(content);

        if (testClasses.length === 0) {
            return null;
        }

        // For now, we only support single class per file
        // (matching VS Code extension behavior)
        const testClass = testClasses[0];

        // Check if file supports individual test execution
        const supportsIndividualTests = checkSupportsIndividualTests(content);

        // Determine format
        const format = determineFormat(content);

        return {
            path: filePath,
            className: testClass.className,
            testCases: testClass.testCases.map((tc) => ({
                id: tc.id,
                method: format === '3.20' ? tc.id : undefined,
            })),
            supportsIndividualTests,
            format,
        };
    } catch (error) {
        console.error(`Failed to parse test file ${filePath}:`, error);
        return null;
    }
}

/**
 * Quick check if a file contains OaTest classes
 *
 * @param filePath - Path to check
 * @returns true if file likely contains tests
 */
export async function containsOaTest(filePath: string): Promise<boolean> {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return PATTERNS.OATEST_QUICK.test(content);
    } catch {
        return false;
    }
}

/**
 * Find all test classes in file content
 */
function findTestClasses(content: string): ParsedTestClass[] {
    const testClasses: ParsedTestClass[] = [];

    // Find all classes that inherit from OaTest
    let match;
    PATTERNS.CLASS.lastIndex = 0;

    while ((match = PATTERNS.CLASS.exec(content)) !== null) {
        const className = match[1];
        const classPosition = match.index;

        // Find line number
        const line = content.substring(0, classPosition).split('\n').length;

        // Extract class body
        const classBodyInfo = extractClassBody(content, classPosition);

        // Find test cases in class body
        const testCases = extractTestCases(classBodyInfo.body, classBodyInfo.startLine);

        if (testCases.length > 0) {
            testClasses.push({
                className,
                line,
                testCases,
            });
        }
    }

    return testClasses;
}

/**
 * Extract class body using brace matching
 */
function extractClassBody(
    content: string,
    startPosition: number,
): { body: string; startLine: number } {
    let braceCount = 0;
    const startBrace = content.indexOf('{', startPosition);

    if (startBrace === -1) {
        return { body: '', startLine: 0 };
    }

    // Calculate the line number where the class body starts
    const startLine = content.substring(0, startBrace).split('\n').length;

    let endBrace = startBrace;
    for (let i = startBrace; i < content.length; i++) {
        if (content[i] === '{') {
            braceCount++;
        } else if (content[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                endBrace = i;
                break;
            }
        }
    }

    return {
        body: content.substring(startBrace, endBrace + 1),
        startLine,
    };
}

/**
 * Extract test cases from class body
 * Supports both 3.19 and 3.20 formats
 */
function extractTestCases(
    classBody: string,
    classBodyStartLine: number,
): Array<{ id: string; line?: number }> {
    // Try 3.19 format first (getAllTestCaseIds method)
    const testCases319 = extractTestCases319(classBody, classBodyStartLine);
    if (testCases319.length > 0) {
        return testCases319;
    }

    // Try 3.20 format (public int test*() methods)
    const testCases320 = extractTestCases320(classBody, classBodyStartLine);
    if (testCases320.length > 0) {
        return testCases320;
    }

    return [];
}

/**
 * Extract test cases from getAllTestCaseIds method (3.19 format)
 */
function extractTestCases319(
    classBody: string,
    classBodyStartLine: number,
): Array<{ id: string; line?: number }> {
    const testCases: Array<{ id: string; line?: number }> = [];

    // Find getAllTestCaseIds method
    const methodMatch = PATTERNS.GET_ALL_TEST_CASE_IDS.exec(classBody);
    if (!methodMatch) {
        return testCases;
    }

    const methodBody = methodMatch[1];

    // Find makeDynString call
    const makeDynStringMatch = PATTERNS.MAKE_DYN_STRING.exec(methodBody);
    if (!makeDynStringMatch) {
        return testCases;
    }

    const argumentsString = makeDynStringMatch[1];

    // Extract all string literals
    let stringMatch;
    PATTERNS.STRING_LITERAL.lastIndex = 0;

    while ((stringMatch = PATTERNS.STRING_LITERAL.exec(argumentsString)) !== null) {
        const testCaseId = stringMatch[1];

        // Find the line number of the corresponding case statement
        const caseLine = findCaseLineNumber(classBody, testCaseId, classBodyStartLine);

        testCases.push({
            id: testCaseId,
            line: caseLine,
        });
    }

    return testCases;
}

/**
 * Extract test cases from public test methods (3.20 format)
 */
function extractTestCases320(
    classBody: string,
    classBodyStartLine: number,
): Array<{ id: string; line?: number }> {
    const testCases: Array<{ id: string; line?: number }> = [];

    // Find all public int test*() methods
    let match;
    PATTERNS.TEST_METHOD.lastIndex = 0;

    while ((match = PATTERNS.TEST_METHOD.exec(classBody)) !== null) {
        const methodName = match[1];
        const matchPosition = match.index;

        // Calculate absolute line number
        const linesBeforeMatch = classBody.substring(0, matchPosition).split('\n').length;
        const absoluteLine = classBodyStartLine + linesBeforeMatch - 1;

        testCases.push({
            id: methodName,
            line: absoluteLine,
        });
    }

    return testCases;
}

/**
 * Find the line number of a case statement in the switch
 */
function findCaseLineNumber(
    classBody: string,
    testCaseId: string,
    classBodyStartLine: number,
): number | undefined {
    // Pattern: case "testCaseId":
    const casePattern = new RegExp(
        `case\\s+"${testCaseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`,
        'm',
    );
    const match = casePattern.exec(classBody);

    if (match) {
        // Count lines before the match within class body
        const linesBeforeMatchInBody = classBody.substring(0, match.index).split('\n').length;
        // Add to class body start line to get absolute line number
        return classBodyStartLine + linesBeforeMatchInBody - 1;
    }

    return undefined;
}

/**
 * Check if file supports individual test execution
 * Requires: main(...) function with varargs
 */
function checkSupportsIndividualTests(content: string): boolean {
    return PATTERNS.MAIN_WITH_VARARGS.test(content);
}

/**
 * Determine the test format used in the file
 */
function determineFormat(content: string): '3.19' | '3.20' | 'mixed' {
    const has319 = PATTERNS.GET_ALL_TEST_CASE_IDS.test(content);
    const has320 = PATTERNS.TEST_METHOD.test(content);

    if (has319 && has320) {
        return 'mixed';
    }
    if (has320) {
        return '3.20';
    }
    if (has319) {
        return '3.19';
    }

    return '3.20'; // default
}
