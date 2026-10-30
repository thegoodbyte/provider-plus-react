jest.mock("./InvoiceVisitHistory", () => () => null);
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Page from "./ServicePaymentRequestPage";
import {
  clientsApi,
  serviceRequestsApi,
  invoiceDraftsApi,
} from "../services/api";
jest.mock("../services/api", () => ({
  clientsApi: { getBookingOptions: jest.fn() },
  invoiceDraftsApi: {
    list: jest.fn(),
    get: jest.fn(),
    save: jest.fn(),
    issue: jest.fn(),
    discard: jest.fn(),
  },
  serviceRequestsApi: {
    settings: jest.fn(),
    issueInvoice: jest.fn(),
    invoicePdf: jest.fn(),
    previewInvoice: jest.fn(),
    create: jest.fn(),
    get: jest.fn(),
    action: jest.fn(),
  },
}));
jest.mock("./EmailComposeModal", () => () => <div>Email composer</div>);
const config = {
  services: [
    {
      code: "medical",
      names: { en: "Medical verification", pl: "Weryfikacja medyczna" },
      price: 25,
      currency: "EUR",
      active: true,
      policyCode: "full",
    },
  ],
  policies: [
    {
      code: "full",
      name: "Full upfront",
      paymentTerms: "Pay upfront",
      cancellationTerms: "No refund",
      version: 1,
    },
  ],
  paymentMethods: { revolutUrl: "https://revolut.me/test" },
};
const mock = (f: unknown) => f as jest.Mock;
const mount = (path = "/admin/payment-requests/services/new") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/payment-requests/services/new" element={<Page />} />
        <Route path="/admin/payment-requests/services/:id" element={<Page />} />
      </Routes>
    </MemoryRouter>,
  );
beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  localStorage.setItem("user", JSON.stringify({ id: "test-admin" }));
  mock(invoiceDraftsApi.list).mockResolvedValue({ data: [] });
  mock(invoiceDraftsApi.save).mockImplementation((id, b) =>
    Promise.resolve({
      data: {
        draftId: id,
        revision: b.revision + 1,
        payload: b.payload,
        updatedAt: "2026-10-30T12:00:00Z",
      },
    }),
  );
  mock(invoiceDraftsApi.issue).mockResolvedValue({ data: { _id: "s1" } });
  mock(serviceRequestsApi.settings).mockResolvedValue({
    data: { version: 1, configuration: config },
  });
  mock(clientsApi.getBookingOptions).mockResolvedValue({
    data: [
      {
        _id: "c1",
        firstName: "Anna",
        lastName: "Test",
        email: "anna@example.test",
      },
    ],
  });
  mock(serviceRequestsApi.get).mockRejectedValue(
    new Error("Fixture request unavailable"),
  );
});
test("requires review before issuing EUR 25 and sends no automatic email", async () => {
  mock(serviceRequestsApi.create).mockResolvedValue({ data: { _id: "s1" } });
  mount();
  await screen.findByLabelText("Client");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Save draft now" }),
    ).toBeEnabled(),
  );
  expect(screen.queryByText("Find client")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Client"), {
    target: { value: "anna@example" },
  });
  fireEvent.keyDown(screen.getByLabelText("Client"), { key: "ArrowDown" });
  fireEvent.keyDown(screen.getByLabelText("Client"), { key: "Enter" });
  fireEvent.change(screen.getByLabelText("Add a configured service"), {
    target: { value: "medical" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review request" }));
  expect(serviceRequestsApi.create).not.toHaveBeenCalled();
  expect(screen.getByText("Ready to issue")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Issue payment request" }),
  );
  await waitFor(() =>
    expect(invoiceDraftsApi.save).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        payload: expect.objectContaining({
          clientId: "c1",
          currency: "EUR",

          policyCode: "full",
          items: [
            expect.objectContaining({
              serviceCode: "medical",
              unitPrice: 25,
              quantity: 1,
            }),
          ],
        }),
      }),
    ),
  );
  expect(serviceRequestsApi.action).not.toHaveBeenCalled();
});
test("invalidates review on item changes and shows server errors without losing items", async () => {
  mock(invoiceDraftsApi.issue).mockRejectedValue({
    response: { data: { message: "Settings changed" } },
  });
  mount();
  await screen.findByLabelText("Client");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Save draft now" }),
    ).toBeEnabled(),
  );
  expect(screen.queryByText("Find client")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Client"), {
    target: { value: "anna@example" },
  });
  fireEvent.keyDown(screen.getByLabelText("Client"), { key: "ArrowDown" });
  fireEvent.keyDown(screen.getByLabelText("Client"), { key: "Enter" });
  fireEvent.change(screen.getByLabelText("Add a configured service"), {
    target: { value: "medical" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review request" }));
  fireEvent.change(screen.getByLabelText("Unit price (EUR)"), {
    target: { value: "30" },
  });
  expect(screen.queryByText("Ready to issue")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Review request" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Issue payment request" }),
  );
  await screen.findByRole("alert");
  expect(screen.getByRole("alert")).toHaveTextContent("Settings changed");
  expect(screen.getByLabelText("Unit price (EUR)")).toHaveValue(30);
});
test("offers copy/open/send and recording for partial payment but never claims paid", async () => {
  const request = {
    _id: "s1",
    context: "standalone_service",
    invoiceNumber: "2000",
    publicHash: "a".repeat(32),
    status: "pending",
    amountReceived: 10,
    amountOutstanding: 15,
    requestedAmount: 25,
    currency: "EUR",
    serviceDocument: {
      title: "Medical verification",
      client: { name: "Anna Test", email: "anna@example.test" },
      policy: config.policies[0],
    },
    lineItems: [
      {
        description: "Medical verification",
        quantity: 1,
        unitPrice: 25,
        amount: 25,
      },
    ],
  };
  mock(serviceRequestsApi.get).mockResolvedValue({ data: request });
  mount("/admin/payment-requests/services/s1");
  await screen.findByText("Outstanding €15.00");
  expect(screen.queryByText("Paid in full")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Record payment" })).toHaveAttribute(
    "href",
    "/admin/payments/new?paymentRequestId=s1",
  );
  expect(
    screen.getByRole("link", { name: "Open client page" }),
  ).toHaveAttribute("rel", "noopener noreferrer");
  fireEvent.click(screen.getByRole("button", { name: "Send payment request" }));
  await screen.findByText("Email composer");
});
test("settled request is immutable and hides recording and cancellation", async () => {
  mock(serviceRequestsApi.get).mockResolvedValue({
    data: {
      _id: "s1",
      invoiceNumber: "2000",
      status: "paid",
      publicHash: "a".repeat(32),
      amountReceived: 25,
      amountOutstanding: 0,
      requestedAmount: 25,
      currency: "EUR",
      serviceDocument: {
        title: "Medical",
        client: { name: "Anna" },
        policy: config.policies[0],
      },
      lineItems: [],
    },
  });
  mount("/admin/payment-requests/services/s1");
  await screen.findByText("Paid in full");
  expect(
    screen.queryByRole("link", { name: "Record payment" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Cancel request" }),
  ).not.toBeInTheDocument();
});

test("one-off recipient creates an itemized request without manufacturing a client", async () => {
  mount();
  await screen.findByLabelText("Client");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Save draft now" }),
    ).toBeEnabled(),
  );
  fireEvent.change(screen.getByLabelText("Recipient type"), {
    target: { value: "recipient" },
  });
  expect(screen.queryByLabelText("Client")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Recipient / company name"), {
    target: { value: "Example Company" },
  });
  fireEvent.change(screen.getByLabelText("Billing email"), {
    target: { value: "billing@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("Recipient billing address"), {
    target: { value: "Test address" },
  });
  fireEvent.change(screen.getByLabelText("Add a configured service"), {
    target: { value: "medical" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review request" }));
  expect(screen.getByText(/Example Company/)).toBeInTheDocument();
  expect(serviceRequestsApi.create).not.toHaveBeenCalled();
  mock(serviceRequestsApi.create).mockResolvedValue({ data: { _id: "s1" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Issue payment request" }),
  );
  await waitFor(() =>
    expect(invoiceDraftsApi.save).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        payload: expect.objectContaining({
          recipientMode: "recipient",
          billingRecipient: expect.objectContaining({
            name: "Example Company",
            address: "Test address",
          }),
          items: expect.any(Array),
        }),
      }),
    ),
  );
});
test("invoice issuance is separate from payment recording and keeps received/outstanding state", async () => {
  const r = {
    _id: "s1",
    invoiceNumber: "2000",
    publicHash: "a".repeat(32),
    status: "pending",
    amountReceived: 0,
    amountOutstanding: 25,
    requestedAmount: 25,
    currency: "EUR",
    serviceDocument: {
      title: "Medical",
      client: { name: "Anna", email: "anna@example.invalid" },
      policy: config.policies[0],
    },
    lineItems: [],
  };
  mock(serviceRequestsApi.get).mockResolvedValue({ data: r });
  mock(serviceRequestsApi.issueInvoice).mockResolvedValue({ data: {} });
  mount("/admin/payment-requests/services/s1");
  await screen.findByRole("button", { name: "Issue invoice" });
  fireEvent.change(screen.getByLabelText("Recipient billing address"), {
    target: { value: "Billing address" },
  });
  mock(serviceRequestsApi.get).mockResolvedValue({
    data: {
      ...r,
      invoiceDocument: {
        number: "INV-2000",
        issuedAt: "2026-10-30",
        recipient: { name: "Anna", address: "Billing address" },
      },
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Issue invoice" }));
  await screen.findByRole("button", { name: "Download invoice PDF" });
  expect(serviceRequestsApi.issueInvoice).toHaveBeenCalledWith(
    "s1",
    expect.objectContaining({
      billingRecipient: expect.objectContaining({ address: "Billing address" }),
    }),
  );
  expect(
    screen.getByRole("link", { name: "Record payment" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Outstanding €25.00")).toBeInTheDocument();
  expect(screen.queryByText("Paid in full")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Cancel request" }),
  ).not.toBeInTheDocument();
});
test("client profile shortcut prefills its client without requiring another selection", async () => {
  mock(serviceRequestsApi.create).mockResolvedValue({ data: { _id: "s1" } });
  mount("/admin/payment-requests/services/new?clientId=c1");
  await screen.findByLabelText("Client");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Save draft now" }),
    ).toBeEnabled(),
  );
  fireEvent.change(screen.getByLabelText("Add a configured service"), {
    target: { value: "medical" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review request" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Issue payment request" }),
  );
  await waitFor(() =>
    expect(invoiceDraftsApi.save).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        payload: expect.objectContaining({ clientId: "c1" }),
      }),
    ),
  );
});
test("a mistaken currency change cannot remove eight recovered items, and an explicit change can be undone", async () => {
  mock(invoiceDraftsApi.list).mockResolvedValue({
    data: [
      {
        draftId: "11111111-1111-4111-8111-111111111111",
        revision: 1,
        status: "draft",
        payload: {
          clientId: "c1",
          title: "Eight items",
          currency: "EUR",
          policyCode: "full",
          items: Array.from({ length: 8 }, (_, i) => ({
            type: "charge",
            description: "Item " + (i + 1),
            quantity: 1,
            unitPrice: 25,
          })),
          language: "en",
          recipientMode: "client",
          billingRecipient: { name: "", email: "", address: "" },
        },
      },
    ],
  });
  mount();
  await screen.findByDisplayValue("Item 8");
  expect(screen.getAllByLabelText("Description")).toHaveLength(8);
  fireEvent.change(screen.getByLabelText("Currency"), {
    target: { value: "PLN" },
  });
  await screen.findByRole("dialog", {
    name: "Change currency and clear items?",
  });
  fireEvent.click(screen.getByRole("button", { name: "Keep items" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(screen.getAllByLabelText("Description")).toHaveLength(8);
  expect(screen.getByLabelText("Currency")).toHaveValue("EUR");
  expect(invoiceDraftsApi.issue).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Currency"), {
    target: { value: "PLN" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Change currency and clear items" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(screen.queryAllByLabelText("Description")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Undo currency change" }));
  expect(screen.getAllByLabelText("Description")).toHaveLength(8);
  expect(screen.getByLabelText("Currency")).toHaveValue("EUR");
});
