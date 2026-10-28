import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ClientSupportInbox from "./ClientSupportInbox";
import { clientSupportApi as api } from "../../services/api";
jest.mock("../../services/api", () => ({
  clientSupportApi: {
    settings: jest.fn(),
    list: jest.fn(),
    detail: jest.fn(),
    message: jest.fn(),
    update: jest.fn(),
    retry: jest.fn(),
    create: jest.fn(),
    saveSettings: jest.fn(),
  },
  clientsApi: { getAll: jest.fn() },
  bookingsApi: { getAll: jest.fn() },
}));
const a = api as jest.Mocked<typeof api>;
const settings = {
  portalBase: "https://www.ibogaready.com",
  recipients: ["staff@example.invalid"],
  responseHours: "",
  topics: [
    {
      id: "payments",
      label: { en: "Payments" },
      issues: [{ id: "received", label: { en: "Check payment" } }],
    },
    {
      id: "booking",
      label: { en: "Booking" },
      issues: [{ id: "reschedule", label: { en: "Change dates" } }],
    },
  ],
};
const row: any = {
  _id: "case",
  supportReference: "SUP-1042",
  name: "Check my payment",
  status: "pending",
  clientId: {
    _id: "client",
    firstName: "Alice",
    email: "alice@example.invalid",
    phone: "+48 123",
  },
  bookingId: { _id: "booking", bookingNumber: 1320 },
  support: {
    topic: "payments",
    issue: "received",
    queue: "Finance",
    revision: 0,
    waitingOn: "",
    messages: [
      {
        id: "first",
        body: "I have paid",
        kind: "client",
        at: "2026-10-27T12:00:00Z",
      },
    ],
    deliveries: [],
  },
};
beforeEach(() => {
  jest.resetAllMocks();
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => "11111111-1111-4111-8111-111111111111",
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
  a.settings.mockResolvedValue({ data: settings } as any);
  a.list.mockResolvedValue({ data: { items: [], total: 0 } } as any);
  a.detail.mockResolvedValue({ data: row } as any);
  a.message.mockResolvedValue({
    data: { ...row, support: { ...row.support, revision: 1 } },
  } as any);
});
const mount = (route = "/admin/tasks?support=all") =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <ClientSupportInbox />
    </MemoryRouter>,
  );
it("copies specific issue and booking links without any submission, and changing parent clears the old issue", async () => {
  mount();
  fireEvent.click(screen.getByText("Copy a support link to send to a client"));
  await screen.findAllByRole("option", { name: "Payments" });
  fireEvent.change(screen.getByLabelText("Topic", { exact: true }), {
    target: { value: "payments" },
  });
  fireEvent.change(screen.getByLabelText("Issue", { exact: true }), {
    target: { value: "received" },
  });
  fireEvent.change(screen.getByLabelText("Booking number (optional)"), {
    target: { value: "1320" },
  });
  expect(screen.getByLabelText("Shareable support link")).toHaveValue(
    "https://www.ibogaready.com/support?topic=payments&issue=received&booking=1320",
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy support link" }));
  await waitFor(() =>
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://www.ibogaready.com/support?topic=payments&issue=received&booking=1320",
    ),
  );
  fireEvent.change(screen.getByLabelText("Topic", { exact: true }), {
    target: { value: "booking" },
  });
  expect(screen.getByLabelText("Issue", { exact: true })).toHaveValue("");
  expect(a.create).not.toHaveBeenCalled();
  expect(a.message).not.toHaveBeenCalled();
});
it("keeps internal and public drafts separate and never notifies clients about a private note", async () => {
  mount("/admin/tasks?support=SUP-1042");
  await screen.findByText("SUP-1042 · Check my payment");
  fireEvent.change(screen.getByLabelText("Client-visible reply"), {
    target: { value: "Public answer" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Internal note", exact: true }),
  );
  expect(screen.getByLabelText("Private staff note")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Private staff note"), {
    target: { value: "PRIVATE STAFF NOTE" },
  });
  expect(
    screen.queryByLabelText("Notify client by email with a secure link"),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Preview internal note" }),
  );
  expect(a.message).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Save internal note", exact: true }),
  );
  await waitFor(() =>
    expect(a.message).toHaveBeenCalledWith(
      "case",
      expect.objectContaining({
        message: "PRIVATE STAFF NOTE",
        internal: true,
        notify: false,
        resolve: false,
        revision: 0,
      }),
    ),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Reply to client", exact: true }),
  );
  expect(screen.getByLabelText("Client-visible reply")).toHaveValue(
    "Public answer",
  );
});
it("previews the client reply and honors the no-email option, preserving content after a failed save", async () => {
  a.message.mockRejectedValueOnce(new Error("Offline"));
  mount("/admin/tasks?support=SUP-1042");
  await screen.findByText("SUP-1042 · Check my payment");
  fireEvent.change(screen.getByLabelText("Client-visible reply"), {
    target: { value: "Checked your transaction." },
  });
  fireEvent.click(
    screen.getByLabelText("Notify client by email with a secure link"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Preview reply" }));
  expect(a.message).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Save reply without email" }),
  );
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Client-visible reply")).toHaveValue(
    "Checked your transaction.",
  );
  expect(a.message).toHaveBeenCalledWith(
    "case",
    expect.objectContaining({ notify: false, internal: false }),
  );
});

it("inserts an editable reply template without sending it or carrying private draft text into the reply", async () => {
  mount("/admin/tasks?support=SUP-1042");
  await screen.findByText("SUP-1042 · Check my payment");
  fireEvent.click(
    screen.getByRole("button", { name: "Internal note", exact: true }),
  );
  fireEvent.change(screen.getByLabelText("Private staff note"), {
    target: { value: "PRIVATE DRAFT" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Reply to client", exact: true }),
  );
  fireEvent.change(screen.getByLabelText("Insert response template"), {
    target: { value: "details" },
  });
  expect(screen.getByLabelText("Client-visible reply")).toHaveValue(
    "Please add the payment date, amount, currency, provider and transaction reference so we can check the original transaction.",
  );
  expect(a.message).not.toHaveBeenCalled();
});
it("reports a queue-refresh failure separately after the reply is already saved", async () => {
  mount("/admin/tasks?support=SUP-1042");
  await screen.findByText("SUP-1042 · Check my payment");
  a.list.mockRejectedValue(new Error("Refresh unavailable"));
  fireEvent.change(screen.getByLabelText("Client-visible reply"), {
    target: { value: "Saved answer" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Preview reply" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Send reply & notify client" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Saved, but the inbox could not refresh",
    ),
  );
  expect(screen.getByLabelText("Client-visible reply")).toHaveValue("");
  expect(a.message).toHaveBeenCalledTimes(1);
});
