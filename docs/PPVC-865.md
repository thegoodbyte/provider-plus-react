# PPVC-865 — Medical decision email templates

## Usage

1. Open Communications → Settings → Medical notifications.
2. Scroll to Needs more information email templates or Declined email templates.
3. Edit the English, Czech and Polish Subject and Body fields as needed. Use the displayed placeholders for first name, document type, stage, review number and client portal link.
4. Click Save notification settings. Saved changes remain after reload. The matching client language selects the template; unsupported languages use English. Legacy `cz` copy is honored, with explicit `cs` copy taking precedence.
5. Sending still requires the master switch and the relevant Needs-info emails or Declined emails switch. Email safety redirects outgoing mail when enabled. Saving templates neither sends an email nor resends an earlier decision.

The default copy explains the document outcome, requests action in IbogaReady and references existing sign-in details. A declined document is not described as a declined retreat booking. No reviewer notes or medical findings are included. Existing configured copy is retained; missing template fields use localized defaults. Existing live switches are untouched. PPVC-852 already defaults absent decision switches on; explicit false remains false.

## Validation

- API build and frontend strict TypeScript/Vite build passed.
- API: 24 tests across the notification and new decision-template suites passed.
- Frontend: 6 tests across editor and master-switch suites passed.
- Desktop 1440px and mobile 390px browser journeys passed: edit/save/reload all six subject/body pairs, preserve disabled switches, retain custom Czech copy on initial load, no email-send requests, no page horizontal overflow.
- Browser API responses and persistence are synthetic fixtures; real database delivery/persistence is not asserted. Notification unit tests capture the send call. No production writes or real outgoing messages.
- Local screenshots and logs: workspace `ppvc-865-validation/`.

API and frontend changes are committed locally, pending deployment. This ticket does not resend the previously declined MRR or alter its status.
