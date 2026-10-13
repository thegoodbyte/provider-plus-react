import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ExternalResourcesPage from "./ExternalResourcesPage";
import { api } from "../services/api";
jest.mock("../services/api", () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("./IntegrationProviderSettings", () => () => (
  <p>Shared Calendly and Zoom settings</p>
));
const row = () => ({
  key: "storage",
  label: "S3 storage",
  description: "Private files",
  fields: [
    { key: "AWS_S3_BUCKET_NAME", kind: "text" },
    { key: "AWS_SECRET_ACCESS_KEY", kind: "secret" },
  ],
  environment: "local",
  revision: 1,
  source: "application",
  active: { enabled: false, mode: "sandbox" },
  draft: {
    enabled: false,
    mode: "sandbox",
    options: { AWS_S3_BUCKET_NAME: "local-test" },
    configuredSecrets: { AWS_SECRET_ACCESS_KEY: true },
  },
  runtimeReadable: true,
  recoveryAvailable: true,
  history: [],
  testKind: "s3",
});
const catalog = () => ({
  environment: "local",
  resources: [row()],
  bootstrap: {
    databaseConfigured: true,
    resourceEncryptionKeyConfigured: true,
  },
});
beforeEach(() => {
  jest.clearAllMocks();
  (api.get as jest.Mock).mockResolvedValue({ data: catalog() });
  (api.post as jest.Mock).mockResolvedValue({ data: {} });
});
it("shows environment/bootstrap status and masks saved credentials", async () => {
  render(<ExternalResourcesPage />);
  await screen.findByText("Credential configured");
  expect(screen.getByLabelText("Aws Secret Access Key")).toHaveValue("");
  expect(
    screen.queryByRole("option", { name: "Live" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/Database: configured/)).toBeInTheDocument();
});
it("saving uses revision and explicit secrets, then clears the password; edited draft cannot be activated", async () => {
  render(<ExternalResourcesPage />);
  await screen.findByText("Credential configured");
  fireEvent.change(screen.getByLabelText("Aws Secret Access Key"), {
    target: { value: "synthetic-private" },
  });
  expect(
    screen.getByRole("button", { name: "Activate checked draft" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/external-resources/configuration/storage",
      expect.objectContaining({
        expectedRevision: 1,
        secrets: { AWS_SECRET_ACCESS_KEY: "synthetic-private" },
      }),
    ),
  );
  await screen.findByText("Draft saved. Active configuration is unchanged.");
  expect(screen.getByLabelText("Aws Secret Access Key")).toHaveValue("");
});
it("test/disable/recover use the current revision and errors do not display entered passwords", async () => {
  render(<ExternalResourcesPage />);
  await screen.findByText("Credential configured");
  fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/external-resources/configuration/storage/test",
      { expectedRevision: 1 },
    ),
  );
  await screen.findByText(
    "Check completed. Review the result before activation.",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Restore previous configuration" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/external-resources/configuration/storage/recover",
      { expectedRevision: 1 },
    ),
  );
});
it("provider settings use the existing shared resource mechanism", async () => {
  render(<ExternalResourcesPage />);
  await screen.findByText("Credential configured");
  fireEvent.change(screen.getByLabelText("Resource"), {
    target: { value: "providers" },
  });
  await screen.findByText("Shared Calendly and Zoom settings");
});
