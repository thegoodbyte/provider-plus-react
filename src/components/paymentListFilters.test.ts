import {
  emptyPaymentFilters,
  paymentMatchesFilters,
  paymentFilterError,
  readPaymentFilters,
  paymentConfirmationPath,
  safePaymentReturn,
} from "./paymentListFilters";
const f = (values: any = {}) => ({ ...emptyPaymentFilters, ...values });
const payment: any = {
  bookingId: null,
  paymentRequestId: undefined,
  status: "completed",
  currency: "PLN",
  paymentMethod: "bank_transfer",
  amount: 100,
  paymentDate: "2026-10-20T23:59:59.999Z",
};
it("combines absent/null/object/string links without confusing a PR with a booking", () => {
  expect(
    paymentMatchesFilters(
      payment,
      f({ booking: "without", request: "without" }),
    ),
  ).toBe(true);
  for (const link of ["request", { _id: "request" }])
    expect(
      paymentMatchesFilters(
        { ...payment, paymentRequestId: link },
        f({ booking: "without", request: "without" }),
      ),
    ).toBe(false);
  expect(
    paymentMatchesFilters(
      { ...payment, paymentRequestId: { _id: "request" } },
      f({ booking: "without", request: "with" }),
    ),
  ).toBe(true);
  expect(
    paymentMatchesFilters(
      { ...payment, bookingId: "gone", bookingAvailable: false },
      f({ booking: "unavailable" }),
    ),
  ).toBe(true);
});
it("includes whole UTC days and handles offset timestamps, ranges and zero amounts", () => {
  expect(
    paymentMatchesFilters(
      payment,
      f({ from: "2026-10-20", to: "2026-10-20", min: "100", max: "100" }),
    ),
  ).toBe(true);
  expect(
    paymentMatchesFilters(
      { ...payment, paymentDate: "2026-10-20T23:00:00-02:00" },
      f({ to: "2026-10-20" }),
    ),
  ).toBe(false);
  expect(
    paymentMatchesFilters({ ...payment, amount: 0 }, f({ min: "0", max: "0" })),
  ).toBe(true);
  expect(
    paymentMatchesFilters(
      { ...payment, paymentDate: "bad" },
      f({ from: "2026-10-20" }),
    ),
  ).toBe(false);
});
it("combines status, currency, method and durable repair flags", () => {
  const filter = f({
    status: "completed",
    currency: "PLN",
    method: "bank_transfer",
    repair: "yes",
  });
  expect(paymentMatchesFilters(payment, filter)).toBe(false);
  expect(
    paymentMatchesFilters({ ...payment, requestLinkPending: true }, filter),
  ).toBe(true);
  expect(
    paymentMatchesFilters(
      { ...payment, requestLinkPending: true, currency: "EUR" },
      filter,
    ),
  ).toBe(false);
});
it.each([
  { from: "2026-02-30" },
  { from: "2026-10-21", to: "2026-10-20" },
  { min: "10", max: "9" },
  { min: "-1" },
  { max: "1.001" },
])("explains invalid ranges %j", (values) =>
  expect(paymentFilterError(f(values))).not.toBe(""),
);
it("retains valid URL filters, accepts leap day and drops unknown enumeration values", () => {
  expect(
    readPaymentFilters(
      new URLSearchParams(
        "booking=without&request=without&currency=PLN&q=hello",
      ),
    ),
  ).toMatchObject({
    booking: "without",
    request: "without",
    currency: "PLN",
    q: "hello",
  });
  expect(
    readPaymentFilters(new URLSearchParams("booking=bad&repair=hack")),
  ).toMatchObject({ booking: "", repair: "" });
  expect(paymentFilterError(f({ from: "2028-02-29" }))).toBe("");
});
it("builds a review-only booking entry and permits only a same-origin payment-list return", () => {
  const path = paymentConfirmationPath(
    "booking",
    "/admin/payments?booking=with&currency=PLN",
  );
  expect(path).toContain("confirmation=1");
  expect(
    safePaymentReturn(
      "/admin/payments?currency=PLN",
      "/admin",
      "https://admin.test",
    ),
  ).toBe("/admin/payments?currency=PLN");
  for (const value of [
    "https://evil.test/admin/payments",
    "//evil.test/admin/payments",
    "/admin/users",
    "https://[bad",
  ])
    expect(safePaymentReturn(value, "/admin", "https://admin.test")).toBe(
      "/admin/payments",
    );
});
