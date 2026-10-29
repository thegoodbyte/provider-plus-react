// Real unchanged API service/controllers and Mongo schemas; only external providers
// and unrelated detail-page context reads are synthetic. Pass an API checkout that
// has been built before starting this fixture; never rebuild it while running.
const path = require("node:path"),
  fs = require("node:fs");
const api = process.env.MEDICAL_REVIEW_API_CHECKOUT;
if (!api) throw Error("MEDICAL_REVIEW_API_CHECKOUT is required");
const root = path.resolve(api),
  load = (file, key) => require(path.join(root, "dist", file))[key];
const { createFixture } = require(
  path.join(root, "test/whatsapp-download-names.fixture.cjs"),
);
(async () => {
  let f;
  const events = [];
  f = await createFixture({
    configureApp: (app) => {
      const http = app.getHttpAdapter().getInstance();
      http.get("/fixture/data", async (_, res) =>
        res.json({
          clients: await f.models.Client.find().lean(),
          users: await f.models.User.find().lean(),
          retreats: await f.models.Retreat.find().lean(),
        }),
      );
      http.get("/fixture/context", async (_, res) =>
        res.json({
          client: await f.models.Client.findById(
            "000000000000000000000001",
          ).lean(),
          artifacts: { all: [] },
          reviewHistory: [],
        }),
      );
      http.get("/fixture/snapshot", async (_, res) =>
        res.json({
          requests: await f.models.MedicalReviewRequest.find()
            .sort({ _id: 1 })
            .lean(),
          events,
        }),
      );
      http.post("/fixture/reset", async (_, res) => {
        await seed();
        res.json({ ok: true });
      });
    },
  });
  f.models.AuditLog = f.db.model(
    "AuditLog",
    load("audit-logs/audit-log.schema", "AuditLogSchema"),
  );
  await f.models.AuditLog.init();
  const notify = {};
  for (const name of [
    "notifyClientDecision",
    "notifyAssignedUser",
    "notifyClientSubmission",
    "notifyMedicalAdvisorAction",
  ])
    notify[name] = async () => {
      events.push(name);
      return { emailSent: false };
    };
  Object.assign(f.service, {
    auditLogModel: f.models.AuditLog,
    medicalTrackingModel: f.models.MedicalTracking,
    userModel: f.models.User,
    notificationService: notify,
    submissionNotifications: notify,
    logger: { warn() {}, error() {}, log() {} },
  });
  async function seed() {
    await f.seed();
    events.length = 0;
    await f.models.AuditLog.deleteMany({});
    await f.models.MedicalReviewRequest.create({
      _id: "000000000000000000000008",
      display_id: 1424,
      clientId: "000000000000000000000001",
      requestType: "ekg_review",
      status: "approved",
      reviewChannel: "whatsapp",
      whatsappStatus: "responded",
      whatsappDecision: "OK",
      reviewDecision: "OK",
      reviewNotes: "Advisor response received via WhatsApp",
    });
  }
  await seed();
  await f.app.listen(Number(process.env.TEST_FIXTURE_PORT || 0), "127.0.0.1");
  fs.writeFileSync(
    process.env.TEST_FIXTURE_OUTPUT,
    JSON.stringify({
      url: "http://127.0.0.1:" + f.app.getHttpServer().address().port,
      requestId: f.requestId,
      clientId: "000000000000000000000001",
      tokens: f.tokens,
    }),
  );
  console.log("Disposable WhatsApp result fixture ready");
  const close = async () => {
    await f.close();
    process.exit(0);
  };
  process.on("SIGTERM", close);
  process.on("SIGINT", close);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
