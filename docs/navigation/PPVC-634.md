# PPVC-634 — Navigation and terminology

Daily operational screens remain in the sidebar and the Home launcher's Daily Work area. Configuration lives in Settings & Setup in both places. The launcher uses responsive shortcut cards with feature descriptions instead of overlapping circles. Existing shortcut visibility and primary/secondary preferences use the existing saved configuration, with unrelated module preferences preserved on save.

| Existing URL suffix | Label | Purpose / location |
| --- | --- | --- |
| `workflow` | Readiness Dashboard | Retreat-wide readiness and blockers; daily work |
| `booking-flow` and `booking-flow/:bookingId` | Booking Requirements | Required steps, due dates and completion for bookings; daily work |
| `retreat-flow` and `retreat-flow/:retreatId` | Retreat Readiness Setup | Required readiness steps for a specific retreat; setup |
| `retreat-flow-library` | Booking Step Library | Reusable step definitions copied into bookings; setup |
| `booking-document-types` | Booking Document Types | Document categories and step links; setup |
| `payment-requests` | Payment Requests | Amounts requested from clients; daily work |

Houses, reusable announcement schedules, general requirement definitions and account configuration also appear under Settings & Setup when permitted. Documents already uploaded remain in the operational Document Library. No routes, API contracts or stored route IDs were renamed. The canonical labels/descriptions are in `src/navigation/navigation.ts`; prior feature names remain sidebar search aliases.

Sidebar and launcher use the same visibility rules and live preference updates. Visibility cannot grant access beyond the current role (including impersonated roles). The preference reader accepts the route-to-roles format used by the permissions editor and the older role-to-routes format. Existing protected-route enforcement remains unchanged.

Validation: production build, 23 unit tests and 26 browser tests passed. Reviewed desktop and phone screenshots after correcting the mobile toolbar overlap; no horizontal overflow was detected. Coverage includes setup grouping, daily shortcuts, terminology, existing deep links, desktop/mobile navigation, role restrictions, stored visibility, shortcut persistence, and the previous lazy-route recovery tests. Browser fixtures intercept APIs; no real records are changed or emails sent. The mobile toolbar occupies its own row so it does not obscure headings or scrolling content; opening the mobile drawer expands a previously collapsed desktop sidebar. Visual review uses 1440×1000 desktop and 390×844 phone screenshots, including the settings group and mobile drawer.

```sh
npm run build
CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/navigation/navigation.test.ts src/components/ModuleLauncherPage.test.tsx src/components/AppleSidebar.test.tsx src/components/ProtectedRoute.test.tsx src/components/PaymentRequestsGrid.test.tsx src/components/AnalyticsPage.test.tsx
PLAYWRIGHT_PRODUCTION_BUILD=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:4186 PLAYWRIGHT_WEB_SERVER_COMMAND='node_modules/.bin/serve -s build -l tcp://127.0.0.1:4186' npx playwright test e2e/navigation-terminology.spec.ts e2e/lazy-routes.spec.ts e2e/announcements.spec.ts --project=chromium --workers=1 --retries=0 --reporter=line --output=/tmp/ppvc-634-e2e
```
