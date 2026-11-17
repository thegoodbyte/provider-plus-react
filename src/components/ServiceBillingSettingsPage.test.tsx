import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ServiceBillingSettingsPage from "./ServiceBillingSettingsPage";
import { serviceRequestsApi } from "../services/api";

jest.mock("../services/api", () => ({
  serviceRequestsApi: { settings: jest.fn(), saveSettings: jest.fn() },
}));

const configuration = {
  issuer: { name: "Iboga Spirit s.r.o.", email: "billing@example.test", address: "", registrationNumber: "", taxId: "", taxNote: "" },
  services: [
    { code: "medical", names: { en: "Medical verification" }, descriptions: {}, price: 25, currency: "EUR", active: true, policyCode: "full" },
  ],
  policies: [
    { code: "full", name: "Full upfront", language: "en", version: 1, acknowledgementRequired: false, paymentTerms: "Pay upfront", cancellationTerms: "No refund" },
  ],
  paymentMethods: { revolutUrl: "https://revolut.me/test" },
};

// PPVC-1004: this page used to import the same bespoke sr-* CSS namespace as
// ServicePaymentRequestPage.tsx -- it is now built from the shared Card/AppleButton/AppleInput kit.
describe("ServiceBillingSettingsPage (PPVC-1004)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (serviceRequestsApi.settings as jest.Mock).mockResolvedValue({ data: { configuration } });
    (serviceRequestsApi.saveSettings as jest.Mock).mockResolvedValue({ data: { configuration } });
  });

  it("renders each settings section inside the shared Card surface", async () => {
    const { container } = render(<MemoryRouter><ServiceBillingSettingsPage /></MemoryRouter>);
    await screen.findByText("Services");
    expect(container.querySelectorAll(".border-apple-gray-200.shadow-apple-sm").length).toBeGreaterThanOrEqual(4);
  });

  it("edits a service name via the shared AppleInput and saves settings", async () => {
    render(<MemoryRouter><ServiceBillingSettingsPage /></MemoryRouter>);
    const englishName = await screen.findByLabelText(/^English name/);
    fireEvent.change(englishName, { target: { value: "Medical screening" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(serviceRequestsApi.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: expect.objectContaining({
          services: [expect.objectContaining({ names: expect.objectContaining({ en: "Medical screening" }) })],
        }),
      }),
    ));
  });
});
