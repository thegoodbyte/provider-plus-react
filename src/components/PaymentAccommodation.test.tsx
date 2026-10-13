import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import PaymentAccommodation from "./PaymentAccommodation";
import { roomInventoryApi } from "../services/roomInventoryApi";
jest.mock("../services/roomInventoryApi", () => ({
  roomInventoryApi: {
    paymentAccommodation: jest.fn(),
    options: jest.fn(),
    preference: jest.fn(),
  },
}));
const option = {
  key: "shared",
  labels: { en: "Shared room" },
  active: true,
  legacyRoomType: "shared",
  supported: true,
  availableUnits: 1,
  unit: "beds",
};
const inventory = {
  retreatId: "r1",
  house: { _id: "h1", name: "Forest house" },
  configured: true,
  unallocatedConfirmed: 0,
  options: [
    option,
    {
      ...option,
      key: "private",
      labels: { en: "Private room" },
      supported: false,
    },
  ],
  rooms: [
    {
      roomId: "bedroom",
      name: "Oak",
      beds: 2,
      occupied: 1,
      freeBeds: 1,
      hasBathroom: false,
      status: "partly_occupied",
    },
  ],
};
beforeEach(() => {
  jest.clearAllMocks();
  (roomInventoryApi.paymentAccommodation as jest.Mock).mockResolvedValue({
    data: inventory,
  });
  (roomInventoryApi.preference as jest.Mock).mockResolvedValue({
    data: { key: "" },
  });
});
const props = {
  retreatId: "r1",
  clientId: "c1",
  value: "",
  onChange: jest.fn(),
};
it("shows house-specific choices and occupied/free rooms without creating a reservation", async () => {
  const onChange = jest.fn();
  render(<PaymentAccommodation {...props} onChange={onChange} />);
  expect(await screen.findByText("House: Forest house")).toBeInTheDocument();
  expect(
    screen.getByRole("option", { name: "Shared room — 1 beds available" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("option", { name: "Private room" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("1 occupants · 1 free beds")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "shared" },
  });
  expect(onChange).toHaveBeenCalledWith("shared", "shared");
  expect(
    screen.getByRole("link", { name: "Open retreat room plan" }),
  ).toHaveAttribute("href", "/retreats/r1/rooms");
});
it("retains unsupported existing agreements and explains them", async () => {
  const onChange = jest.fn();
  render(
    <PaymentAccommodation {...props} value="private" onChange={onChange} />,
  );
  expect(
    await screen.findByText(/saved accommodation is not offered/),
  ).toBeInTheDocument();
  expect(screen.getByRole("combobox")).toHaveValue("private");
  expect(onChange).not.toHaveBeenCalled();
});
it("treats unconfigured and unallocated inventory as unverified", async () => {
  (roomInventoryApi.paymentAccommodation as jest.Mock).mockResolvedValue({
    data: {
      ...inventory,
      configured: false,
      unallocatedConfirmed: 2,
      options: [{ ...option, availableUnits: null }],
    },
  });
  render(<PaymentAccommodation {...props} />);
  expect(
    await screen.findByText(/Retreat rooms are not configured/),
  ).toBeInTheDocument();
  expect(screen.getByText(/2 confirmed guests still need/)).toBeInTheDocument();
  expect(
    screen.getByRole("option", { name: /availability unverified/ }),
  ).toBeInTheDocument();
});
it("fails visibly and retries instead of displaying a previous successful availability", async () => {
  (roomInventoryApi.paymentAccommodation as jest.Mock).mockRejectedValueOnce(
    new Error("offline"),
  );
  render(<PaymentAccommodation {...props} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Room availability could not be checked",
  );
  expect(screen.getByRole("combobox")).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh room availability" }),
  );
  expect(await screen.findByText("House: Forest house")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("ignores a late response from a different retreat", async () => {
  let resolve: (value: any) => void = () => {};
  (roomInventoryApi.paymentAccommodation as jest.Mock).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const page = render(<PaymentAccommodation {...props} />);
  page.rerender(<PaymentAccommodation {...props} retreatId="r2" />);
  await screen.findByText("House: Forest house");
  await act(async () => {
    resolve({ data: { ...inventory, house: { name: "Stale house" } } });
  });
  expect(screen.queryByText("House: Stale house")).not.toBeInTheDocument();
});
it("clears inventory when the retreat is removed", async () => {
  const page = render(<PaymentAccommodation {...props} />);
  await screen.findByText("House: Forest house");
  page.rerender(<PaymentAccommodation {...props} retreatId="" />);
  await waitFor(() =>
    expect(screen.queryByText("House: Forest house")).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("combobox")).toBeDisabled();
});
