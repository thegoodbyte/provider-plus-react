import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PaymentInvoiceActions from "./PaymentInvoiceActions";
import { paymentRequestsApi, serviceRequestsApi } from "../services/api";
jest.mock("../services/api", () => ({
  paymentRequestsApi: { getOneFresh: jest.fn() },
  serviceRequestsApi: { get: jest.fn() },
}));
jest.mock("./PaymentRequestInvoicePreview", () => ({
  __esModule: true,
  default: ({ requestId }: any) => <button>Preview {requestId}</button>,
}));
jest.mock("./EmailComposeModal", () => ({
  __esModule: true,
  default: ({ initialValues, onClose, onSent }: any) => (
    <div role="dialog" aria-label="Email invoice link">
      <p>{initialValues.to}</p>
      <pre>{initialValues.bodyText}</pre>
      <button onClick={onClose}>Close composer</button>
      <button onClick={onSent}>Simulate confirmed send</button>
    </div>
  ),
}));
const request = {
  _id: "request",
  publicHash: "private-hash",
  status: "paid",
  invoiceNumber: 1365,
  clientId: {
    _id: "client",
    firstName: "Eva",
    email: "eva@example.invalid",
    language: "PL",
  },
};
const open = (props: any = {}) =>
  render(
    <MemoryRouter>
      <PaymentInvoiceActions requestId="request" clientId="client" {...props} />
    </MemoryRouter>,
  );
beforeEach(() => {
  jest.clearAllMocks();
  (paymentRequestsApi.getOneFresh as jest.Mock).mockResolvedValue({
    data: request,
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
});
it("opens/copies the correct client-language invoice and reviews email without marking a paid invoice sent", async () => {
  const loaded = jest.fn();
  open({ onRequestLoaded: loaded });
  const link = await screen.findByRole("link", { name: "Open online invoice" });
  expect(link).toHaveAttribute(
    "href",
    "https://ibogaspirit.pl/clients/payment/request/private-hash?lang=pl",
  );
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(loaded).toHaveBeenCalledWith(request);
  fireEvent.click(screen.getByRole("button", { name: "Copy invoice link" }));
  await screen.findByText("Private invoice link copied.");
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
    link.getAttribute("href"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Email invoice link" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("eva@example.invalid");
  expect(screen.getByRole("dialog")).toHaveTextContent(
    link.getAttribute("href")!,
  );
  fireEvent.click(screen.getByText("Close composer"));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(paymentRequestsApi.getOneFresh).toHaveBeenCalledTimes(1);
  expect(request.status).toBe("paid");
});
it.each([
  { ...request, status: "cancelled" },
  { ...request, publicLinkRevokedAt: "2026-10-01" },
  { ...request, publicHash: "" },
  { ...request, clientId: { _id: "other" } },
])(
  "does not share inactive, missing or mismatched private links",
  async (data) => {
    (paymentRequestsApi.getOneFresh as jest.Mock).mockResolvedValue({ data });
    open();
    await screen.findByText("Open linked payment request");
    await waitFor(() =>
      expect(screen.queryByText("Loading invoice link…")).toBeNull(),
    );
    expect(
      screen.queryByRole("link", { name: "Open online invoice" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Email invoice link" }),
    ).toBeNull();
  },
);
it("handles absent request, denied reads, retry and copy fallback", async () => {
  const { unmount } = open({ requestId: "" });
  expect(paymentRequestsApi.getOneFresh).not.toHaveBeenCalled();
  expect(screen.getByText(/Link a payment request/)).toBeInTheDocument();
  unmount();
  (paymentRequestsApi.getOneFresh as jest.Mock)
    .mockRejectedValueOnce(Error("Denied"))
    .mockResolvedValueOnce({ data: request });
  open();
  fireEvent.click(
    await screen.findByRole("button", { name: "Retry invoice link" }),
  );
  await screen.findByRole("link", { name: "Open online invoice" });
  (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(
    Error("unavailable"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy invoice link" }));
  await screen.findByText(/Clipboard unavailable/);
});
it("rejects late responses from a prior payment request and uses service URL without retreat preview", async () => {
  let oldResolve: any;
  (paymentRequestsApi.getOneFresh as jest.Mock)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          oldResolve = resolve;
        }),
    )
    .mockResolvedValueOnce({
      data: { ...request, _id: "service", context: "standalone_service" },
    });
  (serviceRequestsApi.get as jest.Mock).mockResolvedValue({
    data: { ...request, _id: "service", context: "standalone_service" },
  });
  const { rerender } = open();
  rerender(
    <MemoryRouter>
      <PaymentInvoiceActions requestId="service" clientId="client" />
    </MemoryRouter>,
  );
  expect(
    await screen.findByRole("link", { name: "Open online invoice" }),
  ).toHaveAttribute(
    "href",
    "https://ibogaspirit.cz/clients/payment/services/private-hash",
  );
  oldResolve({ data: request });
  await waitFor(() => expect(screen.queryByText("Preview request")).toBeNull());
  expect(screen.queryByText("Preview service")).toBeNull();
});
