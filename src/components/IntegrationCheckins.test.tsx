import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import IntegrationCheckins from "./IntegrationCheckins";
import { api } from "../services/api";
jest.mock("../services/api", () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));
beforeEach(() => {
  jest.clearAllMocks();
  (api.get as jest.Mock).mockResolvedValue({
    data: {
      settings: {
        revision: 1,
        enabled: false,
        libraryId: "",
        policyId: "",
        days: [1, 7],
        retentionDays: 365,
        concernRules: [],
        privacyNotice: { en: "", cz: "", pl: "" },
      },
      forms: [
        {
          _id: "form",
          day: 1,
          dueDate: "2026-10-13",
          clientId: { firstName: "Own", lastName: "Client" },
          submissions: [],
          snapshot: { questions: [] },
        },
      ],
      requests: [
        {
          _id: "request",
          revision: 2,
          clientId: { firstName: "Own", lastName: "Client" },
          status: "requested",
          active: true,
          owner: "Owner",
          backup: "Backup",
          dueDate: "2026-10-13",
          history: [],
        },
      ],
      libraries: [],
      policies: [],
    },
  });
  (api.post as jest.Mock).mockResolvedValue({ data: {} });
});
it("shows unknown rather than well and does not treat drafts as shared responses", async () => {
  render(<IntegrationCheckins />);
  await screen.findByText("Unknown — no shared response");
  fireEvent.click(screen.getByRole("button", { name: "View shared versions" }));
  expect(
    screen.getByText("No shared response. Draft answers are private."),
  ).toBeInTheDocument();
});
it("requires response evidence and explicit resolution", async () => {
  render(<IntegrationCheckins />);
  await screen.findByRole("button", { name: "Review request" });
  fireEvent.click(screen.getByRole("button", { name: "Review request" }));
  const save = screen.getByRole("button", { name: "Save support state" });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Request state"), {
    target: { value: "resolved" },
  });
  fireEvent.change(
    screen.getByLabelText("Response / agreed resolution evidence"),
    {
      target: {
        value: "Client agreed next steps; confirmed support provided.",
      },
    },
  );
  fireEvent.click(save);
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/integration/checkins/requests/request",
      {
        expectedRevision: 2,
        status: "resolved",
        owner: "Owner",
        backup: "Backup",
        dueDate: "2026-10-13",
        evidence: "Client agreed next steps; confirmed support provided.",
      },
    ),
  );
});
