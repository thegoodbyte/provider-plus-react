import { Link, useLocation } from "react-router-dom";
import ClientSupportInbox from "../../components/Tasks/ClientSupportInbox";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { BookingFlowItem } from "../../types";
import { bookingFlowApi } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Task, TaskFilters, taskService } from "../../services/taskService";
import { TaskList } from "../../components/Tasks/TaskList";
import { TaskForm } from "../../components/Tasks/TaskForm";
import { TaskFiltersPanel } from "../../components/Tasks/TaskFiltersPanel";
import TasksCalendarView from "../../components/Tasks/TasksCalendarView";
import { SprintBoard } from "../../components/Tasks/SprintBoard";
import AppleButton from "../../components/AppleButton";
import { Search } from "lucide-react";
import {
  matchesSearch,
  matchesView,
  taskContext,
  TaskContext,
  TaskView,
} from "../../components/Tasks/taskGrid";
import "./Tasks.css";

const TaskWorkspaceTabs = ({ support }: { support: boolean }) => {
  const { user } = useAuth();
  const location = useLocation();
  const prefix = ["admin", "user", "staff", "medical"].includes(
    location.pathname.split("/")[1],
  )
    ? "/" + location.pathname.split("/")[1]
    : "/admin";
  return (
    <nav className="task-workspace-tabs" aria-label="Task workspaces">
      <Link aria-current={!support ? "page" : undefined} to={prefix + "/tasks"}>
        Operational tasks
      </Link>
      {["admin", "user"].includes(user?.role || "") && (
        <Link
          aria-current={support ? "page" : undefined}
          to={prefix + "/tasks?support=all"}
        >
          IbogaReady tasks
        </Link>
      )}
    </nav>
  );
};
export const Tasks: React.FC = () => {
  const { user } = useAuth();
  const supportLocation = useLocation();
  const isSupport = new URLSearchParams(supportLocation.search).has("support");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deadlines, setDeadlines] = useState<BookingFlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "board" | "calendar">(
    "list",
  );
  const [activeContext, setActiveContext] = useState<TaskContext>("all");
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<TaskView>("open");
  const [originFilter, setOriginFilter] = useState<
    "all" | "custom" | "system" | "client"
  >("all");
  // PPVC-1047: who the list is scoped to, separate from the origin filter
  // above (provenance) -- this is about assignment. Admins need oversight
  // across everyone's tasks, so they default to "All"; every other staff
  // role (helper/facilitator/user, e.g. Kasia on customer care) defaults to
  // "Mine" since that's the view they actually need day to day.
  const [scopeFilter, setScopeFilter] = useState<"mine" | "all">(() =>
    user?.role === "admin" ? "all" : "mine",
  );
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | Task["category"]
  >("all");
  const [newTaskContext, setNewTaskContext] = useState<
    "client" | "booking" | "retreat" | "generic"
  >("client");
  const [newTaskSprint, setNewTaskSprint] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>({
    sortBy: "dueDate",
    sortOrder: "asc",
  });

  const requestVersion = useRef(0);
  const loadTasks = async () => {
    const version = ++requestVersion.current;
    try {
      setLoading(true);
      setError(null);
      // PPVC-1047: "Mine" sends mine=true to the server (resolved from the
      // caller's own JWT there, not a client-known user id); "All" omits it
      // entirely, which is the existing unfiltered-list behavior unchanged.
      const [tasksData, deadlinesResponse] = await Promise.all([
        taskService.getTasks({
          ...filters,
          mine: scopeFilter === "mine" ? true : undefined,
        }),
        bookingFlowApi
          .getItems({})
          .catch(() => ({ data: [] as BookingFlowItem[] })),
      ]);
      if (version !== requestVersion.current) return;
      setTasks(
        tasksData.filter((task) => task.sourceType !== "client_support"),
      );
      setDeadlines(deadlinesResponse.data || []);
    } catch (err) {
      if (version === requestVersion.current)
        setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSupport) void loadTasks();
    return () => {
      requestVersion.current += 1;
    };
  }, [filters, isSupport, scopeFilter]);

  const handleCreateTask = (
    context: Task["type"] = activeContext === "all" ? "client" : activeContext,
    sprint: string | null = null,
  ) => {
    setEditingTask(null);
    setNewTaskContext(context);
    setNewTaskSprint(sprint);
    setFormError(null);
    setShowForm(true);
  };

  const isSystemTask = (task: Task) =>
    Boolean(
      (task.sourceType &&
        !["manual", "client_support", "client_portal_request"].includes(
          task.sourceType,
        )) ||
        task.sourceId ||
        task.bookingFlowItemId,
    );
  const originTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (originFilter === "client")
          return ["client_support", "client_portal_request"].includes(
            task.sourceType || "",
          );
        if (
          ["client_support", "client_portal_request"].includes(
            task.sourceType || "",
          ) &&
          originFilter !== "all"
        )
          return false;
        if (originFilter === "system") return isSystemTask(task);
        if (originFilter === "custom") return !isSystemTask(task);
        return true;
      }),
    [tasks, originFilter],
  );

  const categoryTasks = useMemo(
    () =>
      originTasks.filter(
        (task) =>
          categoryFilter === "all" ||
          (task.category || "operations") === categoryFilter,
      ),
    [originTasks, categoryFilter],
  );
  const visibleTasks = useMemo(
    () =>
      categoryTasks.filter(
        (task) =>
          (activeContext === "all" || taskContext(task) === activeContext) &&
          matchesSearch(task, search),
      ),
    [categoryTasks, activeContext, search],
  );

  const statusCounts = Object.fromEntries(
    (["open", "overdue", "week", "done", "all"] as TaskView[]).map((view) => [
      view,
      visibleTasks.filter((task) => matchesView(task, view)).length,
    ]),
  );
  const gridTasks = useMemo(
    () => visibleTasks.filter((task) => matchesView(task, activeView)),
    [visibleTasks, activeView],
  );
  const contexts = [
    {
      id: "all" as const,
      label: "All",
      singular: "Client",
      hint: "All task types",
    },
    {
      id: "client" as const,
      label: "Clients",
      singular: "Client",
      hint: "People-specific follow-ups",
    },
    {
      id: "booking" as const,
      label: "Bookings",
      singular: "Booking",
      hint: "One booking or stay",
    },
    {
      id: "retreat" as const,
      label: "Retreats",
      singular: "Retreat",
      hint: "Whole-retreat operations",
    },
    {
      id: "generic" as const,
      label: "Generic",
      singular: "Generic",
      hint: "Everything else",
    },
  ];

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setFormError(null);
    setShowForm(true);
  };

  const handleFormSubmit = async (taskData: any) => {
    try {
      if (editingTask) {
        await taskService.updateTask(editingTask.id, taskData);
      } else {
        const tags = [
          ...(taskData.tags || []).filter(
            (tag: string) => !tag.startsWith("sprint:"),
          ),
        ];
        if (newTaskSprint && newTaskSprint !== "Backlog")
          tags.push(`sprint:${newTaskSprint}`);
        await taskService.createTask({ ...taskData, tags });
      }
      setShowForm(false);
      setEditingTask(null);
      setFormError(null);
      await loadTasks();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save task";
      setFormError(message);
      setError(message);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingTask(null);
    setFormError(null);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) {
      return;
    }

    try {
      await taskService.deleteTask(taskId);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await taskService.completeTask(taskId);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete task");
    }
  };

  const handleFiltersChange = (newFilters: TaskFilters) => {
    setFilters(newFilters);
  };

  if (isSupport)
    return (
      <>
        <TaskWorkspaceTabs support />
        <ClientSupportInbox />
      </>
    );

  if (loading) {
    return (
      <div className="tasks-page">
        <div className="loading">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="tasks-page">
      <div className="tasks-header">
        <div className="header-content">
          <div>
            <TaskWorkspaceTabs support={false} />
            <h1>Tasks</h1>
            {viewMode === "list" ? (
              <p className="tasks-subtitle">
                {statusCounts.open} open ·{" "}
                <span className="task-overdue-count">
                  {statusCounts.overdue} overdue
                </span>{" "}
                · {statusCounts.week} due this week
              </p>
            ) : (
              <p className="tasks-subtitle">
                One clear place for what needs your attention.
              </p>
            )}
          </div>
          <div className="task-header-actions">
            <div className="tasks-view-toggle" aria-label="Task view">
              <button
                type="button"
                className={viewMode === "list" ? "active" : ""}
                onClick={() => {
                  setSearch("");
                  setViewMode("list");
                }}
              >
                List
              </button>
              <button
                type="button"
                className={viewMode === "board" ? "active" : ""}
                onClick={() => {
                  setSearch("");
                  setViewMode("board");
                }}
              >
                Sprints
              </button>
              <button
                type="button"
                className={viewMode === "calendar" ? "active" : ""}
                onClick={() => {
                  setSearch("");
                  setViewMode("calendar");
                }}
              >
                Calendar
              </button>
            </div>
            <AppleButton onClick={() => handleCreateTask()}>
              + New task
            </AppleButton>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button type="button" onClick={() => void loadTasks()}>
            Retry loading tasks
          </button>
          <button onClick={() => setError(null)} className="error-close">
            ×
          </button>
        </div>
      )}

      {viewMode === "list" && (
        <label className="task-grid-search">
          <Search size={22} aria-hidden="true" />
          <span className="sr-only">Search tasks, clients, bookings or ID</span>
          <input
            type="search"
            data-re-unstyled=""
            placeholder="Search tasks, clients, bookings or #ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      )}
      <div className="task-grid-controls">
        {viewMode === "list" && (
          <div
            role="tablist"
            aria-label="Task status"
            className="task-status-tabs"
          >
            {(
              [
                ["open", "Open"],
                ["overdue", "Overdue"],
                ["week", "This week"],
                ["done", "Done"],
                ["all", "All"],
              ] as const
            ).map(([view, label]) => (
              <AppleButton
                key={view}
                role="tab"
                aria-selected={activeView === view}
                variant="ghost"
                className={activeView === view ? "active" : ""}
                onClick={() => setActiveView(view)}
              >
                {label} <span>{statusCounts[view]}</span>
              </AppleButton>
            ))}
          </div>
        )}
        {viewMode !== "board" && (
          <nav className="task-context-tabs" aria-label="Task context">
            <strong>Type</strong>
            {contexts.map((context) => (
              <AppleButton
                key={context.id}
                variant="secondary"
                className={activeContext === context.id ? "active" : ""}
                aria-pressed={activeContext === context.id}
                onClick={() => setActiveContext(context.id)}
              >
                {context.label}
              </AppleButton>
            ))}
          </nav>
        )}
      </div>
      <div className="task-utility-controls">
        <div className="task-scope-filter" aria-label="Task scope">
          {(["mine", "all"] as const).map((scope) => (
            <AppleButton
              key={scope}
              variant="ghost"
              className={scopeFilter === scope ? "active" : ""}
              onClick={() => setScopeFilter(scope)}
            >
              {scope === "mine" ? "My tasks" : "All tasks"}
            </AppleButton>
          ))}
        </div>
        <details className="task-extra-filters">
          <summary>More filters</summary>
          <div className="task-origin-bar">
            <div>
              <strong>Origin</strong>
              {(["all", "client", "custom", "system"] as const).map(
                (origin) => (
                  <AppleButton
                    key={origin}
                    variant="ghost"
                    className={originFilter === origin ? "active" : ""}
                    onClick={() => setOriginFilter(origin)}
                  >
                    {origin === "all"
                      ? "All origins"
                      : origin === "client"
                        ? "Client requests"
                        : origin === "custom"
                          ? "Staff-created"
                          : "System generated"}
                  </AppleButton>
                ),
              )}
            </div>
            <div className="task-category-filter">
              <label>
                Category{" "}
                <select
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(
                      event.target.value as typeof categoryFilter,
                    )
                  }
                >
                  {(
                    [
                      "all",
                      "medical",
                      "documents",
                      "financial",
                      "communication",
                      "operations",
                    ] as const
                  ).map((category) => (
                    <option key={category} value={category}>
                      {category === "all"
                        ? "All categories"
                        : category[0].toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <TaskFiltersPanel
              filters={filters}
              onFiltersChange={handleFiltersChange}
            />
          </div>
        </details>
      </div>

      <div className="tasks-main-content">
        {viewMode === "list" ? (
          <TaskList onTaskUpdated={loadTasks}
            workspacePath={supportLocation.pathname}
            tasks={gridTasks}
            totalCount={visibleTasks.length}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            onCompleteTask={handleCompleteTask}
          />
        ) : viewMode === "board" ? (
          <SprintBoard
            tasks={categoryTasks}
            onChanged={loadTasks}
            onEdit={handleEditTask}
            onCreate={handleCreateTask}
          />
        ) : (
          <TasksCalendarView tasks={visibleTasks} deadlines={deadlines} />
        )}
      </div>

      {showForm && (
        <TaskForm
          task={editingTask}
          initialType={newTaskContext}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          error={formError}
        />
      )}
    </div>
  );
};
