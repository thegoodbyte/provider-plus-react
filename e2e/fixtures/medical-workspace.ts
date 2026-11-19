import path from "node:path";
export async function medicalWorkspace(f: any) {
  const root = path.resolve(process.env.TEST_API_CHECKOUT || "../api");
  const load = (p: string, k: string) => require(path.join(root, "dist", p))[k];
  const { Test } = require(path.join(root, "node_modules/@nestjs/testing"));
  const { Reflector } = require(path.join(root, "node_modules/@nestjs/core"));
  const defs: any = {
    MedicalArtifact: [
      "medical-artifacts/schemas/medical-artifact.schema",
      "MedicalArtifactSchema",
    ],
    MedicalReviewRequest: [
      "medical-review-requests/schemas/medical-review-request.schema",
      "MedicalReviewRequestSchema",
    ],
    Ceremony: ["retreat/schemas/ceremony.schema", "CeremonySchema"],
  };
  for (const [name, [p, k]] of Object.entries(defs) as any)
    f.models[name] = f.db.model(name, load(p, k));
  await Promise.all(Object.values(f.models).map((model: any) => model.init()));
  const Service = load(
    "medical-artifacts/medical-artifacts.service",
    "MedicalArtifactsService",
  );
  const sequence = new (load(
    "common/sequence-counter.service",
    "SequenceCounterService",
  ))(f.models.SequenceCounter);
  const service = new Service(
    f.models.MedicalArtifact,
    f.models.RetreatClient,
    f.models.Retreat,
    f.models.MedicalReviewRequest,
    undefined,
    sequence,
  );
  const provide = (p: string, k: string, value: any) => ({
    provide: load(p, k),
    useValue: value,
  });
  const module = await Test.createTestingModule({
    controllers: [
      load(
        "medical-artifacts/medical-artifacts.controller",
        "MedicalArtifactsController",
      ),
    ],
    providers: [
      { provide: Service, useValue: service },
      Reflector,
      load("auth/roles.guard", "RolesGuard"),
      provide("common/services/s3.service", "S3Service", {
        getPresignedUrl: async () =>
          "http://127.0.0.1/synthetic-captured-medical-file.pdf",
      }),
      provide("file-uploads/file-uploads.service", "FileUploadsService", {}),
      provide(
        "medical-artifacts/medical-artifact-translation.service",
        "MedicalArtifactTranslationService",
        {},
      ),
      provide("common/services/thumbnail.service", "ThumbnailService", {}),
      provide(
        "medical-artifacts/medical-artifact-ai-assessment.service",
        "MedicalArtifactAiAssessmentService",
        {},
      ),
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  app.enableCors({ origin: true, credentials: true });
  await app.listen(0, "127.0.0.1");
  return { app, url: await app.getUrl(), close: () => app.close() };
}
