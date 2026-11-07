import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import MedicalArtifactDetailPage from "./MedicalArtifactDetailPage";
import { medicalArtifactsApi, medicalReviewRequestsApi } from "../services/api";
jest.mock("../services/api", () => ({
  medicalArtifactsApi: {
    getOne: jest.fn(),
    generateEnglishTranslation: jest.fn(),
    getFileBlob: jest.fn(),
  },
  medicalReviewRequestsApi: {
    getByArtifact: jest.fn().mockResolvedValue({ data: [] }),
  },
  bookingsApi: { getByClient: jest.fn().mockResolvedValue({ data: [] }) },
}));
jest.mock("../services/usersApi", () => ({ usersApi: {} }));
const artifact: any = {
  _id: "artifact-1345",
  display_id: 1345,
  artifactType: "medications_form",
  originalLanguage: "pl",
  title: "Medications",
  files: [],
  translation: { status: "ready", sourceLanguage: "pl" },
};
it("exposes desktop regeneration and forces a fresh translation using the selected language", async () => {
  (medicalReviewRequestsApi.getByArtifact as jest.Mock).mockResolvedValue({
    data: [],
  });
  (medicalArtifactsApi.getOne as jest.Mock).mockResolvedValue({
    data: artifact,
  });
  (
    medicalArtifactsApi.generateEnglishTranslation as jest.Mock
  ).mockResolvedValue({ data: artifact });
  render(
    <MemoryRouter initialEntries={["/admin/medical-artifacts/artifact-1345"]}>
      <Routes>
        <Route
          path="/admin/medical-artifacts/:id"
          element={<MedicalArtifactDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
  const button = await screen.findByRole("button", {
    name: "Regenerate English translation",
  });
  expect(button.closest(".md\\:hidden")).toBeNull();
  expect(
    screen
      .getByRole("button", { name: "Regenerate English", exact: true })
      .closest(".md\\:hidden"),
  ).toBeNull();
  fireEvent.change(screen.getByLabelText("Original language"), {
    target: { value: "cs" },
  });
  fireEvent.click(button);
  await waitFor(() =>
    expect(medicalArtifactsApi.generateEnglishTranslation).toHaveBeenCalledWith(
      "artifact-1345",
      "cs",
      true,
    ),
  );
});

const originalFile: any = {
  s3Key: "original.pdf",
  fileName: "original.pdf",
  mimeType: "application/pdf",
};
const englishFile: any = {
  s3Key: "english.pdf",
  fileName: "english.pdf",
  mimeType: "application/pdf",
  variant: "english_translation",
};
function documentPage(value: any) {
  (medicalReviewRequestsApi.getByArtifact as jest.Mock).mockResolvedValue({
    data: [],
  });
  (medicalArtifactsApi.getOne as jest.Mock).mockResolvedValue({ data: value });
  (medicalArtifactsApi.getFileBlob as jest.Mock).mockResolvedValue({
    data: new Blob(["%PDF-1.4"], { type: "application/pdf" }),
  });
  let n = 0;
  URL.createObjectURL = jest.fn(() => `blob:record-${++n}`);
  URL.revokeObjectURL = jest.fn();
  return render(
    <MemoryRouter initialEntries={["/admin/medical-artifacts/artifact-1345"]}>
      <Routes>
        <Route
          path="/admin/medical-artifacts/:id"
          element={<MedicalArtifactDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}
it("opens the saved English version directly beside the generation controls in the original record without generating again", async () => {
  jest.clearAllMocks();
  documentPage({
    ...artifact,
    artifactType: "questionnaire",
    files: [originalFile, englishFile],
  });
  const open = await screen.findByRole("button", {
    name: "View English full screen",
    exact: true,
  });
  expect(open.parentElement).toContainElement(
    screen.getByRole("button", { name: "Regenerate English", exact: true }),
  );
  fireEvent.click(open);
  await screen.findByTitle("Full-screen English · english.pdf");
  expect(medicalArtifactsApi.getFileBlob).toHaveBeenLastCalledWith(
    "artifact-1345",
    "english.pdf",
  );
  expect(medicalArtifactsApi.generateEnglishTranslation).not.toHaveBeenCalled();
});
it("enables the English viewer after generation returns the new file and keeps original viewing separate", async () => {
  jest.clearAllMocks();
  documentPage({
    ...artifact,
    artifactType: "questionnaire",
    translation: undefined,
    files: [originalFile],
  });
  const open = await screen.findByRole("button", {
    name: "View English full screen",
    exact: true,
  });
  expect(open).toBeDisabled();
  const generated = {
    ...artifact,
    artifactType: "questionnaire",
    files: [originalFile, englishFile],
  };
  (
    medicalArtifactsApi.generateEnglishTranslation as jest.Mock
  ).mockResolvedValue({ data: generated });
  fireEvent.click(
    screen.getByRole("button", { name: "Generate English", exact: true }),
  );
  await waitFor(() => expect(open).toBeEnabled());
  fireEvent.click(open);
  await screen.findByTitle("Full-screen English · english.pdf");
  expect(medicalArtifactsApi.generateEnglishTranslation).toHaveBeenCalledTimes(
    1,
  );
});
