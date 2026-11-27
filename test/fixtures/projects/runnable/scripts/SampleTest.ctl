/**
 * Sample test file for testing discovery and parsing
 * Format: WinCC OA 3.20 (public int test* methods)
 */

class SampleTest : OaTest
{
    public:
        // Example test method
        public int testAddition()
        {
            int result = 1 + 1;
            assertEqualsInt(2, result);
            return 0;
        }

        // Another test method
        public int testSubtraction()
        {
            int result = 5 - 3;
            assertEqualsInt(2, result);
            return 0;
        }

        // Failed test example
        public int testFailingCase()
        {
            int result = 1 + 1;
            assertEqualsInt(3, result); // Intentionally wrong
            return 0;
        }
};

// Main function with varargs signature (required for individual test execution)
main(...)
{
    testlib.runTestClass("SampleTest");
}
