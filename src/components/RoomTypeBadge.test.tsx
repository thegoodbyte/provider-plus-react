import React from "react";
import { render, screen } from "@testing-library/react";
import RoomTypeBadge from "./RoomTypeBadge";

it.each([
  ["shared", "Shared room", "Shared"],
  ["private", "Private room", "Private"],
  [
    "private_ensuite",
    "Private room with private bathroom",
    "Private · ensuite",
  ],
  [undefined, "Room type unknown", "Unknown"],
  [null, "Room type unknown", "Unknown"],
  ["unspecified", "Room type unknown", "Unknown"],
  ["legacy-unrecognized", "Room type unknown", "Unknown"],
])(
  "represents saved accommodation %s accurately and accessibly",
  (roomType, label, text) => {
    render(<RoomTypeBadge roomType={roomType} />);
    const badge = screen.getByRole("img", { name: label! });
    expect(badge).toHaveAttribute("title", label);
    expect(badge).toHaveTextContent(text!);
    expect(badge.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  },
);

it("updates when navigating between bookings without retaining the previous room type", () => {
  const view = render(<RoomTypeBadge roomType="private" />);
  view.rerender(<RoomTypeBadge roomType={null} />);
  expect(
    screen.queryByRole("img", { name: "Private room" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Room type unknown" })).toBeVisible();
});
