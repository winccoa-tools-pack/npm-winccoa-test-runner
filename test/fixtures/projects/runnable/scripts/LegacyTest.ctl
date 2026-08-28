/**
 * Sample test file for legacy format
 * Format: WinCC OA 3.19 (getAllTestCaseIds with makeDynString)
 */

class LegacyTest : OaTest
{
    public:
        // Get all test case IDs in 3.19 format
        public dyn_string getAllTestCaseIds()
        {
            return makeDynString("testBasic", "testAdvanced");
        }

        // Test basic functionality
        public void testBasic()
        {
            int result = 10 * 2;
            assertEqualsInt(20, result);
        }

        // Test advanced functionality
        public void testAdvanced()
        {
            string text = "Hello";
            assertEqualsString("Hello", text);
        }
};

// Main function without varargs (cannot run individual tests)
main()
{
    testlib.runTestClass("LegacyTest");
}
