import type { Task } from "../../services/taskService";
export type TaskContext = "all" | Task["type"];
export type TaskView = "open" | "overdue" | "week" | "done" | "all";
export const taskContext = (task: Task): Task["type"] =>
  task.bookingId || task.type === "booking"
    ? "booking"
    : task.clientId || task.type === "client"
      ? "client"
      : task.retreatId || task.type === "retreat"
        ? "retreat"
        : "generic";
export const taskClient = (task: Task): any =>
  typeof task.clientId === "object"
    ? task.clientId
    : typeof task.bookingId === "object" &&
        typeof task.bookingId.clientId === "object"
      ? task.bookingId.clientId
      : undefined;
export const clientNumber = (task: Task): string =>
  String(
    taskClient(task)?.display_id ??
      taskClient(task)?.displayId ??
      taskClient(task)?.clientNumber ??
      "",
  );
export const clientName = (task: Task): string => {
  const c = taskClient(task);
  return c
    ? [c.firstName || c.fname, c.lastName || c.lname]
        .filter(Boolean)
        .join(" ") || "Client"
    : "";
};
export const assigneeProfile = (task: Task) =>
  typeof task.assignedToUserId === "object" && task.assignedToUserId
    ? task.assignedToUserId : task.resolvedAssignee;
export const assigneeId = (task: Task): string =>
  typeof task.assignedToUserId === "string" ? task.assignedToUserId
    : assigneeProfile(task)?._id || assigneeProfile(task)?.id || "";
export const assigneeName = (task: Task): string => {
  const a = assigneeProfile(task);
  if (a) return [a.firstName, a.lastName].filter(Boolean).join(" ").trim() || a.email || "Assigned user";
  if (task.assignedToUserId || task.resolvedAssignee === null) return "Assigned user unavailable";
  return task.assignedTo?.trim() || "";
};
export const statusLabels: Record<Task["status"], string> = {
  pending: "To do", in_progress: "In progress", on_hold: "On hold", completed: "Done", cancelled: "Cancelled",
};
export const isOpen = (task: Task) =>
  ["pending", "in_progress", "on_hold"].includes(task.status);
export function remainingDays(task: Task, now = new Date()): string {
  const due = taskDue(task);
  if (!due) return "";
  if (!isOpen(task)) return statusLabels[task.status];
  const distance = Math.round((Date.UTC(due.getFullYear(), due.getMonth(), due.getDate()) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  return distance === 0 ? "Due today" : `${Math.abs(distance)} day${Math.abs(distance) === 1 ? "" : "s"} ${distance < 0 ? "overdue" : "remaining"}`;
}
export function taskDue(task: Task): Date | null {
  if (!task.dueDate) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)
    ? new Date(task.dueDate + "T00:00:00")
    : new Date(task.dueDate);
  return Number.isNaN(date.getTime()) ? null : date;
}
const day = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
export function matchesView(
  task: Task,
  view: TaskView,
  now = new Date(),
): boolean {
  const due = taskDue(task),
    today = day(now);
  const monday = day(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const end = new Date(monday);
  end.setDate(end.getDate() + 7);
  return (
    view === "all" ||
    (view === "done"
      ? task.status === "completed"
      : view === "open"
        ? isOpen(task)
        : isOpen(task) &&
          !!due &&
          (view === "overdue" ? day(due) < today : due >= monday && due < end))
  );
}
export function dueLabel(task: Task, now = new Date()): string {
  const due = taskDue(task);
  if (!due) return "No due date";
  const a = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate()),
    b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
    distance = Math.round((a - b) / 86400000);
  if (isOpen(task) && distance < 0)
    return `${-distance} day${distance === -1 ? "" : "s"} overdue`;
  if (distance === 0) return "Today";
  if (distance === 1) return "Tomorrow";
  return due.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(due.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}
export function matchesSearch(task: Task, query: string): boolean {
  const booking =
      typeof task.bookingId === "object" ? task.bookingId : undefined,
    retreat = typeof task.retreatId === "object" ? task.retreatId : undefined;
  return [
    task.name,
    task.description,
    task.taskNumber,
    clientNumber(task),
    clientName(task),
    booking?.bookingNumber,
    retreat?.code,
    retreat?.name,
    task.category,
    assigneeName(task),
  ]
    .join(" ")
    .toLocaleLowerCase()
    .includes(query.trim().replace(/^#/, "").toLocaleLowerCase());
}
