#!/bin/bash

# E2E Test Runner Script
# Usage: ./e2e/scripts/run-tests.sh [test-type] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
TEST_TYPE="all"
BROWSER="chromium"
DEBUG=false
HEADLESS=true
VERBOSE=false
REPORT_ONLY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            TEST_TYPE="$2"
            shift 2
            ;;
        -b|--browser)
            BROWSER="$2"
            shift 2
            ;;
        -d|--debug)
            DEBUG=true
            shift
            ;;
        -h|--headed)
            HEADLESS=false
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -r|--report-only)
            REPORT_ONLY=true
            shift
            ;;
        --help)
            echo "E2E Test Runner"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -t, --type TYPE       Test type: all, client, retreat, navigation, forms, payments (default: all)"
            echo "  -b, --browser BROWSER Browser: chromium, firefox, webkit, mobile, tablet (default: chromium)"
            echo "  -d, --debug          Run in debug mode"
            echo "  -h, --headed         Run in headed mode (show browser)"
            echo "  -v, --verbose        Verbose output"
            echo "  -r, --report-only    Only generate reports from existing results"
            echo "  --help               Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --type client --browser chromium"
            echo "  $0 --type retreat --debug --headed"
            echo "  $0 --browser mobile --verbose"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🎭 Starting E2E Test Suite${NC}"
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  Test Type: ${TEST_TYPE}"
echo -e "  Browser: ${BROWSER}"
echo -e "  Debug Mode: ${DEBUG}"
echo -e "  Headed: $(!$HEADLESS && echo "true" || echo "false")"
echo -e "  Verbose: ${VERBOSE}"
echo ""

# Check if report-only mode
if [ "$REPORT_ONLY" = true ]; then
    echo -e "${BLUE}📊 Generating reports only...${NC}"
    npx playwright show-report
    exit 0
fi

# Create reports directory
mkdir -p e2e/reports
mkdir -p e2e/screenshots

# Function to run specific test files
run_test_type() {
    local test_pattern=""

    case $TEST_TYPE in
        "client")
            test_pattern="**/client-management.spec.ts"
            ;;
        "retreat")
            test_pattern="**/retreat-management.spec.ts"
            ;;
        "navigation")
            test_pattern="**/navigation.spec.ts"
            ;;
        "forms")
            test_pattern="**/forms-validation.spec.ts"
            ;;
        "payments")
            test_pattern="**/payments.spec.ts"
            ;;
        "all")
            test_pattern="**/*.spec.ts"
            ;;
        *)
            echo -e "${RED}❌ Unknown test type: ${TEST_TYPE}${NC}"
            echo "Available types: all, client, retreat, navigation, forms, payments"
            exit 1
            ;;
    esac

    echo -e "${BLUE}🔍 Running tests: ${test_pattern}${NC}"
    return 0
}

# Function to check if servers are running
check_servers() {
    echo -e "${BLUE}🔍 Checking if servers are running...${NC}"

    # Check frontend server
    if ! curl -s http://localhost:3000 > /dev/null; then
        echo -e "${RED}❌ Frontend server not running on port 3000${NC}"
        echo -e "${YELLOW}💡 Please start the frontend server with: npm start${NC}"
        exit 1
    fi

    # Check backend server (assuming it's on port 3005)
    if ! curl -s http://localhost:3005 > /dev/null; then
        echo -e "${YELLOW}⚠️  Backend server might not be running on port 3005${NC}"
        echo -e "${YELLOW}💡 Please ensure the API server is running${NC}"
    fi

    echo -e "${GREEN}✅ Frontend server is running${NC}"
}

# Function to install browsers if needed
install_browsers() {
    echo -e "${BLUE}🔧 Checking Playwright browsers...${NC}"
    npx playwright install --with-deps
}

# Function to run tests
run_tests() {
    local test_args=""

    # Add browser project
    test_args="--project=${BROWSER}"

    # Add test pattern if not all
    if [ "$TEST_TYPE" != "all" ]; then
        case $TEST_TYPE in
            "client")
                test_args="${test_args} e2e/client-management.spec.ts"
                ;;
            "retreat")
                test_args="${test_args} e2e/retreat-management.spec.ts"
                ;;
            "navigation")
                test_args="${test_args} e2e/navigation.spec.ts"
                ;;
            "forms")
                test_args="${test_args} e2e/forms-validation.spec.ts"
                ;;
            "payments")
                test_args="${test_args} e2e/payments.spec.ts"
                ;;
        esac
    fi

    # Add debug options
    if [ "$DEBUG" = true ]; then
        test_args="${test_args} --debug"
    fi

    # Add headed option
    if [ "$HEADLESS" = false ]; then
        test_args="${test_args} --headed"
    fi

    # Add verbose option
    if [ "$VERBOSE" = true ]; then
        test_args="${test_args} --verbose"
    fi

    echo -e "${BLUE}🏃 Running Playwright tests...${NC}"
    echo -e "${YELLOW}Command: npx playwright test ${test_args}${NC}"
    echo ""

    if npx playwright test ${test_args}; then
        echo -e "${GREEN}✅ Tests completed successfully!${NC}"
        return 0
    else
        echo -e "${RED}❌ Some tests failed${NC}"
        return 1
    fi
}

# Function to generate reports
generate_reports() {
    echo -e "${BLUE}📊 Generating test reports...${NC}"

    # Generate HTML report
    if [ -f "playwright-report/index.html" ]; then
        echo -e "${GREEN}✅ HTML report available at: playwright-report/index.html${NC}"
    fi

    # Check for JSON report
    if [ -f "e2e/reports/results.json" ]; then
        echo -e "${GREEN}✅ JSON report available at: e2e/reports/results.json${NC}"
    fi

    # Check for JUnit report
    if [ -f "e2e/reports/results.xml" ]; then
        echo -e "${GREEN}✅ JUnit report available at: e2e/reports/results.xml${NC}"
    fi

    # Show summary
    if command -v jq &> /dev/null && [ -f "e2e/reports/results.json" ]; then
        echo -e "${BLUE}📈 Test Summary:${NC}"
        jq -r '.stats | "  Total: \(.expected) | Passed: \(.expected - .unexpected - .skipped) | Failed: \(.unexpected) | Skipped: \(.skipped)"' e2e/reports/results.json
    fi
}

# Main execution
main() {
    # Validate test type
    run_test_type

    # Check servers
    check_servers

    # Install browsers if needed
    install_browsers

    # Run tests
    if run_tests; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        TEST_EXIT_CODE=0
    else
        echo -e "${RED}💥 Some tests failed${NC}"
        TEST_EXIT_CODE=1
    fi

    # Generate reports
    generate_reports

    # Show report
    if [ "$DEBUG" = false ]; then
        echo -e "${BLUE}🔍 Opening test report...${NC}"
        npx playwright show-report &
    fi

    echo -e "${BLUE}✨ Test run completed${NC}"
    exit $TEST_EXIT_CODE
}

# Trap to cleanup on exit
trap 'echo -e "${YELLOW}🧹 Cleaning up...${NC}"' EXIT

# Run main function
main