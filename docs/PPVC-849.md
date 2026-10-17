# Screening PDF viewer (PPVC-849)

From a client's Screening tab, click PDF. The PDF button on the screening form opens the same viewer. An existing generated copy is shown immediately; if none exists, the API generates and stores it first. Regenerate replaces the saved copy using the latest saved client screening data. Save any form changes before regeneration. Download PDF and Open PDF in a new tab remain available; Close or Escape exits the viewer.

Failed regeneration keeps the previous document. Retry repeats the failed operation. Closing the viewer releases its temporary browser URL; late requests cannot reopen it. The browser's built-in PDF renderer displays the iframe; the new-tab/download links are available for browsers that cannot embed PDFs.

API: authenticated GET /clients/:id/screening/pdf reads or generates, and POST /clients/:id/screening/pdf/regenerate creates a fresh copy. Both retain the existing ClientsController role guards. Generated documents use the existing private S3 service at clients/{sanitized-client-id}/screening/generated.pdf. The original download endpoint remains available. Storage failures are surfaced rather than replaced with silent in-memory persistence. A generation failure never overwrites the prior stored object. Requests coalesce per client within one API process; across replicas, independently generated successful objects use S3's atomic replacement. No schema migration is required. A newly generated copy appears only after successful S3 upload.

Tests:

```sh
# API repository
npm run build
npm test -- --runInBand src/clients/screening-pdf-viewer.spec.ts src/clients/clients.controller.spec.ts src/clients/screening-pdf.helpers.spec.ts
node test/screening-pdf-viewer.fixture.cjs
# Separate terminal, admin repository
npm run build
npm test -- --runInBand src/components/ScreeningPdfViewer.test.tsx src/pages/ClientScreening.test.tsx src/utils/screeningPdfDownload.test.ts
SMOKE_PORT=43850 npx playwright test -c playwright.smoke.config.ts smoke/screening-pdf-viewer.spec.ts
```

The localhost fixture on port43849 runs the actual controller/PDFKit generator with synthetic client data and in-memory S3. It never loads AppModule, .env, a database or real S3. Auth is replaced with a fixture-only bearer guard; the existing production controller guards remain unchanged. Browser checks verify real PDF bytes, saved-copy reuse, missing generation, regeneration, failure recovery and both entry points. All external browser requests are intercepted. No production medical data, uploads, writes or messages are involved. PDF plugin pixels in headless Chromium are not the assertion; PDF response bytes and viewer wiring are checked. Stop the fixture with Ctrl+C after testing.
