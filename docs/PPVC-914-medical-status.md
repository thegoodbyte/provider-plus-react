# PPVC-914 — EKG date validity and portal form evidence

## Findings

Read-only inspection of booking 1260 confirmed an EKG caution review but no recorded `data.testDate`. The resolver treated a missing date as expired. An uploaded questionnaire existed as a booking artifact although no native portal questionnaire record existed. The 30-day medication receipt step was pending with no submitted native 30-day form.

## Resulting behavior

- Missing or invalid EKG date information shows **Test date needs confirmation**, with the existing clinical decision retained separately. It is waiting for staff, not a request to automatically replace the file, and does not satisfy medical readiness.
- A known date outside the configured retreat validity window still shows **Expired**. A known in-window date uses the existing current review decision. No clinical decision, waiver, test date or validity setting is changed by a status read.
- Admin medical records show **Not recorded** when a test date is missing; the upload date is no longer displayed as if it were the test date.
- Staff should inspect the original EKG, record its actual test date through the existing medical-record editor, and refresh the EKG status. Never infer the test date from the upload or review date. Contact the medical team if the date cannot be verified.
- The portal recognizes original uploaded questionnaire/medication evidence for the current booking, including legacy staff uploads. Existing review requirements and corrective/pending decisions still apply. Drafts, replaced files, translations alone, and other bookings do not satisfy the task. Initial medications never satisfy the 30-day form.
- A genuinely absent 30-day form remains outstanding. Native form timestamps now select the latest submitted form rather than allowing a draft or older review to override it. Evidence-source errors display unavailable rather than inventing missing/complete status.

## Verification

Regression fixtures reproduce the reported missing-date/caution pattern with synthetic records only. Real Mongo/Nest/JWT checks cover unknown, valid and expired dates, clinical decision preservation, authorization, safe form evidence and unchanged database snapshots. Desktop/mobile portal tests cover English and Czech, questionnaire receipt, missing 30-day medication status and the EKG detail explanation. Full API/admin/portal unit suites, builds and API contracts are recorded in `ppvc-914-validation/validation.json`.

The targeted production investigation read only booking/evidence/review metadata and did not retrieve questionnaire answers or medication contents. Production medical records were not modified. Deploy API before admin and IbogaReady; no deployment is included in implementation.
