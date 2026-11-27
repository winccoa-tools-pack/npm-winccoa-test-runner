import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..');
const runnableProject = path.join(repoRoot, 'test', 'fixtures', 'projects', 'runnable');

function runCli(args: string[]) {
    const distCli = path.join(repoRoot, 'dist', 'cjs', 'cli.js');
    const srcCli = path.join(repoRoot, 'src', 'cli.ts');
    const nodeArgs = fs.existsSync(distCli)
        ? [distCli, ...args]
        : ['--import', 'tsx', srcCli, ...args];

    return spawnSync(process.execPath, nodeArgs, { cwd: repoRoot, encoding: 'utf8' });
}

function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'winccoa-test-runner-'));
}

const fullResult = {
    Environment: { TestVersion: '1.0', Version: '3.20', Hostname: 'host' },
    Time: { Start: '2024-01-01 10:00:00', End: '2024-01-01 10:00:01' },
    Statistic: { Aborted: 0, Failed: 0, Passed: 1 },
    TestCases: [{ TcId: 'SampleTest.testOk', Result: 'Pass', Duration: 1 }],
};

test('CLI: "parse --output json --output-file" writes the report to a file only', () => {
    const dir = makeTempDir();
    try {
        const resultFile = path.join(dir, 'fullResult.json');
        const reportFile = path.join(dir, 'report', 'out.json');
        fs.writeFileSync(resultFile, JSON.stringify(fullResult));

        const result = runCli([
            'parse',
            '--project',
            dir,
            '--result-file',
            resultFile,
            '--output',
            'json',
            '--output-file',
            reportFile,
        ]);

        assert.equal(result.status, 0, `stderr: ${result.stderr}`);
        const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
        assert.equal(report.summary.passed, 1);
        assert.throws(() => JSON.parse(result.stdout), 'stdout must not carry the report');
        assert.ok(!result.stderr.includes('[test-runner]'), 'no library output without --verbose');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('CLI: "parse --output junit --output-file" writes JUnit XML to a file', () => {
    const dir = makeTempDir();
    try {
        const resultFile = path.join(dir, 'fullResult.json');
        const reportFile = path.join(dir, 'junit.xml');
        fs.writeFileSync(resultFile, JSON.stringify(fullResult));

        const result = runCli([
            'parse',
            '--project',
            dir,
            '--result-file',
            resultFile,
            '--output',
            'junit',
            '--output-file',
            reportFile,
        ]);

        assert.equal(result.status, 0, `stderr: ${result.stderr}`);
        assert.match(fs.readFileSync(reportFile, 'utf8'), /<testsuite/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('CLI: "discover --output json --output-file" writes the list to a file', () => {
    const dir = makeTempDir();
    try {
        const reportFile = path.join(dir, 'discovered.json');

        const result = runCli([
            'discover',
            '--project',
            runnableProject,
            '--output',
            'json',
            '--output-file',
            reportFile,
        ]);

        assert.equal(result.status, 0, `stderr: ${result.stderr}`);
        const tests = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
        assert.equal(tests.length, 2);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
