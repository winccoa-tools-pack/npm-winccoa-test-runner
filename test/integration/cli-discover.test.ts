import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('CLI: "discover" command finds test files', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const testProject = path.join(repoRoot, 'test', 'fixtures', 'projects', 'runnable');

    const distCli = path.join(repoRoot, 'dist', 'cjs', 'cli.js');
    const srcCli = path.join(repoRoot, 'src', 'cli.ts');

    const cliPath = fs.existsSync(distCli) ? distCli : srcCli;
    const nodeArgs =
        cliPath === srcCli
            ? ['--import', 'tsx', cliPath, 'discover', '--project', testProject]
            : [cliPath, 'discover', '--project', testProject];

    const result = spawnSync(process.execPath, nodeArgs, {
        cwd: repoRoot,
        encoding: 'utf8',
    });

    assert.equal(result.status, 0, `Expected exit code 0, got ${result.status}. Stderr: ${result.stderr}`);
    assert.match(result.stdout ?? '', /Discovered 2 test file/);
    assert.match(result.stdout ?? '', /SampleTest/);
    assert.match(result.stdout ?? '', /LegacyTest/);
});

test('CLI: "discover --output json" writes valid JSON to the output file', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'winccoa-test-runner-'));
    const outFile = path.join(outDir, 'discovered.json');
    const repoRoot = path.resolve(__dirname, '..', '..');
    const testProject = path.join(repoRoot, 'test', 'fixtures', 'projects', 'runnable');

    const distCli = path.join(repoRoot, 'dist', 'cjs', 'cli.js');
    const srcCli = path.join(repoRoot, 'src', 'cli.ts');

    const cliPath = fs.existsSync(distCli) ? distCli : srcCli;
    const nodeArgs =
        cliPath === srcCli
            ? ['--import', 'tsx', cliPath, 'discover', '--project', testProject, '--output', 'json', '--output-file', outFile]
            : [cliPath, 'discover', '--project', testProject, '--output', 'json', '--output-file', outFile];

    const result = spawnSync(process.execPath, nodeArgs, {
        cwd: repoRoot,
        encoding: 'utf8',
    });

    assert.equal(result.status, 0);
    
    // Parse JSON output
    const tests = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    fs.rmSync(outDir, { recursive: true, force: true });
    
    assert.equal(tests.length, 2);
    assert.ok(tests.some((t: any) => t.className === 'SampleTest'));
    assert.ok(tests.some((t: any) => t.className === 'LegacyTest'));
    
    // Check SampleTest details
    const sampleTest = tests.find((t: any) => t.className === 'SampleTest');
    assert.equal(sampleTest.testCases.length, 3);
    assert.equal(sampleTest.format, '3.20');
    assert.equal(sampleTest.supportsIndividualTests, true);
    
    // Check LegacyTest details
    const legacyTest = tests.find((t: any) => t.className === 'LegacyTest');
    assert.equal(legacyTest.testCases.length, 2);
    assert.equal(legacyTest.format, '3.19');
    assert.equal(legacyTest.supportsIndividualTests, false);
});
