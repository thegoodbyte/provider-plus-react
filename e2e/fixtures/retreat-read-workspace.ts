import { test as base, expect } from "@playwright/test";
import type { PaymentSummary } from "../../src/types";
const oid = (n: number) => n.toString(16).padStart(24, "0");
export const test = base.extend<{ retreatRead: any }>({
  retreatRead: async ({ page }, use) => {
    const retreat = {
      _id: oid(1),
      name: "Coverage retreat",
      code: "COV-2099",
      retreatCode: "COV-2099",
      type: "regular",
      status: "upcoming",
      startDate: "2099-01-01",
      endDate: "2099-01-08",
      capacity: 10,
      location: "Synthetic location",
      currency: "PLN",
    };
    const clients = [
      {
        _id: oid(2),
        display_id: 1333,
        firstName: "Ewa",
        lastName: "Coverage",
        phone: "+48 700 111 222",
        email: "ewa@example.invalid",
      },
      {
        _id: oid(3),
        display_id: 1334,
        firstName: "Adam",
        lastName: "Coverage",
        phone: "+420 700 333 444",
        email: "adam@example.invalid",
      },
    ];
    const bookings = clients.map((client, i) => ({
      _id: oid(10 + i),
      bookingNumber: 2836 + i,
      clientId: client,
      retreatId: retreat,
      bookingType: "full_retreat",
      roomType: "shared",
      accommodationKey: "shared",
      status: "confirmed",
      totalAmount: 1000,
      amountPaid: i ? 0 : 1000,
      currency: "PLN",
      arrivalDate: "2099-01-01",
      departureDate: "2099-01-08",
    }));
    let writes = 0;
    await page.route("**/*", async (route) => {
      const q = route.request(),
        p = new URL(q.url()).pathname;
      if (!["xhr", "fetch"].includes(q.resourceType())) return route.continue();
      if (q.method() !== "GET") {
        writes++;
        throw Error(
          "Read-only retreat coverage must not simulate persisted writes",
        );
      }
      if (p === "/retreats") return route.fulfill({ json: [retreat] });
      if (p === "/retreats/" + retreat._id)
        return route.fulfill({ json: retreat });
      if (p.includes("/retreat/" + retreat._id) && p.startsWith("/bookings"))
        return route.fulfill({ json: bookings });
      if (p === "/bookings") return route.fulfill({ json: bookings });
      if (p === "/clients" || p === "/clients/booking-options")
        return route.fulfill({ json: clients });
      if (p.startsWith("/retreat-expenses/") && p.endsWith("/summary"))
        return route.fulfill({
          json: {
            totalExpenses: 0,
            plannedExpenses: 0,
            actualExpenses: 0,
            byType: [],
          },
        });
      // Match the production PaymentSummary contract; [] is not an empty summary.
      if (p === "/payments/retreat-summary/" + retreat._id) {
        const summary: PaymentSummary = {
          totalPayments: 0, totalPaymentsEUR: 0, totalPaymentsUSD: 0,
          completedPayments: 0, completedPaymentsEUR: 0, completedPaymentsUSD: 0,
          pendingPayments: 0, pendingPaymentsEUR: 0, pendingPaymentsUSD: 0,
          refundedPayments: 0, refundedPaymentsEUR: 0, refundedPaymentsUSD: 0,
          depositsPaid: 0, depositsEUR: 0, depositsUSD: 0,
          finalPaymentsPaid: 0, finalPaymentsEUR: 0, finalPaymentsUSD: 0,
          paymentsByMethod: {}, paymentsByStatus: {},
        };
        return route.fulfill({ json: summary });
      }
      if (p.includes("financial-summary"))
        return route.fulfill({
          json: {
            amountPaid: 1000,
            totalPaid: 1000,
            currency: "PLN",
            usdAmount: 250,
          },
        });
      if (p === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      if (p.includes("config-summary")) return route.fulfill({ json: {} });
      return route.fulfill({ json: [] });
    });
    await use({ retreat, clients, bookings, writes: () => writes });
    expect(writes).toBe(0);
  },
});
export { expect };
