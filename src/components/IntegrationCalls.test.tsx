import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import IntegrationCalls, { callMonthRange } from "./IntegrationCalls";
import { integrationCalendarApi as api } from "../services/integrationCalendarApi";
jest.mock("../services/integrationCalendarApi", () => ({
  integrationCalendarApi: {
    get: jest.fn(),
    options: jest.fn(),
    save: jest.fn(),
  },
}));
jest.mock("./IntegrationLiveSession", () => ({
  __esModule: true,
  default: ({ initialCallId }: any) => <div>Notes for {initialCallId}</div>,
}));
const person = { id: "c1", number: 501, name: "Ewa Fixture" };
const call = {
  _id: "call1",
  title: "Support conversation",
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 1800000).toISOString(),
  status: "scheduled",
  kind: "individual",
  participants: [{ clientId: "c1", name: person.name }],
  retreatName: "Direct support",
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(window, "confirm").mockReturnValue(true);
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => "fixture-call-request",
  });
  (api.get as jest.Mock).mockResolvedValue({
    data: { calls: [call], retreats: [] },
  });
  (api.options as jest.Mock).mockResolvedValue({
    data: {
      clients: [person, { id: "c2", name: "Other Fixture", number: 502 }],
      bookings: [],
    },
  });
  (api.save as jest.Mock).mockResolvedValue({ data: call });
});
afterEach(() => jest.restoreAllMocks());
it("calculates leap-year and December month bounds", () => {
  expect(callMonthRange("2028-02")).toEqual({
    from: "2028-02-01",
    to: "2028-02-29",
  });
  expect(callMonthRange("2026-12").to).toBe("2026-12-31");
});
it("scopes calls to the same client and booking and opens the selected notes directly", async () => {
  render(<IntegrationCalls clientId="c1" bookingId="b1" />);
  await screen.findByText("Support conversation");
  expect(api.get).toHaveBeenCalledWith(
    expect.objectContaining({ clientId: "c1", bookingId: "b1" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Start notes" }));
  expect(await screen.findByText("Notes for call1")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Optional conversation prompts"));
  expect(
    screen.getByText("What one manageable next step do we agree on?"),
  ).toBeInTheDocument();
});
it("switches list/calendar, filters calls and navigates month boundaries without writes", async () => {
  render(<IntegrationCalls />);
  await screen.findByText("Support conversation");
  fireEvent.click(
    screen.getByRole("button", { name: "Calendar", exact: true }),
  );
  expect(
    screen.getByRole("region", { name: "Monthly integration calendar" }),
  ).toBeInTheDocument();
  expect(
    screen.getAllByRole("button", { name: /Support conversation/ }),
  ).toHaveLength(1);
  fireEvent.change(screen.getByLabelText("Find a call"), {
    target: { value: "no match" },
  });
  expect(screen.getByText(/No calls match/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Month"), {
    target: { value: "2026-12" },
  });
  fireEvent.click(screen.getByLabelText("Next month"));
  await waitFor(() =>
    expect(api.get).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: "2027-01-01", to: "2027-01-31" }),
    ),
  );
  expect(api.save).not.toHaveBeenCalled();
});
it("records direct support now with one selected client and opens notes only after save", async () => {
  render(<IntegrationCalls clientId="c1" />);
  await screen.findByText("Support conversation");
  fireEvent.click(screen.getByRole("button", { name: "Record a call now" }));
  await screen.findByText(/#501 Ewa Fixture/);
  fireEvent.click(screen.getByRole("button", { name: "Save and open notes" }));
  await screen.findByText("Notes for call1");
  expect(api.save).toHaveBeenCalledWith(
    undefined,
    expect.objectContaining({
      kind: "individual",
      clientIds: ["c1"],
      retreatId: "",
      bookingId: "",
      durationMinutes: 30,
      requestId: "fixture-call-request",
    }),
  );
});
it("schedules a group and retains the form and retry identity after a failed save", async () => {
  (api.save as jest.Mock)
    .mockRejectedValueOnce({
      response: { data: { message: "Temporary save failure" } },
    })
    .mockResolvedValueOnce({ data: call });
  render(<IntegrationCalls />);
  await screen.findByText("Support conversation");
  fireEvent.click(screen.getByRole("button", { name: "Schedule call" }));
  fireEvent.change(screen.getByLabelText("Type", { exact: true }), {
    target: { value: "group" },
  });
  await screen.findByText(/#501 Ewa Fixture/);
  fireEvent.click(screen.getByLabelText(/#501 Ewa Fixture/));
  fireEvent.click(screen.getByLabelText(/#502 Other Fixture/));
  fireEvent.click(screen.getByLabelText("Ewa Fixture will attend"));
  expect(screen.getByLabelText("Other Fixture will attend")).not.toBeChecked();
  fireEvent.change(screen.getByLabelText("Title", { exact: true }), {
    target: { value: "Group check-in" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save call", exact: true }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Temporary save failure",
  );
  expect(screen.getByLabelText("Title", { exact: true })).toHaveValue(
    "Group check-in",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Save call", exact: true }),
  );
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(2));
  const [first, second] = (api.save as jest.Mock).mock.calls;
  expect(first[1].requestId).toBe(second[1].requestId);
  expect(second[1]).toMatchObject({
    clientIds: ["c1", "c2"],
    durationMinutes: 75,
    kind: "group",
  });
  expect(second[1].attendance).toEqual([{ clientId: "c1", willAttend: true }]);
  expect(screen.queryByText("attended")).not.toBeInTheDocument();
});
