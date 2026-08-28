# WinCC OA Test Runner ![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)

A headless test execution API and CLI for the SIMATIC WinCC Open Architecture OaTest framework. Designed for CI/CD pipelines, automated testing, and AI-driven test orchestration.

Part of the [winccoa-tools-pack](https://github.com/winccoa-tools-pack) ecosystem - modern development tooling for WinCC OA.

## ✨ Features

- **🔍 Test Discovery**: Automatically find and parse OaTest files in your project
  - Supports both 3.19 (`getAllTestCaseIds()`) and 3.20 (`public int test*()`) formats
  - Detects individual test execution capability
  - Maps test cases with metadata

- **🚀 Test Execution**: Run tests programmatically or via CLI
  - Single test file execution
  - Individual test case execution (when supported)
  - Bulk test execution with filters
  - Serialized queue prevents WinCC OA JSON conflicts

- **📊 Result Parsing**: Parse fullResult.json output from WinCC OA
  - Structured test results with status, duration, messages
  - Location information for failed tests
  - Environment metadata (hostname, version, test framework version)

- **🎨 Multiple Output Formats**:
  - **Console**: Colorful terminal output with emojis (powered by chalk)
  - **JSON**: Structured data for programmatic processing
  - **JUnit XML**: CI/CD integration (Jenkins, Azure DevOps, GitHub Actions)

- **📚 Library + CLI**: Use as API in your code or as standalone CLI tool
  - Headless execution for CI/CD
  - Perfect for AI-driven test automation
  - Can be integrated into VS Code extensions

## 📦 Installation

```shell
npm install @winccoa-tools-pack/test-runner
```

Or globally for CLI usage:

```shell
npm install -g @winccoa-tools-pack/test-runner
```

## 🖥 CLI Usage

### Discover Tests

Find all test files in your WinCC OA project:

```shell
# Discover tests in current directory
winccoa-test discover

# Discover in specific project
winccoa-test discover --project /path/to/project

# Output as JSON
winccoa-test discover --output json

# Verbose output (list all test cases)
winccoa-test discover --verbose
```

### Run Tests

Execute tests headlessly:

```shell
# Run a specific test file
winccoa-test run --file scripts/MyTest.ctl --project /path/to/project

# Run a single test case
winccoa-test run --file scripts/MyTest.ctl --test testAddition

# Run all tests in project
winccoa-test run --all --project /path/to/project

# Specify WinCC OA installation and version
winccoa-test run --file scripts/MyTest.ctl \
  --install-path /opt/WinCC_OA \
  --oa-version 3.20

# Get results in JSON format
winccoa-test run --all --output-format json

# Get results in JUnit XML (for CI/CD)
winccoa-test run --all --output-format junit > test-results.xml
```

### Parse Results

Parse existing test results:

```shell
# Parse fullResult.json from project
winccoa-test parse --project /path/to/project

# Parse specific result file
winccoa-test parse --result-file /path/to/fullResult.json

# Output as JUnit XML (for CI/CD)
winccoa-test parse --output junit > test-results.xml
```

## 🧩 API Usage

Use the test runner programmatically in your Node.js/TypeScript projects:

### Discovery API

```typescript
import { discoverTests, parseSingleTestFile } from '@winccoa-tools-pack/test-runner';

// Discover all tests in a project
const tests = await discoverTests({
    rootPath: '/path/to/project',
    subdirectory: 'scripts',
});

console.log(`Found ${tests.length} test files`);

for (const test of tests) {
    console.log(`- ${test.className}: ${test.testCases.length} tests`);
    console.log(`  Format: ${test.format}`);
    console.log(`  Individual execution: ${test.supportsIndividualTests}`);
}

// Parse a single test file
const testFile = await parseSingleTestFile('/path/to/MyTest.ctl');
if (testFile) {
    console.log(`Class: ${testFile.className}`);
    console.log(`Tests: ${testFile.testCases.map(tc => tc.id).join(', ')}`);
}
```

### Execution API

```typescript
import { executeTest, executeTestFiles } from '@winccoa-tools-pack/test-runner';

// Execute a single test
const exitCode = await executeTest(
    '/path/to/MyTest.ctl',
    {
        projectPath: '/path/to/project',
        installPath: '/opt/WinCC_OA',
        version: '3.20',
        timeout: 60000,
    },
    'testAddition' // Optional: specific test case ID
);

console.log(`Test exited with code: ${exitCode}`);

// Execute multiple tests
const results = await executeTestFiles(
    tests, // From discovery
    {
        projectPath: '/path/to/project',
        timeout: 120000,
    }
);

for (const result of results) {
    console.log(`${result.file}: ${result.exitCode === 0 ? 'PASS' : 'FAIL'}`);
}
```

### Parsing API

```typescript
import { parseTestResults, findResultFiles } from '@winccoa-tools-pack/test-runner';

// Find result files in project
const resultFiles = await findResultFiles('/path/to/project');
console.log(`fullResult.json: ${resultFiles.fullResult}`);

// Parse test results
const result = await parseTestResults({
    resultPath: resultFiles.fullResult,
    projectPath: '/path/to/project',
});

console.log(`Total: ${result.summary.total}`);
console.log(`Passed: ${result.summary.passed}`);
console.log(`Failed: ${result.summary.failed}`);

for (const test of result.results) {
    if (test.status !== 'passed') {
        console.log(`FAILED: ${test.testId}`);
        console.log(`  ${test.message}`);
        if (test.location) {
            console.log(`  at ${test.location.file}:${test.location.line}`);
        }
    }
}
```

### Formatters

```typescript
import { 
    formatDiscoveredTests, 
    formatTestReportJUnit 
} from '@winccoa-tools-pack/test-runner';

// Console output
const consoleOutput = formatDiscoveredTests(tests, '/path/to/project');
console.log(consoleOutput);

// JUnit XML for CI/CD
const junitXml = formatTestReportJUnit(
    result.summary,
    result.results,
    'My Test Suite'
);
fs.writeFileSync('test-results.xml', junitXml);
```

## 🤖 AI Integration

This tool is designed for AI-driven test automation:

```typescript
// Example: AI agent discovers and runs tests
async function aiTestRunner(projectPath: string) {
    // 1. Discover tests
    const tests = await discoverTests({ rootPath: projectPath });
    
    // 2. Run all tests
    const results = await executeTestFiles(tests, { projectPath });
    
    // 3. Parse results
    const resultFiles = await findResultFiles(projectPath);
    const parsed = await parseTestResults({
        resultPath: resultFiles.fullResult,
        projectPath,
    });
    
    // 4. Report to AI
    return {
        discovered: tests.length,
        executed: results.length,
        passed: parsed.summary.passed,
        failed: parsed.summary.failed,
        failures: parsed.results
            .filter(r => r.status === 'failed')
            .map(r => ({
                test: r.testId,
                message: r.message,
                location: r.location,
            })),
    };
}
```

## 🏗️ CI/CD Integration

### GitHub Actions Example

```yaml
name: Run Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install -g @winccoa-tools-pack/test-runner
      
      - name: Run tests
        run: |
          winccoa-test run --all \
            --project ./my-project \
            --output-format junit > test-results.xml
      
      - name: Publish Test Results
        uses: EnricoMi/publish-unit-test-result-action@v2
        if: always()
        with:
          files: test-results.xml
```

### Jenkins Pipeline Example

```groovy
pipeline {
    agent any
    stages {
        stage('Test') {
            steps {
                sh '''
                    npm install -g @winccoa-tools-pack/test-runner
                    winccoa-test run --all \
                        --project ./my-project \
                        --output-format junit > test-results.xml
                '''
            }
        }
    }
    post {
        always {
            junit 'test-results.xml'
        }
    }
}
```

## 📋 Test Formats Supported

### WinCC OA 3.19 Format

```cpp
class MyTest : OaTest
{
    public:
        // Define test cases
        public dyn_string getAllTestCaseIds()
        {
            return makeDynString("testCase1", "testCase2");
        }

        // Test implementations
        public void testCase1()
        {
            // Test code
        }

        public void testCase2()
        {
            // Test code
        }
};

main()
{
    testlib.runTestClass("MyTest");
}
```

### WinCC OA 3.20 Format

```cpp
class MyTest : OaTest
{
    public:
        // Test method pattern: public int test*()
        public int testAddition()
        {
            int result = 1 + 1;
            assertEqualsInt(2, result);
            return 0;
        }

        public int testSubtraction()
        {
            int result = 5 - 3;
            assertEqualsInt(2, result);
            return 0;
        }
};

// Varargs signature enables individual test execution
main(...)
{
    testlib.runTestClass("MyTest");
}
```

## 🩺 Troubleshooting

### Tests not discovered

- Ensure your test files are in the `scripts/` directory (or specify with `--subdirectory`)
- Check that test classes inherit from `OaTest`
- Verify test patterns: `getAllTestCaseIds()` (3.19) or `public int test*()` (3.20)

### Individual tests not executable

- Ensure `main(...)` signature with varargs (3 dots)
- Only 3.20 format with `main(...)` supports individual test execution

### Test execution fails

- Verify `--project` path points to valid WinCC OA project
- Check `--install-path` if WinCC OA is not in PATH
- Increase `--timeout` for long-running tests

### Result parsing fails

- Ensure WinCC OA test framework generated `fullResult.json`
- Check file permissions and paths
- Verify test execution completed successfully

## 📚 Ecosystem Integration

This package works seamlessly with:

- **vscode-winccoa-tests**: VS Code extension that uses this library for test discovery and execution
- **npm-winccoa-core**: Core utilities for WinCC OA component interaction
- Other winccoa-tools-pack projects

## 📦 Development

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Lint code
npm run lint
```

## 🏆 Recognition

Special thanks to all our [contributors](https://github.com/orgs/winccoa-tools-pack/people) who make this project possible!

### Key Contributors

- **Richard Janisch** ([@RichardJanisch](https://github.com/RichardJanisch)) - Creator & Lead Developer
- **Martin Pokorny** ([@mPokornyETM](https://github.com/mPokornyETM)) - Core Infrastructure & Ecosystem Architect

---

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## ⚠️ Disclaimer

**WinCC OA** and **Siemens** are trademarks of Siemens AG.
This project is not affiliated with, endorsed by, or sponsored by Siemens AG.
This is a community-driven open source project created to enhance the development experience for WinCC OA developers.

---

## 🎉 Thank You

Thank you for using WinCC OA Test Runner! We're excited to be part of your development and testing journey.

Happy Testing! 🚀

---

Made with ❤️ for and by the WinCC OA community
