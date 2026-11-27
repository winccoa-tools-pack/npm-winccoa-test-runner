/**
 * Process helper
 * Starts a process and stops it on abort or timeout.
 */

import { spawn } from 'child_process';

export interface RunProcessOptions {
    /**
     * Timeout in milliseconds. The process is killed and the promise rejects when exceeded.
     */
    timeout: number;

    /**
     * Abort signal. The process is killed and the promise resolves with `null`.
     */
    signal?: AbortSignal;

    /**
     * Additional environment variables
     */
    env?: Record<string, string>;
}

/**
 * Run a process to completion.
 *
 * @returns exit code, or `null` when the run was aborted
 * @throws Error when the process cannot be started or the timeout is exceeded
 */
export function runProcess(
    executable: string,
    args: string[],
    options: RunProcessOptions,
): Promise<number | null> {
    return new Promise((resolve, reject) => {
        const { signal, timeout } = options;

        if (signal?.aborted) {
            resolve(null);
            return;
        }

        const child = spawn(executable, args, {
            stdio: 'ignore',
            windowsHide: true,
            env: options.env ? { ...process.env, ...options.env } : process.env,
        });

        let settled = false;

        function settle(finish: () => void): void {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            finish();
        }

        function onAbort(): void {
            child.kill();
            settle(() => resolve(null));
        }

        function onTimeout(): void {
            child.kill();
            settle(() => reject(new Error(`Process timed out after ${timeout} ms`)));
        }

        const timer = setTimeout(onTimeout, timeout);
        signal?.addEventListener('abort', onAbort, { once: true });
        child.once('error', (error) => settle(() => reject(error)));
        child.once('close', (code) => settle(() => resolve(code ?? -1)));
    });
}
