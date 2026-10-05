import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import IntegrationCalendar, {
  pragueInput,
  calendarDays,
} from "./IntegrationCalendar";
import { integrationCalendarApi } from "../services/integrationCalendarApi";
jest.mock("../services/integrationCalendarApi", () => ({
  integrationCalendarApi: { get: jest.fn(), save: jest.fn(), supportRequests: jest.fn().mockResolvedValue({ data: [] }), updateSupportRequest: jest.fn() },
}));
const person = {
  clientId: "client",
  bookingId: "booking",
  name: "Sample Guest",
};
const base = {
  from: "2026-09-20",
  to: "2026-11-01",
  retreat: { id: "retreat", name: "JNO-09", endDate: "2026-09-20" },
  retreats: [{ id: "retreat", name: "JNO-09" }],
  clients: [person],
  calls: [],
  suggestions: [
    {
      checkpointNumber: 1,
      date: "2026-09-27",
      title: "Group integration call I",
    },
  ],
  questions: [{ key: "howAreYouDoing", label: "How are you doing?" }],
};
const call = {
  _id: "call",
  retreatId: "retreat",
  retreatName: "JNO-09",
  title: "Group integration call I",
  kind: "group",
  checkpointNumber: 1,
  startsAt: "2026-09-27T16:00:00Z",
  endsAt: "2026-09-27T17:00:00Z",
  status: "scheduled",
  updatedAt: "2026-09-28",
  participants: [
    {
      ...person,
      attendance: "not_recorded",
      wellbeing: "not_recorded",
      answers: {},
    },
  ],
};
beforeEach(() => {
  (integrationCalendarApi.get as jest.Mock).mockResolvedValue({ data: base });
  (integrationCalendarApi.save as jest.Mock).mockResolvedValue({ data: call });
  Object.defineProperty(window.crypto, "randomUUID", {
    configurable: true,
    value: () => "test-request-123",
  });
});
it("shows 43 calendar dates and client columns without creating calls", async () => {
  render(<IntegrationCalendar retreatId="retreat" />);
  await screen.findByText("Sample Guest");
  expect(calendarDays(base.from, base.to)).toHaveLength(43);
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(integrationCalendarApi.save).not.toHaveBeenCalled();
});
it("schedules a suggested group call with a stable retry ID and explicit Prague local time", async () => {
  render(<IntegrationCalendar retreatId="retreat" />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: /Group integration call I.*Schedule/,
    }),
  );
  expect(screen.getByLabelText("Starts (Prague time)")).toHaveValue(
    "2026-09-27T18:00",
  );
  fireEvent.change(screen.getByLabelText("Zoom / WhatsApp / meeting link"), {
    target: { value: "https://zoom.us/j/test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save call" }));
  await waitFor(() =>
    expect(integrationCalendarApi.save).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        requestId: "test-request-123",
        checkpointNumber: 1,
        clientIds: ["client"],
        localStart: "2026-09-27T18:00",
        meetingUrl: "https://zoom.us/j/test",
      }),
    ),
  );
});
it("renders group calls across all client columns and individual calls in their client column", async () => {
  (integrationCalendarApi.get as jest.Mock).mockResolvedValue({
    data: {
      ...base,
      suggestions: [],
      clients: [person, { clientId: "other", name: "Other Guest" }],
      calls: [
        call,
        {
          ...call,
          _id: "individual",
          title: "Individual integration",
          kind: "individual",
        },
      ],
    },
  });
  render(<IntegrationCalendar retreatId="retreat" />);
  const group = await screen.findByRole("button", {
    name: /18:00–19:00 · Group integration/,
  });
  expect(group.closest("td")).toHaveAttribute("colspan", "2");
  const individual = screen.getByRole("button", {
    name: /18:00–19:00 · Individual integration/,
  });
  expect(individual.closest("td")).not.toHaveAttribute("colspan");
});
it("shows an overlap conflict and requires deliberate acknowledgement to override it", async () => {
  (integrationCalendarApi.save as jest.Mock).mockRejectedValueOnce({
    response: {
      data: {
        message: "Overlapping participant",
        conflicts: [
          {
            id: "conflict",
            title: "Other call",
            startsAt: "2026-09-27T16:00Z",
          },
        ],
      },
    },
  });
  render(<IntegrationCalendar retreatId="retreat" />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Schedule a call" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save call" }));
  await screen.findByText("Overlapping participant");
  fireEvent.click(screen.getByLabelText(/I reviewed these conflicts/));
  fireEvent.click(screen.getByRole("button", { name: "Save call" }));
  await waitFor(() =>
    expect(integrationCalendarApi.save).toHaveBeenLastCalledWith(
      undefined,
      expect.objectContaining({
        allowOverlap: true,
        requestId: "test-request-123",
      }),
    ),
  );
});
it("records per-call attendance, follow-up and answers with an optimistic version", async () => {
  (integrationCalendarApi.get as jest.Mock).mockResolvedValue({
    data: { ...base, calls: [call], suggestions: [] },
  });
  render(<IntegrationCalendar retreatId="retreat" />);
  fireEvent.click(
    await screen.findByRole("button", { name: /18:00–19:00 · Group/ }),
  );
  fireEvent.click(screen.getByText(/Sample Guest · not recorded/));
  fireEvent.change(screen.getByLabelText("Attendance for Sample Guest"), {
    target: { value: "attended" },
  });
  fireEvent.change(screen.getByLabelText("Follow-up for Sample Guest"), {
    target: { value: "needs_follow_up" },
  });
  fireEvent.change(screen.getByLabelText("How are you doing?"), {
    target: { value: "Would like another conversation" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save call" }));
  await waitFor(() =>
    expect(integrationCalendarApi.save).toHaveBeenCalledWith(
      "call",
      expect.objectContaining({
        expectedUpdatedAt: "2026-09-28",
        attendance: [
          expect.objectContaining({
            attendance: "attended",
            wellbeing: "needs_follow_up",
            answers: { howAreYouDoing: "Would like another conversation" },
          }),
        ],
      }),
    ),
  );
});
it("supports an all-retreat agenda and hides cancelled calls until requested", async () => {
  (integrationCalendarApi.get as jest.Mock).mockResolvedValue({
    data: {
      ...base,
      retreat: null,
      suggestions: [],
      calls: [{ ...call, status: "cancelled" }],
    },
  });
  render(<IntegrationCalendar />);
  await screen.findByText(/No calls in this date range/);
  fireEvent.click(screen.getByLabelText("Show cancelled"));
  expect(
    screen.getByRole("button", { name: /18:00–19:00 · Group/ }),
  ).toHaveClass("cancelled");
});
it("converts stored UTC times to Prague inputs without depending on browser timezone", () => {
  expect(pragueInput("2026-09-27T16:00Z")).toBe("2026-09-27T18:00");
  expect(pragueInput("2026-01-27T17:00Z")).toBe("2026-01-27T18:00");
});
it("retains an editor after a failed save", async () => {
  (integrationCalendarApi.save as jest.Mock).mockRejectedValue({
    response: { data: { message: "Call changed. Reload." } },
  });
  render(<IntegrationCalendar retreatId="retreat" />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Schedule a call" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save call" }));
  await screen.findByText("Call changed. Reload.");
  expect(
    screen.getByRole("form", { name: "Integration call" }),
  ).toBeInTheDocument();
});
it('prefills an individual call from a client support request on the global calendar', async () => {
  (integrationCalendarApi.supportRequests as jest.Mock).mockResolvedValueOnce({ data: [{ _id: 'request', retreatId: { _id: 'retreat', name: 'JNO-09' }, clientId: { _id: 'client', firstName: 'Ada' }, createdAt: '2026-10-05', status: 'requested', message: 'Please arrange support' }] });
  render(<IntegrationCalendar />);
  fireEvent.click(await screen.findByRole('button', { name: 'Schedule individual call' }));
  await waitFor(() => expect(screen.getByLabelText('Call type')).toHaveValue('individual'));
  expect(screen.getByLabelText('Title')).toHaveValue('Individual integration support');
  fireEvent.click(screen.getByRole('button', { name: 'Save call' }));
  await waitFor(() => expect(integrationCalendarApi.save).toHaveBeenCalledWith(undefined, expect.objectContaining({ kind: 'individual', retreatId: 'retreat', clientIds: ['client'] })));
  (integrationCalendarApi.supportRequests as jest.Mock).mockResolvedValue({ data: [] });
});
