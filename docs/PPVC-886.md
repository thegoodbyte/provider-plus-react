# PPVC-886 — One configurable document-library placement setting

## How to use

1. Open Setup → Document Types & Libraries, or use Manage document types & library placement at the top of either library.
2. Find the type and choose Display in: Documents Library, Medical Artifacts, or Both libraries.
3. Click that type's Save button. Return to the library or Refresh it. The setting controls existing and future records; no files are moved or deleted.
4. Questionnaire defaults to Documents Library. Medications Form defaults to Medical Artifacts. Saved choices override these defaults, including inactive types' classification of historical records.
5. Upload/review support remains on this same settings page. Creating a linked medical record is separate from showing it in the medical library: reviews may still require the backing record. The old unconditional medication override has been removed; saved upload/review choices are honored.
6. Use Include records assigned to the other library to inspect records in their original collection. It does not update them. Direct links to an original document remain accessible even when its preferred library differs.

Existing client-only questionnaires stored solely as artifacts are also visible in Documents Library and can be previewed through their original authorized file endpoint. Medication documents without an artifact appear as read-only entries in Medical Artifacts, with Open original document. Linked copies or same-client copies of the same file are deduplicated. These read views create no fake MRR-capable artifact IDs and do not alter files, review links, or storage. Manage projected records through Open original record/document.

Add missing defaults only inserts missing types and never resets saved custom labels, library placement or review settings. Built-in defaults without a stored row are shown as editable suggestions; Save persists them. Default types cannot be deleted (which would make their fallback reappear); turn Active off to disable new uploads. Unregistered types remain visible in their original library.

Placement is presentation metadata, not an authorization boundary. Existing API roles and client/booking requirements keep their original records and behavior. All placement choices live on the same settings page. Refresh reads current placement without the old catalog cache.

## Validation

- API build and strict frontend TypeScript/Vite build passed.
- 50 focused API tests passed (document service/controller/DTO and questionnaire controller).
- 20 frontend tests passed (placement, historical read views/deduplication, navigation, existing medical filters).
- Desktop/mobile browser checks cover defaults, existing mirrored records, prebooking questionnaire file preview, unmirrored medication display, explicit all-record access, settings save failure/retry and persistence, and switching Questionnaire to Both libraries. Browser API data is synthetic, not a browser-to-live-API persistence assertion.
- Real MongoDB integration with the actual document-type schema/service verifies saved settings survive reload, legacy defaults, no medication override, additive defaults preserve custom settings, invalid choices/default deletion rejected, and original fixture records/files/review links remain untouched.
- Broader document API tests exposed three existing AI-translation failures. All three reproduce on unchanged production base d67829e297df55d45cb2c1880390a269a58f4ac6; the translation suite reports 7 passed/3 failed there. The service rejects AI processing because its environment policy is not configured. That policy and translation sources are unchanged by this ticket. These remain production-release gate failures unless fixed or explicitly waived for a release.
- Local evidence: workspace ppvc-886-validation/. No production writes or real outgoing messages.

Implemented locally, pending deployment. API must deploy before the frontend because it provides the effective configurable catalog.
