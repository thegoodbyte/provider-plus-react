# PPVC-866 — WhatsApp handling overlay from the MRR list

## Usage

1. Open Review Requests and find the MRR in Grouped, All or WhatsApp handled views.
2. Click Handle via WhatsApp (or the existing WhatsApp awaiting/handled action). The overlay opens immediately without marking the request sent.
3. Confirm the MRR number and client. Select the medical advisor, date sent and WhatsApp status.
4. Choose Sent — waiting for answer to record a handoff. Choose Handled — advisor answered to enter the answer date, advisor result and optional notes. Existing values are prefilled.
5. Click Save and return to list. The existing API saves the metadata and the list updates. A failed save keeps the form and entered values available for retry.
6. Cancel, the close button, Escape or the backdrop closes the unsaved form without changing the request. Keyboard focus stays inside the overlay and returns to the invoking control when closed.

This form records the WhatsApp workflow; send the actual message in WhatsApp separately. Existing server review/notification behavior is unchanged. The separate Download for WhatsApp action remains available.

## Validation

- Strict TypeScript/Vite build passed.
- 35 tests passed across MRR grid, WhatsApp form and grid helper suites.
- Desktop 1440px and mobile 390px browser journeys cover first-click opening without a write, client/advisor context, cancel/close/Escape, keyboard focus wrapping, explicit waiting-state save, prefilled edits, failed response save and retry, immediate list status update, and reload.
- Browser endpoints/persistence use synthetic fixtures. These checks do not claim real database persistence or actual WhatsApp/email delivery. No production writes or real outgoing messages.
- Screenshots and logs are retained in workspace ppvc-866-validation/.

Frontend only, pending deployment. This deliberately supersedes PPVC-696's immediate first-click sent action with an explicit-save form, as requested.
