# Medical artifact full-screen viewer (PPVC-998)

In a medical artifact's Preview section, each original/English PDF or image has
Full screen. The portal modal fills the viewport above the app navigation.
Document version selects the exact stored file; the header retains the client
and artifact identity. Close viewer returns focus to the opening button. Escape
works from the viewer controls; native embedded PDF controls handle their own
keyboard events. Download document / Open in new tab use the already-authorized
blob, and PDF zoom/print are supplied by the browser's native viewer. New-tab
viewing is also the fallback on browsers without embedded PDF support.

This is a read-only presentation extension. It uses the existing authenticated
medicalArtifactsApi.getFileBlob endpoint and existing route permissions; it does
not expose a direct storage URL, add access, regenerate translations, save data,
change medical review or publish anything. Original/English labels follow the
stored variant rather than guessing from the filename or language.

Every selection has an identity key. A new selection removes the old frame and
links immediately. Denied/failed reads show an error with retry; an unavailable
file is never silently replaced with another version. Late responses after
switch/unmount are ignored, and every created object URL is revoked when replaced
or closed. The inline preview's late-response URL leak is also avoided.

PDFs and passive image MIME types are accepted. Generic binary responses may use
safe file metadata to force the expected MIME renderer. HTML/SVG/unsupported
responses are never framed or offered as executable new-tab blobs. Original data
is unchanged. Other attachment types keep their existing download/view flow.

Styles target the installed Ant Design modal container and dynamic viewport
height, with responsive44px controls, scrollable toolbar and a flexing document.
Ant Design handles modal focus containment/body locking, plus explicit opener
restoration on unmount. The viewer and its styles are isolated from Screening PDF.

Tests cover exact file identity/version, stale/late reads, denial/retry, safe
binary types, URL disposal, missing files and close/focus behavior. Native
Chromium desktop/mobile tests use synthetic PDFs and read-only authenticated API
responses, assert viewport/frame dimensions and reject writes. Headed Chromium
also checks the native PDF renderer; headless Chromium can show a blank plugin
surface while the outer frame/layout still passes. No real medical documents
are used in test fixtures. Build before starting the production-preview browser
QA server to avoid stale development CSS.

No API/schema/index/migration changes or database gate are applicable. Reverting
the UI restores inline-only viewing; no persisted clinical data needs rollback.
Implementation handoff does not include deployment.
