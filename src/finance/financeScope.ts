export const financeCapabilities = [
  "finance.read",
  "finance.capture",
  "finance.reconcile",
  "finance.requests",
  "finance.invoices",
  "finance.refund",
  "finance.delete",
  "finance.bookings",
] as const;
export function isFinanceWorkspace() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    return (
      u?.role === "staff" ||
      (u?.role === "admin" &&
        localStorage.getItem(
          "staff-focus:" + String(u._id || u.id || u.email),
        ) === "payments")
    );
  } catch {
    return false;
  }
}
