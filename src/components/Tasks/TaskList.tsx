import React, { useEffect, useState } from "react";
import { taskService, Task } from "../../services/taskService";
import { usersApi, User } from "../../services/usersApi";
import { MoreVertical, Zap } from "lucide-react";
import { TaskDetails } from "./TaskDetails";
import AppleButton from "../AppleButton";
import {
  Badge,
  Card,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "../ui";
import {
  assigneeName,
  clientName,
  clientNumber,
  assigneeId,
  remainingDays,
  statusLabels,
  isOpen,
  matchesView,
  taskClient,
  taskContext,
  taskDue,
} from "./taskGrid";
import "./TaskList.css";
interface TaskListProps {
  workspacePath?: string;
  tasks: Task[];
  totalCount?: number;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onCompleteTask: (id: string) => void;
  onTaskUpdated?: () => Promise<void> | void;
}
export const TaskList: React.FC<TaskListProps> = ({
  workspacePath = "/admin/tasks",
  tasks,
  totalCount = tasks.length,
  onEditTask,
  onDeleteTask,
  onCompleteTask,
  onTaskUpdated,
}) => {
  const [viewingTask, setViewingTask] = useState<Task | null>(null),
    [sortField, setSortField] = useState("dueDate"),
    [direction, setDirection] = useState<"asc" | "desc">("asc"),
    [page, setPage] = useState(1);
  useEffect(() => setPage(1), [tasks, sortField, direction]);
  const [users, setUsers] = useState<User[]>([]);
  const [directoryError, setDirectoryError] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryAttempt, setDirectoryAttempt] = useState(0);
  const [saving, setSaving] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savedTasks, setSavedTasks] = useState<Record<string, Task>>({});
  useEffect(() => setSavedTasks({}), [tasks]);
  useEffect(() => {
    let active = true;
    setDirectoryLoading(true);
    setDirectoryError("");
    usersApi.getTaskAssignees().then(response => {
      if (active) setUsers(response.data);
    }).catch(() => {
      if (active) setDirectoryError("Could not load assignees.");
    }).finally(() => { if (active) setDirectoryLoading(false); });
    return () => { active = false; };
  }, [directoryAttempt]);
  const update = async (task: Task, patch: { assignedToUserId?: string | null; status?: Task["status"] }) => {
    if (saving) return;
    setSaving(task.id);
    setSaveError("");
    try {
      const saved = await taskService.updateTask(task.id, patch);
      setSavedTasks(current => ({ ...current, [task.id]: saved }));
      try { await onTaskUpdated?.(); }
      catch { setSaveError("Saved, but tasks could not refresh. Reload to see the latest state."); }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save task. Please try again.");
    } finally { setSaving(""); }
  };

  const prefix = "/" + (workspacePath.split("/")[1] || "admin");
  const bookingNumber = (t: Task) =>
    typeof t.bookingId === "object"
      ? String(t.bookingId.bookingNumber || "")
      : "";
  const retreatName = (t: Task) =>
    typeof t.retreatId === "object" ? t.retreatId.code || t.retreatId.name : "";
  const value = (t: Task): string | number =>
    sortField === "dueDate"
      ? (taskDue(t)?.getTime() ?? Infinity)
      : sortField === "urgency"
        ? { low: 1, medium: 2, high: 3, urgent: 4 }[t.urgency] || 0
        : sortField === "clientNumber"
          ? Number(clientNumber(t)) || Infinity
          : sortField === "assigneeName"
            ? assigneeName(t)
            : sortField === "type"
              ? taskContext(t)
              : String(t[sortField as keyof Task] || "");
  const sorted = tasks.map(task => savedTasks[task.id] || task).sort((a, b) => {
    const x = value(a),
      y = value(b);
    return (x < y ? -1 : x > y ? 1 : 0) * (direction === "asc" ? 1 : -1);
  });
  const size = 15,
    pages = Math.max(1, Math.ceil(sorted.length / size)),
    current = Math.min(page, pages),
    shown = sorted.slice((current - 1) * size, current * size);
  const sort = (field: string) => {
    if (sortField === field) setDirection(direction === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setDirection("asc");
    }
  };
  const header = (name: string, field: string) => (
    <TableHeaderCell
      className="sortable"
      onSort={() => sort(field)}
      sortDirection={sortField === field ? direction : undefined}
    >
      {name}
    </TableHeaderCell>
  );
  if (!tasks.length)
    return (
      <div className="task-list-empty">
        <p>No tasks found. Create your first task to get started!</p>
      </div>
    );
  return (
    <div className="task-list">
      {saveError && <div role="alert">{saveError}</div>}
      {directoryError && <div role="alert">{directoryError} <AppleButton size="sm" variant="secondary" onClick={() => setDirectoryAttempt(x => x + 1)}>Retry assignees</AppleButton></div>}

      <Card padding="none" className="task-grid">
        <Table className="task-table">
          <caption className="sr-only">Tasks</caption>
          <TableHead>
            <TableRow className="task-grid-header">
              <TableHeaderCell>
                <span className="sr-only">Completion</span>
              </TableHeaderCell>
              {header("Task", "name")}
              {header("Client ID", "clientNumber")}
              {header("Type", "type")}
              {header("Priority", "urgency")}
              {header("Status", "status")}
              {header("Due", "dueDate")}
              {header("Assignee", "assigneeName")}
              <TableHeaderCell>
                <span className="sr-only">Actions</span>
              </TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((task) => {
              const client = taskClient(task),
                number = clientNumber(task),
                clientId = client?._id || client?.id,
                name = assigneeName(task),
                context = taskContext(task),
                support = Boolean(task.supportReference),
                auto = Boolean(
                  (task.sourceType &&
                    ![
                      "manual",
                      "client_support",
                      "client_portal_request",
                    ].includes(task.sourceType)) ||
                    task.sourceId ||
                    task.bookingFlowItemId,
                );
              return (
                <TableRow
                  key={task.id}
                  className={`task-row ${task.status} ${matchesView(task, "overdue") ? "overdue" : ""}`}
                >
                  <TableCell className="task-check-cell">
                    {isOpen(task) ? (
                      <input
                        type="checkbox"
                        aria-label="Mark task as complete"
                        checked={false}
                        disabled={support || Boolean(saving)}
                        onChange={() => onCompleteTask(task.id)}
                      />
                    ) : (
                      <input
                        type="checkbox"
                        aria-label={
                          task.status === "completed"
                            ? "Task completed"
                            : "Task cancelled"
                        }
                        checked={task.status === "completed"}
                        disabled
                        readOnly
                      />
                    )}
                  </TableCell>
                  <TableCell className="task-name">
                    <div className="task-title">
                      {support ? (
                        <a
                          href={
                            workspacePath +
                            "?support=" +
                            encodeURIComponent(task.supportReference!)
                          }
                        >
                          {task.supportReference} · {task.name}
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="task-title-link"
                          onClick={() => setViewingTask(task)}
                        >
                          {task.name}
                        </button>
                      )}
                    </div>
                    <div className="task-subtitle">
                      <span className="task-reference">
                        {task.taskNumber
                          ? `Task #${task.taskNumber}`
                          : "Reference pending"}
                      </span>
                      {clientName(task) && <span>{clientName(task)}</span>}
                      {bookingNumber(task) && (
                        <span>Booking #{bookingNumber(task)}</span>
                      )}
                      {retreatName(task) && (
                        <span
                          title={
                            typeof task.retreatId === "object"
                              ? `${task.retreatId.name} ${task.retreatId.code || ""}`
                              : ""
                          }
                        >
                          {retreatName(task)}
                        </span>
                      )}
                      <span>{task.category || "operations"}</span>
                      {auto && (
                        <Badge tone="neutral">
                          <Zap size={12} aria-hidden="true" />
                          Auto
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="task-client-id">
                    {number ? (
                      clientId ? (
                        <a
                          aria-label={`Client ${clientName(task)} #${number}`}
                          href={`${prefix}/clients/${encodeURIComponent(clientId)}`}
                        >
                          #{number}
                        </a>
                      ) : (
                        <span>#{number}</span>
                      )
                    ) : (
                      <span className="task-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge colorClassName={`task-type-${context}`}>
                      {context[0].toUpperCase() + context.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge colorClassName={`task-priority-${task.urgency}`}>
                      <span aria-hidden="true">●</span>{" "}
                      {task.urgency[0].toUpperCase() + task.urgency.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <select className="task-inline-select" aria-label={`Status for ${task.name}`} value={task.status} disabled={support || Boolean(saving)} onChange={event => void update(task, { status: event.target.value as Task["status"] })}>
                      {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </TableCell>
                  <TableCell className="task-due">
                    <span>{taskDue(task)?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) || "No due date"}</span>
                    <small className="task-days-remaining">{remainingDays(task)}</small>
                  </TableCell>
                  <TableCell className="task-assignee-cell">
                    <div className="assignee-info">
                      <span className={`assignee-avatar ${name ? "" : "unassigned"}`} aria-hidden="true">
                        {name ? name.split(/\s+/).map(x => x[0]).join("").slice(0, 2).toUpperCase() : ""}
                      </span>
                      <select className="task-inline-select task-assignee-select" aria-label={`Assignee for ${task.name}`} value={assigneeId(task) || (name ? "__legacy__" : "")} disabled={support || Boolean(saving) || directoryLoading || Boolean(directoryError)} onChange={event => void update(task, { assignedToUserId: event.target.value || null })}>
                        <option value="">Unassigned</option>
                        {name && !assigneeId(task) && <option value="__legacy__" disabled>{name}</option>}
                        {assigneeId(task) && !users.some(u => u._id === assigneeId(task)) && <option value={assigneeId(task)} disabled>{name || "Assigned user unavailable"}</option>}
                        {users.map(user => <option key={user._id} value={user._id}>{[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email}</option>)}
                      </select>
                    </div>
                  </TableCell>
                  <TableCell className="task-actions">
                    <details
                      className="task-row-menu"
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.currentTarget.open = false;
                          event.currentTarget.querySelector("summary")?.focus();
                        }
                      }}
                    >
                      <summary aria-label={`Actions for ${task.name}`}>
                        <MoreVertical size={20} />
                      </summary>
                      <div className="task-action-buttons">
                        {support ? (
                          <a
                            href={
                              workspacePath +
                              "?support=" +
                              encodeURIComponent(task.supportReference!)
                            }
                          >
                            View support request
                          </a>
                        ) : (
                          <>
                            <button
                              type="button"
                              aria-label="View task"
                              onClick={() => setViewingTask(task)}
                            >
                              View task
                            </button>
                            <button
                              type="button"
                              aria-label="Edit task"
                              onClick={() => onEditTask(task)}
                            >
                              Edit / assign task
                            </button>
                            <button
                              type="button"
                              aria-label="Delete task"
                              onClick={() => onDeleteTask(task.id)}
                            >
                              Delete task
                            </button>
                          </>
                        )}
                      </div>
                    </details>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <footer className="task-grid-footer">
          <span>
            Showing {(current - 1) * size + 1}–
            {Math.min(current * size, tasks.length)} of {tasks.length} tasks
            {totalCount !== tasks.length
              ? ` · ${totalCount} in this scope`
              : ""}
          </span>
          <div>
            <AppleButton
              size="sm"
              variant="secondary"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </AppleButton>
            <AppleButton
              size="sm"
              variant="secondary"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              Next
            </AppleButton>
          </div>
        </footer>
      </Card>
      {viewingTask && (
        <TaskDetails
          task={viewingTask}
          onClose={() => setViewingTask(null)}
          onEdit={onEditTask}
        />
      )}
    </div>
  );
};
