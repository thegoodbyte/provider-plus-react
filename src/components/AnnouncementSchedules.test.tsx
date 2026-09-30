import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AnnouncementSchedules, {
  AnnouncementDateExample,
} from "./AnnouncementSchedules";
import { api } from "../services/api";
jest.mock("../services/api", () => ({
  api: { get: jest.fn(), post: jest.fn() },
  communicationsApi: { getSentEmail: jest.fn() },
}));
it("drills into actual recipient statuses without generating deliveries", async () => {
  (api.get as jest.Mock).mockResolvedValue({
    data: {
      retreats: [],
      retreat: {
        _id: "retreat",
        name: "Test retreat",
        startDate: "2026-10-01",
        endDate: "2026-10-08",
      },
      settings: { enabled: false },
      rows: [
        {
          ruleId: "rule",
          title: "Arrival information",
          timing: "before_start",
          days: 3,
          state: "paused",
          generatedDeliveries: 1,
          eligibleRecipients: 1,
          recipients: [
            {
              clientId: "client",
              bookingId: "booking",
              name: "Test Guest",
              status: "test_sent",
              language: "pl",
              lastError: "Safety inbox only",
            },
          ],
        },
      ],
    },
  });
  render(
    <MemoryRouter>
      <AnnouncementSchedules retreatId="retreat" />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByText("Arrival information"));
  expect(screen.getByText("Test Guest")).toBeInTheDocument();
  expect(
    screen.getByText("Test only · client not emailed"),
  ).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});
it("renders the server-computed preview and flags dates in the past", async () => {
  (api.post as jest.Mock).mockResolvedValue({
    data: {
      retreat: { name: "Next retreat", startDate: "2026-10-27" },
      scheduledFor: "2026-09-27T07:00:00Z",
      past: true,
    },
  });
  render(
    <AnnouncementDateExample
      timing="before_start"
      days={30}
      sendTime="09:00"
    />,
  );
  expect(
    await screen.findByText("This send time is in the past."),
  ).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith(
    "/announcements/date-preview",
    expect.objectContaining({ days: 30, sendTime: "09:00" }),
  );
});
