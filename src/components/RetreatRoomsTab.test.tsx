import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RetreatRoomsTab from "./RetreatRoomsTab";
import { roomInventoryApi } from "../services/roomInventoryApi";
jest.mock("../services/roomInventoryApi", () => ({
  roomInventoryApi: {
    view: jest.fn(),
    quote: jest.fn(),
    assign: jest.fn(),
    configure: jest.fn(),
  },
}));
jest.mock("../services/authService", () => ({
  authService: { getUser: () => ({ role: "admin" }) },
}));
const person = {
  _id: "booking",
  name: "Test Guest",
  bookingNumber: 1001,
  status: "confirmed",
  accommodationKey: "shared",
  totalAmount: 2000,
  currency: "EUR",
  updatedAt: "2026-09-28",
};
const data = {
  house: { name: "Test House" },
  configured: true,
  startDate: "2026-10-01",
  endDate: "2026-10-10",
  rooms: [
    {
      roomId: "room",
      name: "Room 1",
      floor: "Second floor",
      beds: 2,
      use: "flexible",
      hasBathroom: true,
      freeBeds: 2,
      occupants: [],
      externalOccupants: [],
    },
  ],
  bookings: [person],
  unassigned: [person],
  unallocatedConfirmed: 1,
  pendingPreferences: 0,
  availableToSell: 0,
  options: [
    {
      key: "shared",
      active: true,
      labels: { en: "Shared room" },
      occupancy: "shared",
      bathroom: "any",
    },
  ],
  rates: {},
};
beforeEach(() => {
  (roomInventoryApi.view as jest.Mock).mockResolvedValue({ data });
  (roomInventoryApi.quote as jest.Mock).mockResolvedValue({
    data: {
      oldTotal: 2000,
      newTotal: 2100,
      difference: 100,
      currency: "EUR",
      remainingBalance: 100,
      credit: 0,
    },
  });
  (roomInventoryApi.assign as jest.Mock).mockResolvedValue({ data: {} });
});
const mount = () =>
  render(
    <MemoryRouter>
      <RetreatRoomsTab retreatId="retreat" />
    </MemoryRouter>,
  );
it("shows named unassigned commitments separately from physical free beds", async () => {
  mount();
  expect(await screen.findByText("Test Guest")).toBeInTheDocument();
  expect(screen.getByText("0 places available to sell")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Table view"));
  expect(screen.getByRole("table")).toBeInTheDocument();
});
it("reviews the financial difference before saving with the booking version", async () => {
  mount();
  fireEvent.click(await screen.findByText("Move / change"));
  fireEvent.change(screen.getByLabelText("Physical room"), {
    target: { value: "room" },
  });
  fireEvent.click(screen.getByText("Review room change"));
  await screen.findByText(/Total: 2000/);
  expect(roomInventoryApi.assign).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Confirm room change"));
  await waitFor(() =>
    expect(roomInventoryApi.assign).toHaveBeenCalledWith(
      "booking",
      expect.objectContaining({
        roomId: "room",
        expectedUpdatedAt: "2026-09-28",
        roomStayStart: "2026-10-01",
      }),
    ),
  );
});
it("shows server conflict errors without claiming success", async () => {
  (roomInventoryApi.quote as jest.Mock).mockRejectedValue({
    response: { data: { message: "This room has no free beds." } },
  });
  mount();
  fireEvent.click(await screen.findByText("Move / change"));
  fireEvent.click(screen.getByText("Review room change"));
  expect(await screen.findByRole("alert")).toHaveTextContent("no free beds");
  expect(screen.queryByText("Confirm room change")).not.toBeInTheDocument();
});

describe("PPVC-727: room stay timeline for split-booster bookings", () => {
  const boosterOne = { ...person, _id: "booster-1", name: "First Booster", roomStayStart: "2026-10-01", roomStayEnd: "2026-10-04" };
  const boosterTwo = { ...person, _id: "booster-2", name: "Second Booster", roomStayStart: "2026-10-04", roomStayEnd: "2026-10-10" };
  const splitData = {
    ...data,
    rooms: [{ ...data.rooms[0], occupants: [boosterOne, boosterTwo] }],
    unassigned: [],
  };

  beforeEach(() => {
    (roomInventoryApi.view as jest.Mock).mockResolvedValue({ data: splitData });
  });

  it("shows both boosters in the existing bed-slot grid and in the new timeline, side by side", async () => {
    mount();
    await screen.findByTitle("First Booster · 3 nights");
    expect(screen.getAllByText("First Booster").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Room 1 bed places")).toBeInTheDocument();
    const timeline = screen.getByLabelText("Room stay timeline");
    expect(timeline).toBeInTheDocument();
    expect(screen.getByTitle("First Booster · 3 nights")).toBeInTheDocument();
    expect(screen.getByTitle("Second Booster · 6 nights")).toBeInTheDocument();
  });

  it("the edit panel's quick-pick buttons update the date inputs and the live preview bar", async () => {
    mount();
    fireEvent.click((await screen.findAllByText("Move / change"))[0]);
    fireEvent.click(screen.getByText("First half"));
    expect(screen.getByLabelText("Room arrival")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("Room departure")).toHaveValue("2026-10-05");
    expect(screen.getByTitle("First Booster · 4 nights")).toBeInTheDocument();
  });
});
