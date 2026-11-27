import test from 'node:test';
import assert from 'node:assert/strict';
import { runProcess } from '../../src/utils/process.js';
import { log, setLogger } from '../../src/utils/logger.js';

const node = process.execPath;

test('runProcess: returns the exit code', async () => {
    const exitCode = await runProcess(node, ['-e', 'process.exit(3)'], { timeout: 10000 });
    assert.equal(exitCode, 3);
});

test('runProcess: returns null when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const exitCode = await runProcess(node, ['-e', 'setTimeout(() => {}, 60000)'], {
        timeout: 10000,
        signal: controller.signal,
    });
    assert.equal(exitCode, null);
});

test('runProcess: aborting kills the running process', async () => {
    const controller = new AbortController();
    const started = Date.now();

    const run = runProcess(node, ['-e', 'setTimeout(() => {}, 60000)'], {
        timeout: 30000,
        signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 200);

    assert.equal(await run, null);
    assert.ok(Date.now() - started < 20000, 'abort must not wait for the process');
});

test('runProcess: rejects when the timeout is exceeded', async () => {
    await assert.rejects(
        runProcess(node, ['-e', 'setTimeout(() => {}, 60000)'], { timeout: 300 }),
        /timed out/,
    );
});

test('runProcess: rejects when the executable cannot be started', async () => {
    await assert.rejects(
        runProcess('does-not-exist-winccoa-ctrl', [], { timeout: 10000 }),
    );
});

test('logger: silent without sink, forwards messages to the registered sink', () => {
    const messages: string[] = [];

    assert.doesNotThrow(() => log('ignored'));

    setLogger((message) => messages.push(message));
    log('hello');
    setLogger(undefined);
    log('ignored again');

    assert.deepEqual(messages, ['hello']);
});
