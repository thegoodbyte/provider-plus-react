# 🎭 End-to-End Testing Suite

This directory contains the comprehensive E2E testing suite for the Provider Plus application using Playwright.

## 📋 Test Coverage

Our E2E tests cover the following key areas:

### 🧑‍💼 Client Management (`client-management.spec.ts`)
- Client creation with display_id auto-generation
- Display_id validation and uniqueness checking
- Manual display_id override functionality
- Search functionality by name, phone, and display_id
- Client editing and workflow status management
- Responsive design testing

### 🏔️ Retreat Management (`retreat-management.spec.ts`)
- Retreat navigation and detail views
- Quick booking for new clients
- **Add Existing Client** functionality (NEW FEATURE)
- Searchable client selector with multi-field search
- Retreat metrics and statistics display
- Tab navigation (Clients, Expenses, Payments, etc.)
- Booking editing and management

### 🧭 Navigation (`navigation.spec.ts`)
- Core app navigation between sections
- Responsive navigation menu testing
- Back navigation and browser history
- Loading states and error handling
- URL state management
- Accessibility testing

### 📝 Forms & Validation (`forms-validation.spec.ts`)
- Required field validation
- Email format validation
- Display_id uniqueness validation
- Network error handling
- Form accessibility and UX
- Search and filter validation

### 💳 Payments (`payments.spec.ts`)
- Payment creation and management
- Modal interactions
- Data validation
- Responsive design

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Both frontend and backend servers running
- Playwright browsers installed

### Install Dependencies
```bash
# Install Playwright browsers
npm run test:e2e:install
```

### Run Tests

#### All Tests
```bash
npm run test:e2e
```

#### Specific Test Suites
```bash
# Client management tests
npm run test:e2e:client

# Retreat management tests (includes new Add Existing Client feature)
npm run test:e2e:retreat

# Navigation tests
npm run test:e2e:navigation

# Form validation tests
npm run test:e2e:forms

# Payment tests
npm run test:e2e:payments
```

#### Browser-Specific Testing
```bash
# Mobile responsive testing
npm run test:e2e:mobile

# Tablet responsive testing
npm run test:e2e:tablet

# Run tests with browser visible (headed mode)
npm run test:e2e:headed
```

#### Advanced Testing
```bash
# Interactive UI mode
npm run test:e2e:ui

# Debug mode (step through tests)
npm run test:e2e:debug

# View test reports
npm run test:e2e:report
```

### Using the Test Script
Our custom test runner provides additional options:

```bash
# Run specific test type with options
./e2e/scripts/run-tests.sh --type client --browser chromium --headed

# Debug mode with verbose output
./e2e/scripts/run-tests.sh --type retreat --debug --verbose

# Mobile responsive testing
./e2e/scripts/run-tests.sh --browser mobile --type navigation
```

#### Script Options
- `--type`: Test type (all, client, retreat, navigation, forms, payments)
- `--browser`: Browser (chromium, firefox, webkit, mobile, tablet)
- `--debug`: Enable debug mode
- `--headed`: Show browser (non-headless)
- `--verbose`: Verbose output
- `--report-only`: Generate reports only

## 📁 Project Structure

```
e2e/
├── README.md                     # This file
├── playwright.config.ts          # Playwright configuration
├── client-management.spec.ts     # Client CRUD and display_id tests
├── retreat-management.spec.ts    # Retreat and booking tests
├── navigation.spec.ts            # App navigation tests
├── forms-validation.spec.ts      # Form validation tests
├── payments.spec.ts              # Payment management tests
├── helpers/
│   └── test-helpers.ts           # Reusable test utilities
├── scripts/
│   └── run-tests.sh             # Custom test runner script
├── reports/                     # Generated test reports
└── screenshots/                 # Test failure screenshots
```

## 🛠️ Test Helpers

The `helpers/test-helpers.ts` file provides utility functions for:

- **Navigation**: `navigateToAdmin()`, `waitForPageLoad()`
- **Form Interactions**: `fillField()`, `selectOption()`, `clickAndWait()`
- **Modal Management**: `waitForModal()`, `closeModal()`
- **Search & Tables**: `searchAndWait()`, `findTableRowByContent()`
- **Responsive Testing**: `setViewport()`, `checkResponsiveElements()`
- **Test Data**: `createTestClient()`, `cleanupTestClient()`
- **Debugging**: `takeDebugScreenshot()`, `checkConsoleErrors()`

### Example Usage
```typescript
import { test, expect } from '@playwright/test';
import { TestHelpers, createTestData } from './helpers/test-helpers';

test('should create a new client', async ({ page }) => {
  const helpers = new TestHelpers(page);
  const clientData = createTestData.client({
    displayId: '9999'
  });

  await helpers.navigateToAdmin('clients');
  await helpers.createTestClient(clientData);

  // Verify client was created
  await expect(page.locator('text=' + clientData.email)).toBeVisible();
});
```

## 🎯 Key Features Tested

### Display ID Functionality
- Auto-generation starting from 1001
- Manual override with uniqueness validation
- Search by display_id
- Display in client grid and forms

### Add Existing Client Feature
- Searchable client selector modal
- Multi-field search (name, phone, display_id)
- Real-time search filtering
- Integration with retreat booking system

### Responsive Design
- Mobile viewport (375x667)
- Tablet viewport (768x1024)
- Desktop viewport (1024x768)
- Navigation menu adaptation
- Table scrolling and layout

## 📊 CI/CD Integration

### GitHub Actions
Tests automatically run on:
- Push to main/develop branches
- Pull requests
- Manual workflow dispatch

### Test Matrix
- **Chromium**: Full test suite
- **Firefox**: Navigation and form validation
- **WebKit**: Client management
- **Mobile**: Navigation and client management
- **Tablet**: Retreat management

### Reports
- HTML reports with screenshots
- JSON reports for programmatic analysis
- JUnit XML for CI integration
- Lighthouse performance reports

## 🐛 Debugging Tests

### Common Issues

1. **Server not running**
   ```bash
   # Check if servers are running
   curl http://localhost:3000  # Frontend
   curl http://localhost:3005  # Backend (if applicable)
   ```

2. **Playwright browsers not installed**
   ```bash
   npm run test:e2e:install
   ```

3. **Tests timing out**
   - Increase timeout in `playwright.config.ts`
   - Check server response times
   - Add explicit waits for dynamic content

### Debug Mode
```bash
# Run in debug mode to step through tests
npm run test:e2e:debug

# Or use the script
./e2e/scripts/run-tests.sh --debug --headed
```

### Screenshots and Videos
- Failure screenshots: `e2e/screenshots/`
- Test videos: `test-results/` (on failure)
- Debug screenshots: Use `helpers.takeDebugScreenshot()`

## 🔧 Configuration

### Environment Variables
- `CI`: Set to 'true' in CI environments
- `REACT_APP_API_URL`: Backend API URL
- `DATABASE_URL`: Test database connection

### Playwright Config
Key settings in `playwright.config.ts`:
- Base URL: `http://localhost:3000`
- Timeout: 30 seconds
- Retries: 1 (2 in CI)
- Screenshots: On failure
- Videos: On failure

## 🚀 Best Practices

### Writing Tests
1. Use descriptive test names
2. Group related tests in describe blocks
3. Use test helpers for common actions
4. Clean up test data after tests
5. Make tests independent and idempotent

### Test Data
1. Use unique identifiers (timestamps)
2. Clean up after tests
3. Use the `createTestData` helpers
4. Avoid hardcoded values

### Assertions
1. Wait for elements to be visible
2. Use specific selectors
3. Test both positive and negative cases
4. Include accessibility checks

### Performance
1. Use `networkidle` for page loads
2. Avoid unnecessary waits
3. Run tests in parallel when possible
4. Use selective test execution for faster feedback

## 📈 Continuous Improvement

### Adding New Tests
1. Identify new user flows
2. Create test file in `e2e/` directory
3. Use existing helpers and patterns
4. Update this documentation
5. Add to CI workflow if needed

### Monitoring
- Review test reports regularly
- Track flaky tests and fix them
- Monitor test execution times
- Update tests when features change

---

## 🆘 Need Help?

- Check the [Playwright documentation](https://playwright.dev/docs/intro)
- Review existing test files for patterns
- Use the test helpers and utilities
- Run tests in debug mode to understand failures
- Check CI logs for detailed error information