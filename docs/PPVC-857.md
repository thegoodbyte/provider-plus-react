# PPVC-857 — Before our screening call

## How to use after deployment

1. Open Clients → select the client → Screening tab.
2. In Scheduled screening call, enter Call date and time and its IANA timezone (for example Europe/Prague or America/New_York). Save call details. The appointment persists as a UTC instant plus the chosen timezone, independently of screening notes. Clear the date/time and save to remove it.
3. Click Prepare before-call email. Unsaved call changes must be saved first. The English/Czech/Polish template follows the client's preferred language, with English fallback for other languages. A missing email address, missing portal PIN or unavailable template produces an actionable error instead of sending an incomplete invitation.
4. Review the email. It thanks the client for their first step, provides the IbogaReady login URL and existing email/PIN, links Overall questionnaire, Medical questionnaire and Medications questionnaire, and shows the scheduled call in its saved timezone. If no appointment is set, it explicitly says the call time is not confirmed. You can choose another language in the existing composer.
5. Click Send Email only after reviewing the preview and recipient. Cancel closes the preview without sending. Saving/clearing a schedule and preparing a preview never send an email. Check the client's Emails tab for the recorded send and delivery status.

The logo is a hosted HTTPS image at https://retreatengine.com/images/logo/iscz-logo-500w.png, using the existing brand asset. It is displayed inside the HTML email, rather than attached. The alt text and plain-text fallback remain usable when remote images are blocked. No PDF/image attachment is added by this template. The three questionnaire URLs are retained in both HTML and plain text.

Local date/time conversion rejects nonexistent spring-forward times and ambiguous autumn clock times instead of silently scheduling the wrong instant. For a repeated autumn time, choose a different time or explicitly schedule its corresponding UTC time using timezone UTC.

## Implementation

- Client fields: screeningCallAt (UTC Date, nullable) and screeningCallTimeZone (IANA name), accepted by the existing validated client PATCH endpoint. Call scheduling does not change workflow status or screening-completion state.
- New template family screening_call_preparation, three language variants, installed on API startup without overwriting existing templates or customized copies. The previous prospect_forms_invitation family remains unchanged.
- Client-based hydration includes credentials only for invitation templates. The new family keeps client hydration even when opened from a composer with a booking context. Dynamic HTML values are escaped; client names containing HTML do not replace the document. The composer retains the template's URL-bearing plain-text fallback and respects explicit plain-text editing for this family.
- ScreeningCallPanel reuses EmailComposeModal and existing communication logging/sending. No production emails have been sent during implementation.

## Validation

- API and frontend production builds/strict checks passed.
- Expanded API checks: 120 passed, 3 failed. All new PPVC-857 tests pass. The same 3 Czech payment-template wording tests fail on unchanged production communication sources (baseline verified separately in ppvc-858-api): payment announcement greeting and the two legacy Czech template repair variants expect Ahoj/vocative while the existing seed uses Dobry den/firstName. These pre-existing failures remain visible for the release gate; no production push was attempted.
- Frontend: 11 tests passed across scheduling/timezone helpers, panel save/preview/error behavior and existing composer hydration.
- Real guarded API + standalone MongoDB integration passed: persistence/reload/clear, timezone validation, unchanged screening notes, startup seeding/customization retention, three-form HTML/plain-text rendering, captured send and email history. Gmail transport is replaced with capture.
- Three actual-API/database browser journeys passed: desktop/mobile save → reload → preview → cancel → explicit captured send; failure retains draft → retry → clear → undated preview.
- English/Czech/Polish email previews rendered at 390px and 680px without horizontal overflow; screenshots/HTML are in ppvc-857-validation. Synthetic fixture data only.

Implemented locally; pending push/deployment. Deploy API first with frontend so the fields and new seeded template family are available together.
