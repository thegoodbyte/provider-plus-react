const { running, stopChildren, probeFixtureListener } = require("./coverage-process.cjs");
// Default failure survives even an unexpected exit during asynchronous teardown.
process.exitCode = 1;
/* Reproducible no-skip coverage for suites formerly gated by private snapshots or
 * missing ticket fixtures. Requires built matching API, disposable loopback Mongo,
 * admin production server, admin/IR Vite harnesses and public invoice renderer.
 * These explicit URLs allow CI/release orchestration to own builds and processes.
 * This runner owns only its synthetic API fixture children and cleans them up. */
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  net = require("node:net"),
  { spawn, execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  children = [];
const required = [
  "TEST_API_CHECKOUT",
  "TEST_MONGO_URL",
  "PLAYWRIGHT_BASE_URL",
  "PLAYWRIGHT_FIXTURE_BASE_URL",
  "CLIENT_PORTAL_FIXTURE_BASE_URL",
  "INVOICE_CLIENT_WEBSITE_URL",
];
const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const n = s.address().port;
      s.close(() => resolve(n));
    });
  });
function loopback(value, protocol) {
  const u = new URL(value);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) ||
    u.protocol !== protocol ||
    u.username ||
    u.password
  )
    throw Error(
      "Synthetic coverage only permits loopback " + protocol + " endpoints",
    );
  return u;
}
function start(args, cwd, env, log) {
  const fd = fs.openSync(log, "w"),
    p = spawn(process.execPath, args, { cwd, env, stdio: ["ignore", fd, fd] });
  fs.closeSync(fd);
  children.push(p);
  return p;
}
async function ready(p, file, port) {
  for (let i = 0; i < 400; i++) {
    if (!running(p)) throw Error("Fixture exited " + p.exitCode + ": " + file);
    if (fs.existsSync(file)) {
      try {
        const data = JSON.parse(fs.readFileSync(file));
        // Some existing fixtures deliberately bind port zero. The published
        // loopback URL is authoritative, rather than the requested hint.
        await probeFixtureListener(data);
        return data;
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw Error("Fixture readiness timeout: " + file);
}
const factory = {
  "paid-request-booking": ["paired-balance-booking", "PAID_BOOKING_FIXTURE"],
  "booking-reschedule-stay": [
    "booking-reschedule-stay",
    "RESCHEDULE_STAY_FIXTURE",
  ],
  "required-room-type": ["required-room-type", "REQUIRED_ROOM_FIXTURE"],
  "itemized-invoice": ["invoice-drafts", "ITEMIZED_INVOICE_FIXTURE"],
  "payment-consent-policy": [
    "payment-consent-policy",
    "PAYMENT_CONSENT_FIXTURE",
  ],
  "screening-workspace": ["screening-workspace", "SCREENING_WORKSPACE_FIXTURE"],
  "settled-scratchpad": ["settled-scratchpad", "SETTLED_SCRATCHPAD_FIXTURE"],
  "task-identity": ["task-identity", "TASK_IDENTITY_FIXTURE"],
  "balance-reminder": ["balance-reminder", "BALANCE_REMINDER_FIXTURE"],
  "client-contact-card": ["client-contact-card", "CONTACT_CARD_FIXTURE"],
};
const legacy = {
  "booking-request-discovery": "PPVC901_FIXTURE",
  "payment-booking-integrity": "PPVC902_FIXTURE",
  "request-first-booking": "PPVC903_FIXTURE",
  "request-currency": "PPVC899_FIXTURE",
  "legacy-referral-payments": "PPVC821_FIXTURE",
  "medical-work-mode": "MEDICAL_WORK_FIXTURE",
  "work-modes": "WORK_MODES_FIXTURE",
  languages: "LANGUAGES_FIXTURE_PATH",
  "integration-calls": "INTEGRATION_CALLS_FIXTURE",
  "canonical-ekg": "EKG_FIXTURE",
  "payment-booking-linking": "PPVC920_FIXTURE",
  "booster-offers": "BOOSTER_FIXTURE_FILE",
  "receipt-split": "PPVC918_FIXTURE",
  "referral-report-pages": "PPVC893_FIXTURE",
};
const files = [
  "booking-date-prefill",
  "booking-request-discovery",
  "booking-reschedule-stay",
  "client-management",
  "client-tasks-local",
  "configurable-languages",
  "forms-validation",
  "itemized-invoice",
  "lazy-routes",
  "legacy-referral-payments",
  "medical-work-mode",
  "mrr-follow-up-persistence",
  "mrr-whatsapp-save-contract",
  "navigation",
  "paid-request-booking",
  "paired-balance-booking",
  "payment-booking-integrity",
  "payment-booking-linking",
  "payment-consent-policy",
  "payments",
  "receipt-split",
  "referral-date-packages",
  "referral-history",
  "request-booking-settlement",
  "request-currency-payment",
  "request-first-booking",
  "required-room-type",
  "retreat-management",
  "screening-room-validation",
  "screening-workspace",
  "settled-scratchpad",
  "task-identity",
  "work-modes-persistence",
];
const smoke = [
  "balance-reminder",
  "booster-offers",
  "canonical-ekg",
  "client-contact-card",
  "deferred-pdf",
  "integration-calls",
  "referral-report-pages",
];
(async () => {
  for (const k of required)
    if (!process.env[k])
      throw Error(k + " required; see docs/testing/coverage-resolution.md");
  const mongo = loopback(process.env.TEST_MONGO_URL, "mongodb:");
  if (!["", "/"].includes(mongo.pathname) || mongo.search)
    throw Error("TEST_MONGO_URL must not name an application database");
  for (const k of required.slice(2)) loopback(process.env[k], "http:");
  const api = path.resolve(process.env.TEST_API_CHECKOUT),
    output = path.resolve(
      process.env.COVERAGE_OUTPUT ||
        fs.mkdtempSync(path.join(os.tmpdir(), "release-coverage-")),
    );
  fs.mkdirSync(output, { recursive: true });
  const env = {
    ...process.env,
    APP_ENV: "production",
    PLAYWRIGHT_SKIP_WEB_SERVER: "1",
    PLAYWRIGHT_PRODUCTION_BUILD: "1",
    REQUIRED_ROOM_IR_URL: process.env.CLIENT_PORTAL_FIXTURE_BASE_URL,
    EKG_IR_URL:
      process.env.COVERAGE_IR_URL || process.env.CLIENT_PORTAL_FIXTURE_BASE_URL,
    PAYMENT_CONSENT_CZ_URL: process.env.INVOICE_CLIENT_WEBSITE_URL,
    PAYMENT_CONSENT_PL_URL: process.env.INVOICE_CLIENT_WEBSITE_URL,
    SMOKE_BASE_URL: process.env.PLAYWRIGHT_BASE_URL,
    PPVC894_AUDIT:
      process.env.PPVC894_AUDIT || path.join(output, "bundle-content.json"),
  };
  const evidence = {
    started_at: new Date().toISOString(),
    sources: {
      frontend: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
      api: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: api,
        encoding: "utf8",
      }).trim(),
    },
    checks: [],
    fixtures: [],
  };
  const record = () =>
    fs.writeFileSync(
      path.join(output, "validation.json"),
      JSON.stringify(evidence, null, 2),
    );
  record();
  try {
    if (process.env.COVERAGE_REUSE_BROAD_EVIDENCE) {
      if (process.env.COVERAGE_FULL !== "1" || !process.env.COVERAGE_REUSE_BROAD_GATE_RECORD)
        throw Error("Broad reuse requires full coverage and its original gate record");
      evidence.checks.push(require("./coverage-reuse.cjs").verifyBroadReuse(
        process.env.COVERAGE_REUSE_BROAD_EVIDENCE, process.env.COVERAGE_REUSE_BROAD_GATE_RECORD,
        root, api, process.env));
      record();
    }
    for (const name of [...Object.keys(factory), ...Object.keys(legacy)]) {
      const port = await freePort(),
        file = path.join(output, name + ".json"),
        e = {
          ...env,
          TEST_FIXTURE_PORT: String(port),
          TEST_FIXTURE_OUTPUT: file,
        };
      let args, varname;
      if (factory[name]) {
        const [module, key] = factory[name];
        args = ["test/coverage-fixture-host.cjs", module + ".fixture.cjs"];
        varname = key;
      } else {
        varname = legacy[name];
        args = ["test/" + name + ".fixture.cjs"];
        if (name === "receipt-split") {
          args = ["test/receipt-split.integration.cjs", "--serve"];
          Object.assign(e, {
            RECEIPT_SPLIT_FIXTURE_PATH: file,
            RECEIPT_SPLIT_HTTP_PORT: String(port),
            RECEIPT_SPLIT_ORIGIN: env.PLAYWRIGHT_BASE_URL,
          });
        }
        if (name === "referral-report-pages") {
          args = ["test/referral-report-pages.integration.cjs", "--serve"];
          e.PPVC893_FIXTURE = file;
        }
      }
      const p = start(args, api, e, path.join(output, name + ".log")),
        data = await ready(p, file, port);
      env[varname] = file;
      if (name === "booster-offers") env.BOOSTER_FIXTURE_URL = data.url;
      evidence.fixtures.push({ name, pid: p.pid, port: Number(new URL(data.url).port), requested_port: port });
      record();
    }
    // Full mode owns every supplemental fixture too. Reusing a JSON path from
    // an interrupted run can retain writes and turn a clean journey into a false
    // regression. Each child below gets a fresh database, port and output file.
    if (process.env.COVERAGE_FULL === "1") {
      const jobs = [
        ["whatsapp-download-names", "PPVC924_FIXTURE"],
        ["payment-detail-receipt", "PPVC927_FIXTURE"],
        ["mrr-booking-link", "MRR_BOOKING_LINK_FIXTURE"],
        ["client-ekg-mrr", "CLIENT_EKG_MRR_FIXTURE"],
        ["invoice-preview", "INVOICE_PREVIEW_FIXTURE"],
        ["scratchpad-email", "SCRATCHPAD_EMAIL_FIXTURE"],
        ["previous-food-form", "PREVIOUS_FOOD_FORM_FIXTURE"],
        ["scratchpad-payment-search", "SCRATCHPAD_SEARCH_FIXTURE"],
        ["payment-relationship-edit", "PAYMENT_EDIT_FIXTURE"],
        ["client-support", "CLIENT_SUPPORT_FIXTURE"],
        ["support-requests", "IBOGAREADY_REQUEST_FIXTURE", "client-support"],
        ["medical-preparation-calendar", "PPVC922_FIXTURE"],
        ["guided-scratchpad", "GUIDED_SCRATCHPAD_FIXTURE"],
        ["booking-payment-reconciliation", "BOOKING_RECONCILIATION_FIXTURE"],
        ["preparation-workspace", "PREPARATION_FIXTURE"],
        ["screening-print", "SCREENING_PRINT_FIXTURE"],
        ["payment-request-duplication", "PAYMENT_REQUEST_DUPLICATION_FIXTURE", null, "factory"],
        ["invoice-drafts", "INVOICE_DRAFTS_FIXTURE", null, "factory"],
        ["nav-preference", "NAV_PREFERENCE_FIXTURE"],
        ["scratchpad-broad", "SCRATCHPAD_FIXTURE_PATH", null, "scratchpad"],
        ["scratchpad-smoke", "SMOKE_SCRATCHPAD_FIXTURE_PATH", null, "scratchpad"],
        ["mrr-download", "MRR_VIEW_DOWNLOAD_FIXTURE", null, "frontend"],
        ["whatsapp-result", "WHATSAPP_RESULT_FIXTURE", null, "frontend"],
        ["payment-receipt-browser", "RECEIPT_FIXTURE_URL", null, "receipt"],
        ["invoice-visits", "INVOICE_VISITS_FIXTURE_URL", null, "legacy-serve"],
        ["screening-call", "SCREENING_CALL_FIXTURE", null, "legacy-serve"],
        ["screening-pdf-viewer", "SCREENING_PDF_FIXTURE_URL"],
      ];
      for (const [name, variable, alias, kind] of jobs) {
        const port = await freePort(), file = path.join(output, name + ".json");
        const e = { ...env, TEST_FIXTURE_PORT: String(port), TEST_FIXTURE_OUTPUT: file };
        let cwd = api, args = ["test/" + (alias || name) + ".fixture.cjs"];
        if (kind === "legacy-serve") args = ["test/" + name + ".integration.cjs", "--serve"];
        if (name === "preparation-workspace") e.PREPARATION_FIXTURE_OUTPUT = file;
        if (kind === "factory") args = ["test/coverage-fixture-host.cjs", name + ".fixture.cjs"];
        if (kind === "scratchpad") {
          args = ["test/payment-scratchpad.integration.cjs", "--serve"];
          e.SCRATCHPAD_MONGO_PORT = mongo.port || "27017";
          e.SCRATCHPAD_HTTP_PORT = String(port); e.SCRATCHPAD_FIXTURE_PATH = file;
        }
        if (kind === "frontend") {
          cwd = root;
          args = ["e2e/fixtures/" + (name === "mrr-download" ? "mrr-view-download.cjs" : "whatsapp-result.fixture.cjs")];
          e.DOWNLOAD_FIXTURE_SOURCE = api; e.MEDICAL_REVIEW_API_CHECKOUT = api;
        }
        if (kind === "receipt") {
          args = ["test/payment-receipt-browser-fixture.cjs"];
          e.RECEIPT_TEST_MONGO_URI = mongo.href.replace(/\/$/, "") + "/test_receipts_" + require("node:crypto").randomUUID().replaceAll("-", "");
          e.RECEIPT_TEST_OUTPUT = path.join(output, "receipt-files");
          e.TEST_FIXTURE_ORIGIN = env.PLAYWRIGHT_BASE_URL;
        }
        const p = start(args, cwd, e, path.join(output, name + ".log"));
        const data = await ready(p, file, port);
        env[variable] = variable.endsWith("_URL") ? data.url : file;
        evidence.fixtures.push({ name, pid: p.pid, port: Number(new URL(data.url).port), requested_port: port, fresh: true }); record();
      }
    }
    const run = async (label, args, overrides = {}) => {
      const log = path.join(output, label + ".log"),
        started_at = new Date().toISOString(),
        p = start(args, root, { ...env, ...overrides }, log),
        exit_code = await new Promise((resolve) =>
          p.once("exit", (code, signal) => resolve(signal ? 1 : code)),
        );
      const row = {
        label,
        command: [process.execPath, ...args],
        started_at,
        finished_at: new Date().toISOString(),
        exit_code,
        log,
      };
      evidence.checks.push(row);
      record();
      if (exit_code !== 0) throw Error(label + " failed: " + log);
      return row;
    };
    if (!process.env.PPVC894_AUDIT)
      await run("bundle-audit", [
        "scripts/audit-bundle.mjs",
        env.PPVC894_AUDIT,
      ]);
    const cli = require.resolve("@playwright/test/cli");
    for (const [label, args, overrides] of [
      [
        "broad",
        process.env.COVERAGE_FULL === "1"
          ? []
          : files.map((x) => "e2e/" + x + ".spec.ts"),
        {},
      ],
      [
        "smoke",
        [
          "--config=playwright.smoke.config.ts",
          ...(process.env.COVERAGE_FULL === "1"
            ? []
            : smoke.map((x) => "smoke/" + x + ".spec.ts")),
        ],
        env.SMOKE_SCRATCHPAD_FIXTURE_PATH ? { SCRATCHPAD_FIXTURE_PATH: env.SMOKE_SCRATCHPAD_FIXTURE_PATH } : {},
      ],
      [
        "hmr",
        ["--config=playwright.hmr.config.ts"],
        { SMOKE_DEV: "true", SMOKE_BASE_URL: env.PLAYWRIGHT_FIXTURE_BASE_URL },
      ],
    ]) {
      if (label === "broad" && evidence.checks.some(row => row.label === "broad" && row.reused)) continue;
      const row = await run(
        label,
        [
          cli,
          "test",
          ...args,
          "--workers=1",
          "--retries=0",
          "--reporter=json",
          "--output=" + path.join(output, label + "-artifacts"),
        ],
        overrides,
      );
      const report = JSON.parse(fs.readFileSync(row.log, "utf8"));
      row.stats = report.stats;
      record();
      if (
        report.stats.unexpected ||
        report.stats.flaky ||
        report.stats.skipped ||
        report.errors?.length
      )
        throw Error(
          label +
            " must have zero failures, flakes and skips; inspect " +
            row.log,
        );
    }
    evidence.passed = true;
    evidence.finished_at = new Date().toISOString();
    record();
    console.log("No-skip coverage passed. Evidence: " + output);
  } finally {
    evidence.cleanup = await stopChildren(children);
    evidence.cleaned_up_at = new Date().toISOString();
    record();
    if (evidence.passed && !evidence.cleanup.some((row) => row.forced))
      process.exitCode = 0;
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
