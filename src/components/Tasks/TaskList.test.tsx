import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Task } from "../../services/taskService";
import { TaskList } from "./TaskList";
const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "one",
  name: "Upload EKG",
  description: "Tonight",
  type: "client",
  urgency: "high",
  status: "pending",
  dueDate: "2020-01-02",
  tags: [],
  createdAt: "2026-08-29",
  updatedAt: "2026-08-29",
  ...overrides,
});
const callbacks = () => ({
  onEditTask: jest.fn(),
  onDeleteTask: jest.fn(),
  onCompleteTask: jest.fn(),
});
const names = () =>
  Array.from(document.querySelectorAll(".task-row .task-title")).map(
    (x) => x.textContent,
  );
describe("searchable Tasks table", () => {
  it("renders a useful empty state", () => {
    render(<TaskList tasks={[]} {...callbacks()} />);
    expect(
      screen.getByText(
        "No tasks found. Create your first task to get started!",
      ),
    ).toBeInTheDocument();
  });
  it("separates exact client ID from task and booking IDs, links current workspace and retains readable context", () => {
    render(
      <TaskList
        workspacePath="/user/tasks"
        tasks={[
          makeTask({
            taskNumber: 968,
            clientId: {
              _id: "client-ewa",
              firstName: "Ewa",
              lastName: "Synthetic",
              email: "",
              display_id: 1333,
            },
            bookingId: { bookingNumber: 1267 },
            sourceType: "manual",
            assignedToUserId: { firstName: "Kasia", lastName: "Nowak" },
          }),
        ]}
        {...callbacks()}
      />,
    );
    expect(
      screen.getByRole("columnheader", { name: /Client ID/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Task #968")).toBeInTheDocument();
    expect(screen.getByText("Booking #1267")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Client Ewa Synthetic #1333" }),
    ).toHaveAttribute("href", "/user/clients/client-ewa");
    expect(screen.getByText("Kasia Nowak")).toBeInTheDocument();
    expect(screen.getByText("KN")).toBeInTheDocument();
    expect(screen.queryByText("Auto")).not.toBeInTheDocument();
  });
  it("does not invent client or booking numbers from bare Mongo IDs and handles legacy names", () => {
    render(
      <TaskList
        tasks={[
          makeTask({
            clientId: "507f1f77bcf86cd799439011",
            bookingId: "507f1f77bcf86cd799439012",
          }),
          makeTask({
            id: "legacy",
            name: "Legacy task",
            clientId: {
              _id: "actual",
              firstName: "",
              lastName: "",
              fname: "Legacy",
              lname: "Person",
              displayId: 88,
            } as any,
          }),
        ]}
        {...callbacks()}
      />,
    );
    expect(screen.queryByText(/43901/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Client Legacy Person #88" }),
    ).toHaveAttribute("href", "/admin/clients/actual");
    expect(screen.getAllByText("Unassigned")).toHaveLength(2);
  });
  it.each([
    ["Task", "name"],
    ["Client ID", "client"],
    ["Type", "type"],
    ["Priority", "urgency"],
    ["Due", "due"],
    ["Assignee", "assignee"],
  ])("sorts %s with an accessible direction", (header) => {
    const a = makeTask({
        name: "Alpha",
        clientId: { firstName: "A", lastName: "", email: "", display_id: 1001 },
        type: "client",
        urgency: "low",
        dueDate: "2026-09-01",
        assignedToUserId: { firstName: "A" },
      }),
      b = makeTask({
        id: "two",
        name: "Beta",
        clientId: { firstName: "B", lastName: "", email: "", display_id: 1002 },
        type: "booking",
        urgency: "high",
        dueDate: "2026-09-10",
        assignedToUserId: { firstName: "B" },
      });
    render(<TaskList tasks={[b, a]} {...callbacks()} />);
    const button = screen.getByRole("button", { name: header, exact: true });
    fireEvent.click(button);
    const first = names();
    fireEvent.click(button);
    expect(names()).toEqual([...first].reverse());
    expect(button.closest("th")).toHaveAttribute("aria-sort");
  });
  it("runs only supported mutations and preserves view/details focus behavior", () => {
    const task = makeTask({ taskNumber: 968 }),
      actions = callbacks();
    render(<TaskList tasks={[task]} {...actions} />);
    fireEvent.click(screen.getByLabelText("Mark task as complete"));
    expect(actions.onCompleteTask).toHaveBeenCalledWith("one");
    const title = screen.getByRole("button", { name: "Upload EKG" });
    title.focus();
    fireEvent.click(title);
    expect(screen.getByRole("dialog")).toHaveTextContent("Tonight");
    fireEvent.click(screen.getByLabelText("Close task details"));
    expect(title).toHaveFocus();
    const summary = screen.getByLabelText("Actions for Upload EKG");
    fireEvent.click(summary);
    fireEvent.click(screen.getByLabelText("Edit task"));
    expect(actions.onEditTask).toHaveBeenCalledWith(task);
    fireEvent.click(screen.getByLabelText("Delete task"));
    expect(actions.onDeleteTask).toHaveBeenCalledWith("one");
  });
  it("never completes cancelled/completed or specialist support cases", () => {
    render(
      <TaskList
        tasks={[
          makeTask({ status: "completed" }),
          makeTask({ id: "cancelled", name: "Cancelled", status: "cancelled" }),
          makeTask({
            id: "support",
            name: "Request",
            supportReference: "SUP-1001",
          }),
        ]}
        {...callbacks()}
      />,
    );
    expect(screen.getByLabelText("Task completed")).toBeChecked();
    expect(screen.getByLabelText("Task cancelled")).toBeDisabled();
    expect(screen.getByLabelText("Mark task as complete")).toBeDisabled();
    expect(
      within(screen.getByText("SUP-1001 · Request").closest("tr")!).queryByRole(
        "button",
        { name: "Edit task" },
      ),
    ).not.toBeInTheDocument();
  });
  it("paginates real tasks and changes sorting without losing any record", () => {
    render(
      <TaskList
        tasks={Array.from({ length: 17 }, (_, i) =>
          makeTask({ id: String(i), name: `Task ${i}` }),
        )}
        {...callbacks()}
      />,
    );
    expect(document.querySelectorAll(".task-row")).toHaveLength(15);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(document.querySelectorAll(".task-row")).toHaveLength(2);
    expect(screen.getByText("Showing 16–17 of 17 tasks")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(document.querySelectorAll(".task-row")).toHaveLength(15);
  });
});
