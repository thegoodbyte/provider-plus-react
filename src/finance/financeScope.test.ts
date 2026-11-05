import { isFinanceWorkspace } from "./financeScope";
beforeEach(() => localStorage.clear());
test("restricted staff always use finance scope regardless of browser focus preferences", () => {
  localStorage.setItem("user", JSON.stringify({ id: "worker", role: "staff" }));
  expect(isFinanceWorkspace()).toBe(true);
  localStorage.setItem("staff-focus:worker", "all");
  expect(isFinanceWorkspace()).toBe(true);
});
test("admin financial focus is account-specific and does not affect other roles", () => {
  localStorage.setItem("user", JSON.stringify({ id: "admin", role: "admin" }));
  localStorage.setItem("staff-focus:other", "payments");
  expect(isFinanceWorkspace()).toBe(false);
  localStorage.setItem("staff-focus:admin", "payments");
  expect(isFinanceWorkspace()).toBe(true);
  localStorage.setItem(
    "user",
    JSON.stringify({ id: "admin", role: "medical_staff" }),
  );
  expect(isFinanceWorkspace()).toBe(false);
});
test("missing/corrupt browser state never impersonates a staff grant", () => {
  expect(isFinanceWorkspace()).toBe(false);
  localStorage.setItem("user", "{");
  expect(isFinanceWorkspace()).toBe(false);
});
