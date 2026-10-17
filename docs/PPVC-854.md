# PPVC-854 — Helpers and cooks view

## Using the feature

1. Open a retreat and choose **Add helper** in its header. The retreat summaries in the holistic grid also have an **Add helper** link.
2. A new assignment opens on the retreat's Cooks and helpers page. The next available Helper 1, Helper 2 or Helper 3 role is selected, with retreat dates and times filled in.
3. Select a person from the helper/cook directory. Adjust their role, dates or times if necessary, then choose **Save team**. Use **Add person** for further assignments, or **Remove** to discard a row.
4. Open **Helpers & Cooks**. A **Helper 3** column appears whenever a retreat has a third helper. Additional existing helpers also get separate columns. Empty cells show **Not assigned**.
5. Use **Manage team** to edit/remove assignments. After removing the third helper from all retreats and saving, the third column disappears.

Assignments using repeated legacy helper roles are displayed in separate helper columns without changing their stored records. Explicit Helper 1/2/3 roles retain their positions; cooks remain grouped separately. Column structure stays consistent while searching and across the past/upcoming sections.

New drafts do not save automatically. Saving an empty assignment is blocked. Failed saves retain the draft and show the API error. A successful save removes the Add helper URL parameter so reloading does not add an extra empty row.

No API/schema change is needed: retreat staff roles are already strings, stored in the retreatStaff array by the existing retreat update endpoint.

## Validation

- Strict TypeScript and Vite production build passed (existing bundle-size warnings).
- 16 focused unit tests passed for helper slot allocation, repeated legacy roles, cook separation, conditional columns, filtering, summaries, draft creation, empty-row validation and failed saves.
- 2 Playwright journeys passed against the built frontend with stateful synthetic API fixtures: retreat → add third helper → save → reload → grid → remove, and empty-row/save-failure behavior.
- Browser tests intercept API requests; they do not verify real database persistence or alter production.

Implemented locally; pending production push and deployment.
