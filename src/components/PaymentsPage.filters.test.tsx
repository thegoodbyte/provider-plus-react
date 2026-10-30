import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import PaymentsPage from "./PaymentsPage";
import {
  paymentsApi,
  clientsApi,
  retreatsApi,
  bookingsApi,
} from "../services/api";
jest.mock("../services/api", () => ({
  paymentsApi: { getAllFresh: jest.fn() },
  clientsApi: { getAll: jest.fn() },
  retreatsApi: { getAll: jest.fn() },
  bookingsApi: { getAllFresh: jest.fn() },
}));
jest.mock("./ClientAvatar", () => () => null);
const rows = [
  {
    _id: "linked",
    display_id: 1211,
    clientId: "client",
    bookingId: { _id: "booking", bookingNumber: 1311 },
    paymentRequestId: { _id: "request", invoiceNumber: 1397 },
    status: "completed",
    currency: "PLN",
    amount: 100,
    paymentMethod: "bank_transfer",
    paymentDate: "2026-10-20",
  },
  {
    _id: "unlinked",
    display_id: 1212,
    clientId: "client",
    status: "completed",
    currency: "PLN",
    amount: 200,
    paymentMethod: "cash",
    paymentDate: "2026-10-21",
  },
  {
    _id: "request-only",
    display_id: 1213,
    clientId: "client",
    paymentRequestId: "request",
    status: "pending",
    currency: "EUR",
    amount: 50,
    paymentMethod: "card",
    paymentDate: "2026-10-22",
  },
  {
    _id: "missing",
    display_id: 1214,
    clientId: "client",
    bookingId: "deleted",
    status: "completed",
    currency: "PLN",
    amount: 300,
    paymentMethod: "bank_transfer",
    paymentDate: "2026-10-23",
  },
];
beforeEach(() => {
  jest.clearAllMocks();
  (paymentsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: rows });
  (clientsApi.getAll as jest.Mock).mockResolvedValue({
    data: [{ _id: "client", firstName: "Ewa", lastName: "Synthetic" }],
  });
  (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
  (bookingsApi.getAllFresh as jest.Mock).mockResolvedValue({
    data: [
      {
        _id: "booking",
        bookingNumber: 1311,
        clientId: "client",
        status: "confirmed",
      },
    ],
  });
});
const Location = () => {
  const l = useLocation();
  return <output aria-label="Current location">{l.pathname + l.search}</output>;
};
const open = (path = "/admin/payments") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <PaymentsPage />
      <Location />
    </MemoryRouter>,
  );
it("opens combined URL filters, keeps their state and clears them together", async () => {
  open("/admin/payments?booking=without&request=without");
  await screen.findByText("#1212");
  expect(screen.queryByText("#1211")).toBeNull();
  expect(screen.queryByText("#1213")).toBeNull();
  expect(
    screen.getByRole("link", { name: "Create / link booking" }),
  ).toHaveAttribute("href", "/admin/payments/unlinked/edit");
  fireEvent.change(screen.getByLabelText("Currency"), {
    target: { value: "PLN" },
  });
  expect(screen.getByLabelText("Current location")).toHaveTextContent(
    "currency=PLN",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Clear all payment filters" }),
  );
  await screen.findByText("#1211");
  expect(screen.getByLabelText("Booking link")).toHaveValue("");
});
it("offers existing confirmation tools only for a valid same-client active booking and preserves filtered return", async () => {
  open("/admin/payments?currency=PLN");
  const link = await screen.findByRole("link", {
    name: "Booking confirmation",
  });
  const target = new URL(link.getAttribute("href")!, "https://admin.test");
  expect(target.pathname).toBe("/admin/bookings/booking");
  expect(target.searchParams.get("returnPayments")).toBe(
    "/admin/payments?currency=PLN",
  );
  expect(
    screen.getByRole("link", { name: "Review booking link" }),
  ).toHaveAttribute("href", "/admin/payments/missing/edit");
});
it("blocks a false empty-success on fetch failure and offers fresh retry", async () => {
  (paymentsApi.getAllFresh as jest.Mock).mockRejectedValueOnce(
    Error("Offline"),
  );
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not load payments",
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry payments" }));
  await screen.findByText("#1211");
  expect(paymentsApi.getAllFresh).toHaveBeenCalledTimes(2);
});
it("shows invalid range feedback instead of silently ignoring it", async () => {
  open("/admin/payments?min=100&max=50");
  await screen.findByText("Minimum amount must not exceed maximum amount.");
  expect(
    screen.queryByRole("link", { name: "Booking confirmation" }),
  ).toBeNull();
});
it("does not offer confirmation for cancelled or foreign-client booking relationships", async () => {
  (bookingsApi.getAllFresh as jest.Mock).mockResolvedValue({
    data: [{ _id: "booking", clientId: "other", status: "confirmed" }],
  });
  open();
  await screen.findByText("#1211");
  expect(
    screen.queryByRole("link", { name: "Booking confirmation" }),
  ).toBeNull();
});

it("merges rapid URL filter changes instead of restoring just-cleared filters", async () => {
  open("/admin/payments?repair=yes");
  await screen.findByRole("heading", { name: "Payments", exact: true });
  act(() => {
    fireEvent.click(
      screen.getByRole("button", { name: "Clear all payment filters" }),
    );
    fireEvent.change(screen.getByLabelText("Currency"), {
      target: { value: "PLN" },
    });
    fireEvent.change(screen.getByLabelText("Booking link"), {
      target: { value: "with" },
    });
  });
  await waitFor(() =>
    expect(screen.getByLabelText("Current location")).toHaveTextContent(
      "currency=PLN&booking=with",
    ),
  );
  expect(
    screen.getByLabelText("Unfinished payment updates only"),
  ).not.toBeChecked();
  expect(
    await screen.findByRole("link", { name: "Booking confirmation" }),
  ).toBeInTheDocument();
});
