import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import IntegrationProviderSettings from "./IntegrationProviderSettings";
import { api } from "../services/api";
jest.mock("../services/api", () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));
const row = {
  provider: "calendly",
  environment: "local",
  revision: 1,
  enabled: false,
  mode: "sandbox",
  options: {
    apiOrigin: "https://api.calendly.com",
    userUri: "",
    organizationUri: "",
    eventTypeUri: "",
    bookingUrl:
      "https://calendly.com/ibogaspirit/ind-support-call-indywidualna-rozmowa-wspierajaca",
    queueOwner: "",
    queueBackup: "",
    notificationOwner: "calendly",
    accountSettingsReviewed: false,
    accountSettingsEvidence: "",
  },
  health: null,
  configuredSecrets: { accessToken: true, webhookKey: true },
  secretStorageReady: true,
  history: [],
};
beforeEach(() => {
  jest.clearAllMocks();
  (api.get as jest.Mock).mockImplementation((p: string) =>
    Promise.resolve({
      data:
        p === "/external-resources"
          ? { resources: [row] }
          : { pending: [], events: [] },
    }),
  );
});
it("does not preload stored secrets and blocks testing/enabling unsaved credentials", async () => {
  render(<IntegrationProviderSettings />);
  const input = await screen.findByLabelText(/Access token/);
  expect(input).toHaveValue("");
  expect(
    screen.getByRole("button", {
      name: "Enable verified unchanged connection",
    }),
  ).toBeDisabled();
  fireEvent.change(input, { target: { value: "dummy-secret" } });
  expect(
    screen.getByRole("button", { name: "Test connection read-only" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", {
      name: "Enable verified unchanged connection",
    }),
  ).toBeDisabled();
  (api.post as jest.Mock).mockResolvedValue({ data: { ...row, revision: 2 } });
  fireEvent.click(
    screen.getByRole("button", { name: "Save disabled connection settings" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/external-resources/calendly",
      expect.objectContaining({
        enabled: false,
        mode: "sandbox",
        secrets: { accessToken: "dummy-secret" },
      }),
    ),
  );
  await waitFor(() => expect(input).toHaveValue(""));
});
it("shows sandbox/environment and preserves single notification ownership", async () => {
  render(<IntegrationProviderSettings />);
  await screen.findByText("External resource settings");
  expect(
    screen.getByText(/Personal appointment confirmations/),
  ).toHaveTextContent("owned by Calendly");
  expect(screen.getByRole("option", { name: /Sandbox/ })).toBeInTheDocument();
  expect(
    screen.queryByRole("option", { name: /Live/ }),
  ).not.toBeInTheDocument();
});
it("shows masked Zoom credentials, passcode and account review controls without offering unverified enable", async () => {
  const zoom = {
    ...row,
    provider: "zoom",
    options: {
      apiOrigin: "https://api.zoom.us",
      hostUserId: "",
      waitingRoom: true,
      automaticRecording: "none",
      accountSettingsReviewed: false,
      accountSettingsEvidence: "",
      queueOwner: "",
      queueBackup: "",
    },
    configuredSecrets: {
      accountId: true,
      clientId: true,
      clientSecret: true,
      meetingPasscode: true,
    },
  };
  (api.get as jest.Mock).mockImplementation((p: string) =>
    Promise.resolve({
      data:
        p === "/external-resources"
          ? { resources: [row, zoom] }
          : p.endsWith("/zoom")
            ? { meetings: [] }
            : { pending: [], events: [] },
    }),
  );
  render(<IntegrationProviderSettings />);
  await screen.findByText("External resource settings");
  fireEvent.change(screen.getByLabelText("Provider"), {
    target: { value: "zoom" },
  });
  await screen.findByLabelText("Zoom host user ID");
  expect(screen.getByLabelText(/Client secret/)).toHaveValue("");
  expect(screen.getByLabelText(/Optional meeting passcode/)).toHaveValue("");
  expect(screen.getByLabelText("Waiting room enabled")).toBeChecked();
  expect(
    screen.getByRole("button", {
      name: "Enable verified unchanged connection",
    }),
  ).toBeDisabled();
  expect(
    screen.getByText(/Recording and AI summaries stay off/),
  ).toBeInTheDocument();
});
