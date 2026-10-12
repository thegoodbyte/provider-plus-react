import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import IntegrationReconnect from "./IntegrationReconnect";
import { api } from "../services/api";
jest.mock("../services/api", () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "staff", role: "admin" } }),
}));
it("shows last meaningful contact, permission suppression and promises without triggering any send or mutation", async () => {
  (api.get as jest.Mock).mockResolvedValue({
    data: {
      today: "2026-10-13",
      rows: [
        {
          clientId: "client",
          name: "Historic client",
          email: "client@example.com",
          language: "cz",
          retreatName: "January retreat",
          homecomingDate: "2026-01-10",
          lastMeaningfulContactAt: null,
          lastOutboundAt: "2026-10-01",
          outstanding: [
            {
              key: "promise",
              title: "Promised follow-up call",
              owner: "Owner",
              dueDate: "2026-10-14",
            },
          ],
          suppression: ["Explicit reconnection permission is missing."],
          permission: { revision: 0, evidence: "" },
          outreach: null,
        },
      ],
    },
  });
  render(<IntegrationReconnect />);
  expect(await screen.findByText("Historic client")).toBeInTheDocument();
  expect(
    screen.getByText("Promised follow-up call · Owner · 2026-10-14"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Explicit reconnection permission is missing."),
  ).toBeInTheDocument();
  expect(screen.getByText(/Meaningful: Unknown/)).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});
