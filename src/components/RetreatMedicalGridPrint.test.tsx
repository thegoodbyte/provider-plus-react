import React from "react";
import { ceremoniesApi } from "../services/api";
import { fireEvent, render, waitFor, screen, within } from "@testing-library/react";
import RetreatMedicalGridPrint from "./RetreatMedicalGridPrint";
import { buildRetreatMedicalGridData } from "./RetreatMedicalGrid.helpers";

jest.mock("../services/api", () => ({ ceremoniesApi: { getByRetreat: jest.fn().mockResolvedValue({ data: [] }), getParticipants: jest.fn() } }));

beforeEach(() => { (ceremoniesApi.getByRetreat as jest.Mock).mockResolvedValue({data: []}); });

test("groups every guest without truncating notes or current preparation items and isolates bookings/lifecycles", async () => {
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
      retreatId="r999"
      data={data}
      preparationItems={items}
      generatedAt="2026-11-07T12:00:00Z"
      onClose={close}
    />,
  );
  const preview = screen.getByRole("dialog");
  await waitFor(() => expect(within(preview).getByRole("button", {name: "Print / Save PDF"})).toBeEnabled());
  expect(within(preview).getAllByRole("table")).toHaveLength(7);
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

const oneClient = () => buildRetreatMedicalGridData([{_id: "b0", bookingNumber: 1300, clientId: {_id: "c0", firstName: "First", lastName: "Guest"}}] as any, [], [], {retreatCode: "R"});
test("isolates both ceremony notes, repeated checks and legacy checks without changing clearance", async () => {
  (ceremoniesApi.getByRetreat as jest.Mock).mockResolvedValue({data: [{_id: "s1", ceremonyNumber: 1, retreatId: "r"}, {_id: "s2", ceremonyNumber: 2, retreatId: "r"}, {_id: "s3", ceremonyNumber: 1, retreatId: "other"}, {_id: "cancelled", ceremonyNumber: 1, status: "cancelled"}]});
  (ceremoniesApi.getParticipants as jest.Mock).mockImplementation(async id => ({data: id === "s1" ? [
    {ceremonyId: "s1", clientId: "c0", retreatId: "r", preCeremonyChecks: [{medicalClearance: "conditional", preCeremonyEkg: {notes: "EKG caution"}, preCeremonyBloodPressure: {notes: "BP note"}, medicalClearanceNotes: "Clearance caution"}, {medicalClearanceNotes: "Repeat check"}]},
    {ceremonyId: "s1", clientId: "other", medicalClearanceNotes: "Other client"},
    {ceremonyId: "s1", clientId: "c0", retreatId: "other", medicalClearanceNotes: "Other retreat"},
    {ceremonyId: "wrong", clientId: "c0", medicalClearanceNotes: "Other ceremony"}
  ] : [{ceremonyId: "s2", clientId: {_id: "c0"}, medicalClearance: "approved", medicalClearanceNotes: "Legacy ceremony two"}]}));
  render(<RetreatMedicalGridPrint retreatId="r" data={oneClient()} preparationItems={[]} generatedAt="2026-11-07T12:00:00Z" onClose={() => {}} />);
  await screen.findByText("EKG: EKG caution");
  ["Blood pressure: BP note", "Clearance: Clearance caution", "Clearance: Repeat check", "Clearance: Legacy ceremony two"].forEach(text => expect(screen.getByText(text)).toBeInTheDocument());
  expect(screen.queryByText(/Other client|Other retreat|Other ceremony/)).not.toBeInTheDocument();
  expect(screen.getByText("Check 1 · conditional")).toHaveClass("medical-print-yellow");
  expect(ceremoniesApi.getParticipants).toHaveBeenCalledTimes(2);
});
test("denied or partially failed check reads block incomplete printing and can be retried", async () => {
  (ceremoniesApi.getByRetreat as jest.Mock).mockRejectedValueOnce(new Error("403"));
  render(<RetreatMedicalGridPrint retreatId="r" data={oneClient()} preparationItems={[]} generatedAt="2026-11-07T12:00:00Z" onClose={() => {}} />);
  await screen.findByRole("alert");
  expect(screen.getByRole("button", {name: "Print / Save PDF"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button", {name: "Retry checks"}));
  await waitFor(() => expect(screen.getByRole("button", {name: "Print / Save PDF"})).toBeEnabled());
  expect(screen.getAllByText("No checks recorded.")).toHaveLength(2);
});
