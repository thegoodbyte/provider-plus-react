import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Page from "./ServicePaymentRequestPage";
import { clientsApi, serviceRequestsApi } from "../services/api";
jest.mock("../services/api", () => ({
  clientsApi: { getBookingOptions: jest.fn() },
  serviceRequestsApi: {
    settings: jest.fn(),
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
  fireEvent.change(screen.getByLabelText("Client"), {
    target: { value: "c1" },
  });
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
    expect(serviceRequestsApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "c1",
        currency: "EUR",
        requestedAmount: 25,
        policyCode: "full",
        lineItems: [
          expect.objectContaining({
            serviceCode: "medical",
            unitPrice: 25,
            quantity: 1,
          }),
        ],
      }),
    ),
  );
  expect(serviceRequestsApi.action).not.toHaveBeenCalled();
});
test("invalidates review on item changes and shows server errors without losing items", async () => {
  mock(serviceRequestsApi.create).mockRejectedValue({
    response: { data: { message: "Settings changed" } },
  });
  mount();
  await screen.findByLabelText("Client");
  fireEvent.change(screen.getByLabelText("Client"), {
    target: { value: "c1" },
  });
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
