import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import IntegrationDashboard from "./IntegrationDashboard";
import { api } from "../services/api";
jest.mock("../services/api", () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));
it("shows uncovered historical promises and reconciliation lag without sending or claiming wellbeing", async () => {
  (api.get as jest.Mock).mockResolvedValue({
    data: {
      settings: {
        enabled: false,
        timezone: "Europe/Prague",
        workingDays: [1, 2, 3, 4, 5],
        responseStart: "09:00",
        responseEnd: "17:00",
        digestAt: "09:00",
        escalationDays: [1, 3],
        capacityReviewed: false,
      },
      actions: [],
      alerts: [],
      calls: [],
      totals: {
        legacyFollowUps: 1,
        overdueLegacyFollowUps: 1,
        uncoveredLegacyFollowUps: 1,
      },
      reconciliation: {
        failedDeliveryJobs: 1,
        uncertainDeliveryJobs: 2,
        deadLetterJobs: 3,
        pendingReplyRouting: 1,
        pendingProviderEvents: 4,
        oldestPendingAgeMinutes: 120,
      },
      legacyFollowUps: [
        {
          id: "task",
          title: "Respond to historical-client reply",
          clientName: "Synthetic client",
          owner: "absent",
          backup: "backup",
          ownerAvailable: false,
          backupAvailable: true,
          dueAt: "2026-10-10T12:00:00Z",
          overdue: true,
        },
      ],
    },
  });
  render(
    <IntegrationDashboard openCare={jest.fn()} openCalendar={jest.fn()} />,
  );
  expect(
    await screen.findByText("Respond to historical-client reply"),
  ).toBeInTheDocument();
  expect(screen.getByText(/Owner unavailable/)).toBeInTheDocument();
  expect(screen.getByText(/120 minutes/)).toBeInTheDocument();
  expect(
    screen.getByText(/do not assess client wellbeing/),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Review Tasks" })).toHaveAttribute(
    "href",
    "/admin/tasks",
  );
  expect(api.post).not.toHaveBeenCalled();
});
