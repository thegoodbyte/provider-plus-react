import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MedicalPreparationCalendar from "./MedicalPreparationCalendar";
import PreparationIdentity from "./PreparationIdentity";
import { canShowNavigation } from "../navigation/navigation";
it("highlights a shared day, lists all clients in its agenda and opens the selected source item", () => {
  const open = jest.fn();
  render(
    <MedicalPreparationCalendar
      month="2026-11"
      onMonthChange={jest.fn()}
      items={[
        {
          name: "Last magnesium · Client #123",
          instruction: "Advisor instruction",
          date: "2026-11-15",
          onOpen: open,
        },
        {
          name: "Other item · Client #124",
          instruction: "Other instruction",
          date: "2026-11-15",
        },
      ]}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "2026-11-15: 2 preparation items" }),
  );
  const agenda = screen.getByLabelText("Selected preparation instructions");
  expect(agenda).toHaveTextContent("Client #123");
  expect(agenda).toHaveTextContent("Client #124");
  fireEvent.click(
    screen.getByRole("button", { name: "Open preparation item" }),
  );
  expect(open).toHaveBeenCalledTimes(1);
});
it("keeps client, booking and retreat identifiers clickable and precise", () => {
  render(
    <MemoryRouter>
      <PreparationIdentity
        client={{
          _id: "c",
          display_id: 123,
          firstName: "Anna",
          lastName: "Test",
        }}
        booking={{ _id: "b", bookingNumber: 1400 }}
        retreat={{ _id: "r", code: "NOV-29", startDate: "2026-11-29" }}
      />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("link", { name: "Client #123 · Anna Test" }),
  ).toHaveAttribute("href", "/admin/clients/c");
  expect(screen.getByRole("link", { name: "Booking #1400" })).toHaveAttribute(
    "href",
    "/admin/bookings/b",
  );
  expect(
    screen.getByRole("link", { name: "NOV-29 · 2026-11-29" }),
  ).toHaveAttribute("href", "/admin/retreats/r");
});
it("keeps medical preparation navigation out of unrelated roles", () => {
  expect(canShowNavigation("medical-preparation", "admin")).toBe(true);
  expect(canShowNavigation("medical-preparation", "medical_staff")).toBe(true);
  for (const role of [
    "staff",
    "user",
    "facilitator",
    "helper",
    "client",
    "medical_advisor",
  ])
    expect(canShowNavigation("medical-preparation", role)).toBe(false);
});
