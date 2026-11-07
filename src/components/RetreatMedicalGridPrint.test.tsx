import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import RetreatMedicalGridPrint from "./RetreatMedicalGridPrint";
import { buildRetreatMedicalGridData } from "./RetreatMedicalGrid.helpers";

test("groups every guest without truncating notes or current preparation items and isolates bookings/lifecycles", () => {
  const bookings = Array.from({ length: 7 }, (_, i) => ({
    _id: `b${i}`,
    bookingNumber: 1300 + i,
    status: "confirmed",
    clientId: {
      _id: `c${i}`,
      display_id: 1200 + i,
      firstName: "Guest",
      lastName: String(i),
    },
  }));
  const note = "Full advisor instructions. ".repeat(60) + "FINAL NOTE";
  const data = buildRetreatMedicalGridData(
    bookings as any,
    [],
    [
      {
        _id: "m1",
        clientId: "c0",
        bookingId: "b0",
        requestType: "ekg_review",
        status: "approved",
        reviewNotes: note,
      } as any,
    ],
    { retreatCode: "PRINT-TEST", name: "Test Retreat" },
  );
  const items = [
    ...Array.from({ length: 5 }, (_, i) => ({
      _id: `p${i}`,
      bookingId: "b0",
      status: "pending",
      title: `Instruction ${i}`,
      dueDate: "2026-11-15",
      metadata: {
        medicationStopPlan: true,
        planLifecycle: "draft",
        planVersion: 2,
      },
    })),
    {
      _id: "old",
      bookingId: "b0",
      title: "Superseded plan",
      metadata: {
        medicationStopPlan: true,
        planLifecycle: "published",
        planVersion: 1,
      },
    },
    {
      _id: "cancel",
      bookingId: "b0",
      title: "Cancelled item",
      status: "cancelled",
      metadata: {
        medicationStopPlan: true,
        planLifecycle: "draft",
        planVersion: 2,
      },
    },
    {
      _id: "other",
      bookingId: "another-booking",
      title: "Different booking",
      metadata: { medicationStopPlan: true },
    },
  ];
  const close = jest.fn();
  render(
    <RetreatMedicalGridPrint
      data={data}
      preparationItems={items}
      generatedAt="2026-11-07T12:00:00Z"
      onClose={close}
    />,
  );
  const preview = screen.getByRole("dialog");
  expect(within(preview).getAllByRole("table")).toHaveLength(3);
  bookings.forEach((_, i) =>
    expect(
      within(preview).getByText(`Booking #${1300 + i}`),
    ).toBeInTheDocument(),
  );
  expect(within(preview).getByText(note)).toBeInTheDocument();
  expect(
    within(preview).getByText("2026-11-15 · Instruction 4"),
  ).toBeInTheDocument();
  expect(within(preview).getByText("draft · version 2")).toBeInTheDocument();
  expect(
    within(preview).queryByText(
      /Superseded plan|Cancelled item|Different booking/,
    ),
  ).not.toBeInTheDocument();
  const closeButton = within(preview).getByRole("button", {
    name: "Close preview",
  });
  expect(closeButton).toHaveFocus();
  fireEvent.keyDown(closeButton, { key: "Tab" });
  expect(
    within(preview).getByRole("button", { name: "Print / Save PDF" }),
  ).toHaveFocus();
});
