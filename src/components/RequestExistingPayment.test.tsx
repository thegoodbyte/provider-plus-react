import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RequestExistingPayment from "./RequestExistingPayment";
import { paymentRequestsApi, paymentsApi } from "../services/api";
jest.mock("../services/api", () => ({
  paymentRequestsApi: { existingPayments: jest.fn() },
  paymentsApi: { linkRequest: jest.fn() },
}));
const payment = {
  _id: "payment",
  display_id: 1211,
  clientName: "Synthetic Client",
  amount: 270,
  currency: "PLN",
  paymentDate: "2026-10-20",
  sourceScratchpadId: "sp",
  paymentMethod: "bank_transfer",
};
const request = { _id: "request", invoiceNumber: 1397, currency: "PLN" };
const open = () => {
  const close = jest.fn(),
    linked = jest.fn().mockResolvedValue(undefined);
  render(
    <MemoryRouter>
      <RequestExistingPayment
        request={request}
        onClose={close}
        onLinked={linked}
      />
    </MemoryRouter>,
  );
  return { close, linked };
};
beforeEach(() => {
  jest.clearAllMocks();
  (paymentRequestsApi.existingPayments as jest.Mock).mockResolvedValue({
    data: { payments: [payment], total: 1, page: 1, limit: 25 },
  });
  (paymentsApi.linkRequest as jest.Mock).mockResolvedValue({ data: payment });
});
it("requires selection and confirmation, links existing money once then refreshes", async () => {
  const { linked, close } = open();
  const submit = screen.getByRole("button", {
    name: "Confirm existing payment link",
  });
  expect(submit).toBeDisabled();
  fireEvent.click(
    await screen.findByRole("checkbox", { name: "Select payment #1211" }),
  );
  expect(screen.getByText("Recorded from scratchpad")).toBeInTheDocument();
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/I checked the client/));
  fireEvent.click(submit);
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(paymentsApi.linkRequest).toHaveBeenCalledWith("payment", "request");
  expect(linked).toHaveBeenCalledTimes(1);
});
it("keeps the confirmed selection after an interrupted link so retry uses the same payment", async () => {
  (paymentsApi.linkRequest as jest.Mock).mockRejectedValueOnce({
    response: { data: { message: "Retry this same link" } },
  });
  open();
  fireEvent.click(
    await screen.findByRole("checkbox", { name: "Select payment #1211" }),
  );
  fireEvent.click(screen.getByLabelText(/I checked the client/));
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm existing payment link" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Retry this same link",
  );
  expect(
    screen.getByRole("checkbox", { name: "Select payment #1211" }),
  ).toBeChecked();
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm existing payment link" }),
  );
  await waitFor(() => expect(paymentsApi.linkRequest).toHaveBeenCalledTimes(2));
});
it("clears selection after a search change and cancellation writes nothing", async () => {
  const { close } = open();
  fireEvent.click(
    await screen.findByRole("checkbox", { name: "Select payment #1211" }),
  );
  fireEvent.change(screen.getByLabelText("Payment amount"), {
    target: { value: "100" },
  });
  await waitFor(() =>
    expect(paymentRequestsApi.existingPayments).toHaveBeenLastCalledWith(
      "request",
      expect.objectContaining({ amount: "100", page: 1 }),
    ),
  );
  expect(
    screen.getByRole("checkbox", { name: "Select payment #1211" }),
  ).not.toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
  expect(close).toHaveBeenCalled();
  expect(paymentsApi.linkRequest).not.toHaveBeenCalled();
});
it("shows search failure with retry and blocks unavailable payments", async () => {
  (paymentRequestsApi.existingPayments as jest.Mock)
    .mockRejectedValueOnce(Error("Offline"))
    .mockResolvedValueOnce({
      data: {
        payments: [{ ...payment, unavailableReason: "Already linked" }],
        total: 1,
      },
    });
  open();
  fireEvent.click(
    await screen.findByRole("button", { name: "Retry matching payments" }),
  );
  expect(
    await screen.findByRole("checkbox", { name: "Select payment #1211" }),
  ).toBeDisabled();
  expect(paymentsApi.linkRequest).not.toHaveBeenCalled();
});
