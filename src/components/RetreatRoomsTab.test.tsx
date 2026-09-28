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
