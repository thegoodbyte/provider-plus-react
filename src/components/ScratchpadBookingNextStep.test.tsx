import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ScratchpadBookingNextStep from "./ScratchpadBookingNextStep";
import { paymentRequestsApi } from "../services/api";
jest.mock("../services/api", () => ({
  paymentRequestsApi: { getOneFresh: jest.fn() },
}));
jest.mock("./RequestBookingAction", () => ({
  __esModule: true,
  default: ({ request }: any) => <p>Create booking for {request._id}</p>,
}));
const row: any = {
  _id: "receipt",
  status: "converted",
  paymentId: "payment",
  matchedPaymentRequestId: "request",
  payment: { paymentRequestId: "request" },
};
const open = (patch: any = {}) =>
  render(
    <MemoryRouter>
      <ScratchpadBookingNextStep receipt={{ ...row, ...patch }} />
    </MemoryRouter>,
  );
beforeEach(() => {
  jest.clearAllMocks();
  (paymentRequestsApi.getOneFresh as jest.Mock).mockResolvedValue({
    data: { _id: "request", invoiceNumber: 1397 },
  });
});
it("offers booking continuation from a recorded payment and reloads its canonical request", async () => {
  open();
  expect(
    await screen.findByText("Create booking for request"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "View recorded payment" }),
  ).toHaveAttribute("href", "/admin/payments/payment");
  expect(
    screen.getByText(/do not enter the same payment again/),
  ).toBeInTheDocument();
});
it("opens an existing booking and suppresses actions for missing or unfinished payments", () => {
  const { unmount } = open({ payment: { bookingId: { _id: "booking" } } });
  expect(screen.getByRole("link", { name: "Open booking" })).toHaveAttribute(
    "href",
    "/admin/bookings/booking",
  );
  expect(paymentRequestsApi.getOneFresh).not.toHaveBeenCalled();
  unmount();
  open({ reconciliationPending: true });
  expect(screen.queryByRole("region")).toBeNull();
});
it("shows a retriable failure without inviting another payment", async () => {
  (paymentRequestsApi.getOneFresh as jest.Mock).mockRejectedValueOnce(
    Error("Offline"),
  );
  open();
  await screen.findByRole("alert");
  fireEvent.click(screen.getByText("Retry booking step"));
  await screen.findByText("Create booking for request");
});
