import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import PaymentRequestInvoicePreview from "./PaymentRequestInvoicePreview";
import { paymentRequestsApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
jest.mock("../services/api", () => ({
  paymentRequestsApi: { previewInvoice: jest.fn() },
}));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("antd", () => ({
  Modal: ({ open, children }: any) =>
    open ? <div role="dialog">{children}</div> : null,
}));
const preview = paymentRequestsApi.previewInvoice as jest.Mock,
  auth = useAuth as jest.Mock;
beforeEach(() => {
  preview.mockReset();
  auth.mockReturnValue({ user: { role: "admin" } });
  preview.mockResolvedValue({
    data: {
      previewOnly: true,
      invoice: {
        invoiceNumber: "1931",
        clientName: "Synthetic Client",
        status: "pending",
        currency: "PLN",
        totalPrice: 9500,
        depositAmount: 0,
        depositConsent: null,
        notes: "<script>do not execute</script>",
      },
    },
  });
});
test("loads only on explicit opening and shows the invoice without a form or mutation controls", async () => {
  render(<PaymentRequestInvoicePreview requestId="request-1" />);
  expect(preview).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Preview online invoice (admin)" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Invoice #1931" }),
  ).toBeVisible();
  expect(preview).toHaveBeenCalledWith("request-1");
  expect(screen.getByText("PLN 0.00")).toBeVisible();
  expect(screen.getByText(/Client consent:/)).toHaveTextContent("not recorded");
  expect(screen.getByText("<script>do not execute</script>")).toBeVisible();
  expect(document.querySelector("script,form,input")).toBeNull();
});
test("non-admin users see no preview action and trigger no API call", () => {
  auth.mockReturnValue({ user: { role: "medical_staff" } });
  render(<PaymentRequestInvoicePreview requestId="request-1" />);
  expect(screen.queryByRole("button")).toBeNull();
  expect(preview).not.toHaveBeenCalled();
});
test("failed lookup offers retry without exposing stale invoice content", async () => {
  preview.mockRejectedValueOnce(Error("offline"));
  render(<PaymentRequestInvoicePreview requestId="request-1" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Preview online invoice (admin)" }),
  );
  await screen.findByRole("alert");
  expect(screen.queryByRole("article")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Retry invoice preview" }),
  );
  await screen.findByRole("heading", { name: "Invoice #1931" });
  expect(preview).toHaveBeenCalledTimes(2);
});
test("ignores an invoice response after closing the preview", async () => {
  let resolve: any;
  preview.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  render(<PaymentRequestInvoicePreview requestId="request-1" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Preview online invoice (admin)" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
  resolve({ data: { previewOnly: true, invoice: { invoiceNumber: "old" } } });
  expect(screen.queryByRole("dialog")).toBeNull();
});
