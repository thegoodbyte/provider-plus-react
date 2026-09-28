import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import AccommodationSelect from "./AccommodationSelect";
import { roomInventoryApi } from "../services/roomInventoryApi";
jest.mock("../services/roomInventoryApi", () => ({
  roomInventoryApi: { options: jest.fn(), preference: jest.fn() },
}));
beforeEach(() => {
  (roomInventoryApi.options as jest.Mock).mockResolvedValue({
    data: [
      {
        key: "shared",
        labels: { en: "Shared room" },
        active: true,
        legacyRoomType: "shared",
      },
      {
        key: "private",
        labels: { en: "Private room" },
        active: true,
        legacyRoomType: "private",
      },
    ],
  });
  (roomInventoryApi.preference as jest.Mock).mockResolvedValue({
    data: { key: "private", label: "Private room" },
  });
});
it("shows screening default without overwriting an explicit agreement", async () => {
  const change = jest.fn();
  render(
    <AccommodationSelect value="shared" clientId="client" onChange={change} />,
  );
  await screen.findByText("Private room");
  expect(screen.getByRole("combobox")).toHaveValue("shared");
  expect(change).not.toHaveBeenCalled();
});
it("shows inherited screening preference and allows an explicit not-decided choice", async () => {
  const change = jest.fn();
  render(<AccommodationSelect clientId="client" onChange={change} />);
  await screen.findByText(/From screening/);
  expect(screen.getByRole("combobox")).toHaveValue("private");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
  expect(change).toHaveBeenCalledWith("", "unspecified");
});
it("preserves an unavailable saved category visibly", async () => {
  render(<AccommodationSelect value="old" onChange={() => {}} />);
  expect(await screen.findByText("old (unavailable)")).toBeInTheDocument();
});
