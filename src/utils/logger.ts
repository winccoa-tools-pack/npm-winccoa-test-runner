/**
 * Logger for the test runner library
 *
 * The library never writes to stdout or stderr on its own. A consumer (for
 * example the CLI with --verbose) can register a sink to receive diagnostics.
 */

export type LogSink = (message: string) => void;

let sink: LogSink | undefined;

/**
 * Register a function that receives diagnostic messages, or remove it with `undefined`.
 */
export function setLogger(logger: LogSink | undefined): void {
    sink = logger;
}

/**
 * Send a diagnostic message to the registered sink (no-op without a sink).
 */
export function log(message: string): void {
    sink?.(message);
}

/**
 * Message of an unknown error value.
 */
export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
