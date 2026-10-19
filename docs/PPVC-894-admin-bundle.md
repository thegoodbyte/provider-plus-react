# PPVC-894 — defer PDF engines from the admin initial bundle (PPVC-800)

The measured production entry included jsPDF and html2canvas before any PDF action. These engines now load dynamically when a booking confirmation or food matrix PDF is generated. Library loading failures follow the existing booking-PDF error handling; the food matrix has explicit preparing/error states and retains its data so the user can retry or refresh.

No date-library migration or manual vendor-chunk reshuffle was needed for this slice. The parent ticket's CartesianChart finding was stale: the current audit shows that chart chunk is already outside the initial static JavaScript closure.

## Pinned measurements

Baseline admin production source: `115dec0084b05195747b8aeee53ebf7b0e96afa7`. Same toolchain, production mode, no new dependency. The audit counts the entry plus **all recursive static JavaScript imports**, rather than looking only at the entry filename. Gzip is summed per file, as separately transferred files would be compressed.

| Initial JavaScript | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Raw bytes | 4,300,830 | 3,706,589 | 594,241 (13.82%) |
| Gzip bytes | 1,179,938 | 1,005,653 | 174,285 (14.77%) |

Before: the largest initial rendered modules include react-dom, html2canvas (~410 KB rendered), jsPDF (~344 KB) and moment (~156 KB). Rendered module lengths help locate contributors but are not an attribution of minified/gzipped size. After: neither PDF engine is in the initial static closure. They are still shipped as dynamic chunks and downloaded when needed; total application feature bytes are not claimed to disappear.

The initial bundle remains substantial (about 1 MB gzip). This is a measurable scoped reduction, not a claim that all admin performance issues are solved. No production LCP/INP/network/CPU measurements were collected, and no live speed percentage is inferred from bytes.

## Use and recovery

1. Open admin pages normally. PDF engines are no longer required for their initial load.
2. Generate a booking confirmation or export a food matrix as before. The first PDF use downloads its engine chunks; later uses benefit from the module cache.
3. Food matrix export shows Preparing PDF and disables duplicate clicks while processing. If generation/loading fails, its error stays inside the matrix and the data remains visible.
4. Try again after a transient generation error. If a dynamic chunk failed to download or became stale during deployment, refresh the page and export again. Booking PDF callers retain their existing error/cleanup behavior.

## Verification

- Full admin: **268 suites / 1,612 tests pass**; production build passes.
- Focused PDF, authoritative financial-summary, download/email-preparation and matrix tests: 44 pass. Two new matrix cases cover deferred construction, saved filename and error recovery without losing the matrix.
- Built-browser desktop/mobile checks confirm no PDF engine requests before export, actual `%PDF-` downloads, and a blocked dynamic chunk's visible error followed by successful refresh/export.
- Local evidence: workspace `ppvc-894-validation/validation.json`, `baseline.json`, `candidate.json`, browser screenshots and synthetic downloaded PDFs. Browser APIs are local stubs; no client data, real email or deployment is used.

## Reproduce the audit

```sh
node scripts/audit-bundle.mjs /tmp/admin-bundle-audit.json
```

The script uses Vite's current production config to bundle **in memory** (`write:false`), reads the emitted Rollup module/chunk graph and measures JavaScript/gzip bytes. It writes only the chosen local JSON report and never publishes it. It creates no public analysis endpoint or production asset. Run on isolated before/after source candidates using the same dependencies and mode; compare `entries[].rawBytes`, `gzipBytes`, initial file list and chunk/module graph. Dynamic routes, CSS and other assets are excluded from this JavaScript metric.

After `npm run build`, preview on loopback 4895 and run:

```sh
SMOKE_BASE_URL=http://127.0.0.1:4895 PPVC894_AUDIT=/absolute/path/to/candidate.json \
  node node_modules/@playwright/test/cli.js test -c playwright.smoke.config.ts smoke/deferred-pdf.spec.ts
```

## Rollout / rollback

This admin commit has no new API/database dependency. Deploy through normal production gates. Keep prior hashed assets available during rollout where supported so open sessions can fetch deferred chunks. A stale/missing chunk surfaces an export error; refresh retrieves the current asset graph. Rollback the admin commit/build if needed; no schema/data migration is required. Not pushed or deployed as part of implementation. PPVC-893 handles report queries/indexes; PPVC-895 adds future API latency observations.
