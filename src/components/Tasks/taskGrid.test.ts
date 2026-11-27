import {
  clientNumber,
  dueLabel,
  matchesSearch,
  matchesView,
  taskDue,
} from "./taskGrid";
import type { Task } from "../../services/taskService";
const task = (more: Partial<Task> = {}): Task => ({
  id: "internal",
  name: "Call guest",
  taskNumber: 901,
  description: "Support call",
  type: "booking",
  urgency: "medium",
  status: "pending",
  dueDate: "2026-11-27",
  tags: [],
  createdAt: "",
  updatedAt: "",
  clientId: {
    _id: "actual-client",
    firstName: "Ewa",
    lastName: "Franus",
    email: "",
    display_id: 1333,
  },
  bookingId: { bookingNumber: 1320 },
  ...more,
});
const now = new Date(2026, 10, 27, 14);
it("searches exact human references, names and context without using Mongo suffixes", () => {
  for (const query of ["#901", "#1333", "Ewa Franus", "1320", "support"])
    expect(matchesSearch(task(), query)).toBe(true);
  expect(matchesSearch(task(), "internal")).toBe(false);
  expect(matchesSearch(task(), "unrelated")).toBe(false);
  expect(clientNumber(task({ clientId: "raw-id" }))).toBe("");
});
it("defines open/done/overdue truthfully for terminal and missing/invalid due dates", () => {
  expect(matchesView(task({ dueDate: "2026-11-26" }), "overdue", now)).toBe(
    true,
  );
  for (const status of ["completed", "cancelled"] as const) {
    expect(
      matchesView(task({ status, dueDate: "2026-11-01" }), "overdue", now),
    ).toBe(false);
    expect(matchesView(task({ status }), "open", now)).toBe(false);
  }
  expect(matchesView(task({ status: "completed" }), "done", now)).toBe(true);
  expect(matchesView(task({ status: "cancelled" }), "done", now)).toBe(false);
  expect(taskDue(task({ dueDate: "invalid" }))).toBeNull();
  expect(dueLabel(task({ dueDate: undefined }), now)).toBe("No due date");
});
it("uses local calendar days and a Monday-through-Sunday week over month/year boundaries", () => {
  expect(dueLabel(task(), now)).toBe("Today");
  expect(dueLabel(task({ dueDate: "2026-11-28" }), now)).toBe("Tomorrow");
  expect(dueLabel(task({ dueDate: "2026-11-24" }), now)).toBe("3 days overdue");
  expect(matchesView(task({ dueDate: "2026-11-29" }), "week", now)).toBe(true);
  expect(matchesView(task({ dueDate: "2026-11-30" }), "week", now)).toBe(false);
  expect(
    matchesView(
      task({ dueDate: "2027-01-03" }),
      "week",
      new Date(2026, 11, 31),
    ),
  ).toBe(true);
  expect(
    matchesView(
      task({ dueDate: "2027-01-04" }),
      "week",
      new Date(2026, 11, 31),
    ),
  ).toBe(false);
});
