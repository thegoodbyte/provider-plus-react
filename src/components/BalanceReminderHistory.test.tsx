import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import BalanceReminderHistory from "./BalanceReminderHistory";
import { communicationsApi } from "../services/api";
jest.mock("../services/api", () => ({
  communicationsApi: { getSentEmails: jest.fn() },
}));
const api = communicationsApi.getSentEmails as jest.Mock;
const a = "507f1f77bcf86cd799439001",
  b = "507f1f77bcf86cd799439002";
const row = (changes: any = {}) => ({
  _id: "1",
  display_id: 1001,
  bookingId: a,
  relatedEntityType: "booking_balance_reminder",
  relatedEntityId: a,
  status: "sent",
  provider: "gmail",
  sentAt: "2026-10-30T12:30:00Z",
  to: ["client@example.invalid"],
  subject: "Reviewed balance email",
  bodyText: "Your balance message",
  createdBy: "staff@example.invalid",
  variablesSnapshot: {
    client: { language: "pl" },
    balanceReminder: { tone: "overdue", amountFormatted: "600 PLN" },
  },
  ...changes,
});
beforeEach(() => {
  jest.clearAllMocks();
  api.mockResolvedValue({ data: [] });
});
it("counts only sent client reminders and exposes attempts, snapshot language, recipient and message on click", async () => {
  api.mockResolvedValue({
    data: [
      row(),
      row({ _id: "2", status: "failed", errorMessage: "Provider failure" }),
      row({
        _id: "3",
        safetyRedirected: true,
        intendedRecipients: { to: ["client@example.invalid"] },
        to: ["safety@example.invalid"],
      }),
      row({ _id: "4", provider: "development_capture" }),
      row({ _id: "5", status: "queued" }),
      row({ _id: "6", bookingId: b, relatedEntityId: b }),
      row({ _id: "7", relatedEntityType: "booking" }),
    ],
  });
  render(<BalanceReminderHistory bookingId={a} />);
  const button = await screen.findByRole("button", {
    name: "Balance reminder history: 1 sent",
  });
  expect(api).toHaveBeenCalledWith(
    { bookingId: a, relatedEntityType: "booking_balance_reminder" },
    { suppressGlobalError: true },
  );
  fireEvent.click(button);
  expect(
    await screen.findByRole("region", { name: "Balance reminder history" }),
  ).toHaveTextContent("1 confirmed sent · 5 recorded attempts");
  await waitFor(() =>
    expect(screen.getByText("Failed / unconfirmed")).toBeVisible(),
  );
  expect(screen.getByText("Redirected to safety inbox")).toBeVisible();
  expect(screen.getByText("Development capture")).toBeVisible();
  expect(screen.getByText("Queued / unconfirmed")).toBeVisible();
  expect(screen.getAllByText(/Polski · Overdue/).length).toBe(5);
  fireEvent.click(screen.getAllByText("View message")[0]);
  expect(screen.getAllByText("Your balance message")[0]).toBeVisible();
  fireEvent.keyDown(window, { key: "Escape" });
  await waitFor(() =>
    expect(
      screen.queryByRole("region", { name: "Balance reminder history" }),
    ).not.toBeInTheDocument(),
  );
});
it("opens on hover and reports empty history without claiming a delivery", async () => {
  render(<BalanceReminderHistory bookingId={a} />);
  fireEvent.mouseEnter(
    await screen.findByRole("button", {
      name: "Balance reminder history: 0 sent",
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByText("No balance reminders recorded yet."),
    ).toBeVisible(),
  );
});
it("shows unknown on a failed read and retries rather than displaying zero", async () => {
  api.mockRejectedValue(new Error("offline"));
  render(<BalanceReminderHistory bookingId={a} />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Balance reminder history: unavailable",
    }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "sent count is unknown",
  );
  api.mockResolvedValue({ data: [row()] });
  fireEvent.click(screen.getByRole("button", { name: "Retry history" }));
  expect(
    await screen.findByRole("button", {
      name: "Balance reminder history: 1 sent",
    }),
  ).toBeVisible();
});
it("ignores a late sibling response and refreshes after a send revision", async () => {
  let finish: (r: any) => void = () => {};
  api
    .mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    .mockResolvedValue({ data: [] });
  const view = render(<BalanceReminderHistory bookingId={a} />);
  view.rerender(<BalanceReminderHistory bookingId={b} />);
  await screen.findByRole("button", {
    name: "Balance reminder history: 0 sent",
  });
  await act(async () => finish({ data: [row()] }));
  expect(
    screen.getByRole("button", { name: "Balance reminder history: 0 sent" }),
  ).toBeVisible();
  api.mockResolvedValue({ data: [row({ bookingId: b, relatedEntityId: b })] });
  view.rerender(<BalanceReminderHistory bookingId={b} refreshKey={1} />);
  expect(
    await screen.findByRole("button", {
      name: "Balance reminder history: 1 sent",
    }),
  ).toBeVisible();
});
