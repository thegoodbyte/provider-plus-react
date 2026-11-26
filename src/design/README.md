# Retreat Engine design system — PPVC-1071

`tokens.json` is the source of truth for palette, typography, control geometry and surfaces. `tokens.css` is generated (`npm run design:generate`);
Tailwind's standard neutral families and existing `apple.*` aliases and the Ant Design ConfigProvider consume the same tokens.
The existing PPVC-1002 `components/ui` kit is canonical; do not add another kit or copy a demo.

Use AppleButton (primary/secondary/ghost/danger), AppleInput, ui/Card, ui/Table, ui/Badge,
ui/Modal and EmptyState. Primary actions are blue; danger actions are soft red; status tones
retain business meaning. Success means completed/cleared, warning means pending/balance due,
critical means an actual error/overdue condition, info covers informational credit/overpayment.
Never choose a status or change its label based on its color. Status text/icons remain required.
Use Badge.colorClassName for genuine extra workflow states; it intentionally preserves their palette.

The administrative shell, plain form fields, legacy primary utility buttons and existing tables
have scoped compatibility adapters. No canvas/calendar/clinical evidence colors are globally
reclassified. Complex widgets use Ant Design tokens; popup portals inherit the same theme.
Native checkboxes/radios/range/file/color/hidden controls and Ant internal inputs (including
classless inputs inside compound date/number/prefix controls) are excluded
from the generic text-field adapter. A specialized native field can opt out with data-re-unstyled.
Printing retains white backgrounds. Disabled/loading/read-only, reduced motion and keyboard
focus are preserved. Mobile action targets are at least44px for the shared button.

`npm run design:check` verifies generated tokens and rejects growth in raw native buttons relative
to the explicit legacy inventory. `npm run design:inventory` reports the remaining debt; this is
an adoption guard, not a claim that every legacy widget has been rewritten. Reduce the inventory
when migrating a page. Updating the baseline is an explicit migration decision, not a workaround.
New UI should not use a raw button or literal brand color. Prefer existing semantic primitives.

Local interactive reference: start Vite and open `/e2e/fixtures/design-system.html`. It mounts the
real shared components, real theme and stylesheet, including a keyboard-accessible dialog and
third-party controls. It is test tooling, not a production navigation item. Playwright also checks
representative actual administrative routes at desktop/mobile sizes; the full browser gate
continues to cover live API persistence journeys and permissions.

Legacy stylesheet adoption also aliases common neutral literals in 57 stylesheets to the same
surface/text/border tokens. Clinical/status/event hues remain separate. Design checks parse
stylesheets and reject unresolved design-token references. Named Tasks selections and legacy
action adapters use the primary tone without altering their routing or state logic.
