import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

it("requires selected clients, named owners and explicit offer review before a no-send preview", async () => {
  const row = {
    clientId: "client",
    name: "Historic client",
    email: "client@example.com",
    language: "en",
    retreatName: "Old retreat",
    homecomingDate: "2026-01-10",
    outstanding: [],
    suppression: [],
    permission: { revision: 1, evidence: "Client asked" },
    outreach: null,
  };
  (api.get as jest.Mock).mockResolvedValue({
    data: {
      rows: [row],
      staff: [
        { id: "owner", name: "Owner" },
        { id: "backup", name: "Backup" },
      ],
      programs: [],
      today: "2026-10-13",
    },
  });
  (api.post as jest.Mock).mockResolvedValue({
    data: {
      eligibleCount: 1,
      heldCount: 0,
      totalSessionsOffered: 0,
      totalSessionMinutes: 0,
      candidates: [
        {
          clientId: "client",
          name: "Historic client",
          recipient: "client@example.com",
          language: "en",
          subject: "Reviewed invitation",
          bodyText: "Personal reviewed invitation",
          reasons: [],
        },
      ],
    },
  });
  render(<IntegrationReconnect />);
  await screen.findByText("Historic client");
  fireEvent.click(screen.getByText("Preview a reviewed reconnection batch"));
  const button = screen.getByText("Preview recipients, text and capacity");
  expect(button).toBeDisabled();
  fireEvent.click(
    screen.getByLabelText("Select Historic client for reconnection"),
  );
  fireEvent.change(screen.getByLabelText("Reconnection owner"), {
    target: { value: "owner" },
  });
  fireEvent.change(screen.getByLabelText("Reconnection backup"), {
    target: { value: "backup" },
  });
  fireEvent.change(
    screen.getByLabelText("Reviewed availability / response capacity evidence"),
    { target: { value: "Reviewed actual availability" } },
  );
  fireEvent.change(screen.getByLabelText("Legacy offer review evidence"), {
    target: { value: "Conversation only, no new credits" },
  });
  fireEvent.click(
    screen.getByLabelText(
      "I reviewed this explicit legacy offer and its capacity",
    ),
  );
  fireEvent.click(button);
  expect(
    await screen.findByText("Personal reviewed invitation"),
  ).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith(
    "/integration/reconnect/preview",
    expect.objectContaining({
      clientIds: ["client"],
      policy: expect.objectContaining({ owner: "owner", backup: "backup" }),
      offer: expect.objectContaining({
        kind: "conversation",
        sessionCount: 0,
        reviewed: true,
      }),
    }),
  );
});
