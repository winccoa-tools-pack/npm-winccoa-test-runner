import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { discoverTests, parseSingleTestFile, isTestFile } from '../../src/api/discovery.js';

test('discoverTests: finds test files in fixture project', async () => {
    const testProject = path.resolve(__dirname, '..', 'fixtures', 'projects', 'runnable');

    const tests = await discoverTests({
        rootPath: testProject,
        subdirectory: 'scripts',
    });

    assert.equal(tests.length, 2);
    assert.ok(tests.some(t => t.className === 'SampleTest'));
    assert.ok(tests.some(t => t.className === 'LegacyTest'));
});

test('parseSingleTestFile: parses 3.20 format test', async () => {
    const testFile = path.resolve(__dirname, '..', 'fixtures', 'projects', 'runnable', 'scripts', 'SampleTest.ctl');

    const result = await parseSingleTestFile(testFile);

    assert.ok(result !== null);
    assert.equal(result.className, 'SampleTest');
    assert.equal(result.format, '3.20');
    assert.equal(result.supportsIndividualTests, true);
    assert.equal(result.testCases.length, 3);
    assert.ok(result.testCases.some(tc => tc.id === 'testAddition'));
    assert.ok(result.testCases.some(tc => tc.id === 'testSubtraction'));
    assert.ok(result.testCases.some(tc => tc.id === 'testFailingCase'));
});

test('parseSingleTestFile: parses 3.19 format test', async () => {
    const testFile = path.resolve(__dirname, '..', 'fixtures', 'projects', 'runnable', 'scripts', 'LegacyTest.ctl');

    const result = await parseSingleTestFile(testFile);

    assert.ok(result !== null);
    assert.equal(result.className, 'LegacyTest');
    assert.equal(result.format, '3.19');
    assert.equal(result.supportsIndividualTests, false);
    assert.equal(result.testCases.length, 2);
    assert.ok(result.testCases.some(tc => tc.id === 'testBasic'));
    assert.ok(result.testCases.some(tc => tc.id === 'testAdvanced'));
});

test('isTestFile: validates .ctl files', async () => {
    const sampleTest = path.resolve(__dirname, '..', 'fixtures', 'projects', 'runnable', 'scripts', 'SampleTest.ctl');
    const legacyTest = path.resolve(__dirname, '..', 'fixtures', 'projects', 'runnable', 'scripts', 'LegacyTest.ctl');
    
    assert.equal(await isTestFile(sampleTest), true);
    assert.equal(await isTestFile(legacyTest), true);
    
    // Non-existent file
    const nonExistent = path.resolve(__dirname, '..', 'fixtures', 'projects', 'runnable', 'scripts', 'NonExistent.ctl');
    assert.equal(await isTestFile(nonExistent), false);
});
