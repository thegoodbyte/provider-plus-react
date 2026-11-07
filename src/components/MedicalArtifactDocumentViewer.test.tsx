import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MedicalArtifactDocumentViewer, {
  medicalPreviewBlob,
} from "./MedicalArtifactDocumentViewer";
import { medicalArtifactsApi } from "../services/api";
jest.mock("../services/api", () => ({
  medicalArtifactsApi: { getFileBlob: jest.fn() },
}));
const files: any[] = [
  { fileName: "original.pdf", s3Key: "original", mimeType: "application/pdf" },
  {
    fileName: "english.pdf",
    s3Key: "english",
    mimeType: "application/pdf",
    variant: "english_translation",
  },
];
const pdf = () => ({
  data: new Blob(["%PDF-1.4 synthetic"], { type: "application/pdf" }),
});
beforeEach(() => {
  jest.clearAllMocks();
  let id = 0;
  URL.createObjectURL = jest.fn(() => `blob:doc-${++id}`);
  URL.revokeObjectURL = jest.fn();
  (medicalArtifactsApi.getFileBlob as jest.Mock).mockResolvedValue(pdf());
});
const mount = (p: any = {}) =>
  render(
    <MedicalArtifactDocumentViewer
      artifactId="artifact"
      files={files}
      initialPath="original"
      identity="Client #123 Synthetic"
      onClose={jest.fn()}
      {...p}
    />,
  );
it("opens the correct protected file in a portal and switches English without exposing the previous document", async () => {
  const view = mount();
  expect(
    await screen.findByRole("dialog", { name: "Full-screen document viewer" }),
  ).toBeInTheDocument();
  expect(
    await screen.findByTitle("Full-screen Original · original.pdf"),
  ).toHaveAttribute("src", "blob:doc-1#view=FitH&navpanes=0");
  expect(medicalArtifactsApi.getFileBlob).toHaveBeenCalledWith(
    "artifact",
    "original",
  );
  expect(
    screen.getByRole("link", { name: "Download document" }),
  ).toHaveAttribute("download", "original.pdf");
  fireEvent.change(screen.getByLabelText("Document version"), {
    target: { value: "english" },
  });
  expect(
    screen.queryByTitle("Full-screen Original · original.pdf"),
  ).not.toBeInTheDocument();
  expect(
    await screen.findByTitle("Full-screen English · english.pdf"),
  ).toHaveAttribute("src", "blob:doc-2#view=FitH&navpanes=0");
  expect(medicalArtifactsApi.getFileBlob).toHaveBeenLastCalledWith(
    "artifact",
    "english",
  );
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:doc-1");
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:doc-2");
});
it("ignores late responses after switching files and after closing, without creating leaked URLs", async () => {
  let first: any, last: any;
  (medicalArtifactsApi.getFileBlob as jest.Mock)
    .mockImplementationOnce(() => new Promise((r) => (first = r)))
    .mockResolvedValueOnce(pdf());
  const view = mount();
  fireEvent.change(screen.getByLabelText("Document version"), {
    target: { value: "english" },
  });
  await screen.findByTitle("Full-screen English · english.pdf");
  first(pdf());
  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
  view.unmount();
  (medicalArtifactsApi.getFileBlob as jest.Mock).mockImplementationOnce(
    () => new Promise((r) => (last = r)),
  );
  const closed = mount();
  closed.unmount();
  last(pdf());
  await Promise.resolve();
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
});
it("fails closed for denied/failed reads and retries the selected file without showing a prior version", async () => {
  (medicalArtifactsApi.getFileBlob as jest.Mock).mockRejectedValueOnce({
    response: { status: 403 },
  });
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("permission");
  expect(
    screen.queryByRole("link", { name: "Download document" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry document" }));
  await screen.findByTitle("Full-screen Original · original.pdf");
  (medicalArtifactsApi.getFileBlob as jest.Mock).mockRejectedValueOnce(
    Error("unavailable"),
  );
  fireEvent.change(screen.getByLabelText("Document version"), {
    target: { value: "english" },
  });
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load"),
  );
  expect(
    screen.queryByTitle("Full-screen Original · original.pdf"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Open in new tab" }),
  ).not.toBeInTheDocument();
});
it("restores focus on unmount and closes via its button or Escape", async () => {
  const trigger = document.createElement("button");
  document.body.appendChild(trigger);
  trigger.focus();
  const close = jest.fn(),
    view = mount({ onClose: close });
  await screen.findByTitle("Full-screen Original · original.pdf");
  fireEvent.click(screen.getByRole("button", { name: "Close viewer" }));
  expect(close).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(screen.getByRole("dialog"), {
    key: "Escape",
    code: "Escape",
    keyCode: 27,
  });
  expect(close).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(trigger).toHaveFocus();
  trigger.remove();
});
it("renders safe images, rejects active HTML/SVG and keeps the requested identity when a file disappears", async () => {
  const images: any[] = [
    { fileName: "scan.png", filePath: "scan", mimeType: "image/png" },
  ];
  (medicalArtifactsApi.getFileBlob as jest.Mock).mockResolvedValueOnce({
    data: new Blob(["synthetic image"], { type: "image/png" }),
  });
  const view = mount({ files: images, initialPath: "scan" });
  await screen.findByRole("img", { name: "Original · scan.png" });
  view.rerender(
    <MedicalArtifactDocumentViewer
      artifactId="artifact"
      files={[]}
      initialPath="scan"
      identity="Client"
      onClose={jest.fn()}
    />,
  );
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("no longer available"),
  );
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(() =>
    medicalPreviewBlob(
      new Blob(["<script/>"], { type: "text/html" }),
      files[0],
    ),
  ).toThrow(/safely/);
  expect(() =>
    medicalPreviewBlob(
      new Blob(["<svg/>"], { type: "image/svg+xml" }),
      images[0],
    ),
  ).toThrow(/safely/);
  expect(
    medicalPreviewBlob(
      new Blob(["%PDF-1.4"], { type: "application/octet-stream" }),
      files[0],
    ).blob.type,
  ).toBe("application/pdf");
});
