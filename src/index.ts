/**
 * WinCC OA Test Runner
 *
 * Headless test execution API and CLI for WinCC OA OaTest framework.
 * Provides test discovery, execution, and result parsing capabilities.
 */

// Export all types
export * from './types/index.js';

// Export discovery API
export { discoverTests, parseSingleTestFile, isTestFile, getDiscoveryStats } from './api/discovery.js';

// Export execution API
export { executeTest, executeMultipleTests, executeTestFiles } from './api/executor.js';

// Export parsing API
export { parseTestResults, parseJsonResults, parseJsonContent, findResultFiles } from './api/parsers/index.js';

// TODO: Export high-level test runner
// export { createTestRunner } from './api/test-runner.js';
