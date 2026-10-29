import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PaymentRequestInvoicePreview, {
  PREVIEW_READY,
  PREVIEW_DATA,
  clientPreviewUrl,
} from "./PaymentRequestInvoicePreview";
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
  jest.clearAllMocks();
  auth.mockReturnValue({ user: { role: "admin" } });
  preview.mockResolvedValue({
    data: {
      previewOnly: true,
      invoice: {
        invoiceNumber: "1931",
        currency: "PLN",
        depositAmount: 0,
        language: "PL",
      },
    },
  });
});
const open = () => {
  render(<PaymentRequestInvoicePreview requestId="request-1" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Preview online invoice (admin)" }),
  );
};
test("uses the actual website frame with no invoice IDs, hashes or credentials in its URL", async () => {
  open();
  const frame = await screen.findByTitle("Actual client invoice page");
  expect(frame).toHaveAttribute("src", clientPreviewUrl());
  expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin");
  expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
  expect(preview).toHaveBeenCalledWith("request-1");
  expect(screen.queryByRole("article")).toBeNull();
  const win = (frame as HTMLIFrameElement).contentWindow!,
    post = jest.spyOn(win, "postMessage");
  fireEvent(
    window,
    new MessageEvent("message", {
      origin: "https://bad.invalid",
      source: win,
      data: { type: PREVIEW_READY },
    }),
  );
  expect(post).not.toHaveBeenCalled();
  fireEvent(
    window,
    new MessageEvent("message", {
      origin: new URL(clientPreviewUrl()).origin,
      source: window,
      data: { type: PREVIEW_READY },
    }),
  );
  expect(post).not.toHaveBeenCalled();
  fireEvent(
    window,
    new MessageEvent("message", {
      origin: new URL(clientPreviewUrl()).origin,
      source: win,
      data: { type: PREVIEW_READY },
    }),
  );
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        type: PREVIEW_DATA,
        previewOnly: true,
        invoice: expect.objectContaining({ depositAmount: 0, language: "pl" }),
      }),
      new URL(clientPreviewUrl()).origin,
    ),
  );
  fireEvent.change(screen.getByLabelText("Preview language"), {
    target: { value: "cz" },
  });
  await waitFor(() =>
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({
        invoice: expect.objectContaining({ language: "cz" }),
      }),
      new URL(clientPreviewUrl()).origin,
    ),
  );
});
test("non-admin users get no action or API call", () => {
  auth.mockReturnValue({ user: { role: "medical_staff" } });
  render(<PaymentRequestInvoicePreview requestId="request-1" />);
  expect(screen.queryByRole("button")).toBeNull();
  expect(preview).not.toHaveBeenCalled();
});
test("failed lookup retries without displaying stale invoice data", async () => {
  preview.mockRejectedValueOnce(Error("offline"));
  open();
  await screen.findByRole("alert");
  expect(screen.queryByTitle("Actual client invoice page")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Retry invoice preview" }),
  );
  await screen.findByTitle("Actual client invoice page");
  expect(preview).toHaveBeenCalledTimes(2);
});
test("closing ignores a late response and unmounts the client frame", async () => {
  let resolve: any;
  preview.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  open();
  fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
  resolve({ data: { previewOnly: true, invoice: { invoiceNumber: "old" } } });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.queryByTitle("Actual client invoice page")).toBeNull();
});
