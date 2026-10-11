import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RetreatCloseout from "./RetreatCloseout";
import { retreatCloseoutApi } from "../services/api";
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }));
jest.mock("../services/api", () => ({
  retreatCloseoutApi: { get: jest.fn(), save: jest.fn() },
}));
jest.mock("../services/authService", () => ({
  authService: { getUser: () => ({ role: "admin" }) },
}));
const step = {
  key: "thanks",
  section: "People",
  title: "Send a thank-you email",
  prompt: "Record recipients",
  tool: "communications",
  notes: "",
  owner: "",
  dueDate: "",
  completed: false,
  revision: 0,
};
beforeEach(() => {
  jest.clearAllMocks();
  (global as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest
      .fn()
      .mockImplementation(() => ({
        matches: false,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
  });
  (retreatCloseoutApi.get as jest.Mock).mockResolvedValue({
    data: [
      step,
      {
        ...step,
        key: "expenses",
        section: "Money",
        title: "Reconcile expenses",
        tool: "expenses",
      },
    ],
  });
  (retreatCloseoutApi.save as jest.Mock).mockImplementation(
    async (_id, draft) => ({
      data: { ...draft, revision: draft.revision + 1 },
    }),
  );
});
it("saves notes and completion and updates progress only after save", async () => {
  render(<RetreatCloseout retreatId="retreat1" onOpenTab={jest.fn()} />);
  await screen.findByText("Send a thank-you email");
  fireEvent.change(
    screen.getAllByLabelText("Notes and completion evidence")[0],
    { target: { value: "Sent to all confirmed attendees" } },
  );
  fireEvent.click(screen.getAllByLabelText("Completed")[0]);
  expect(screen.getByText("0 of 2 steps complete")).toBeInTheDocument();
  fireEvent.click(screen.getAllByText("Save step")[0]);
  await screen.findByText("1 of 2 steps complete");
  expect(retreatCloseoutApi.save).toHaveBeenCalledWith(
    "retreat1",
    expect.objectContaining({
      key: "thanks",
      notes: "Sent to all confirmed attendees",
      completed: true,
      revision: 0,
    }),
  );
});
it("keeps the draft after a failed save", async () => {
  (retreatCloseoutApi.save as jest.Mock).mockRejectedValue({
    response: { data: { message: "This step changed. Reload before saving." } },
  });
  render(<RetreatCloseout retreatId="retreat1" onOpenTab={jest.fn()} />);
  await screen.findByText("Send a thank-you email");
  fireEvent.change(screen.getAllByLabelText("Owner")[0], {
    target: { value: "Martin" },
  });
  fireEvent.click(screen.getAllByText("Save step")[0]);
  await screen.findByText("This step changed. Reload before saving.");
  expect(screen.getAllByLabelText("Owner")[0]).toHaveValue("Martin");
  expect(screen.getByText("0 of 2 steps complete")).toBeInTheDocument();
});
it("focuses on the next incomplete step and opens retreat-scoped compose", async () => {
  render(<RetreatCloseout retreatId="retreat1" onOpenTab={jest.fn()} />);
  await screen.findByText("Send a thank-you email");
  fireEvent.click(screen.getByLabelText("Show only the next step"));
  expect(screen.queryByText("Reconcile expenses")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Open communications"));
  expect(mockNavigate).toHaveBeenCalledWith(
    "/admin/communications?tab=compose&retreatId=retreat1",
  );
  expect(retreatCloseoutApi.save).not.toHaveBeenCalled();
});
it("does not hide an unsaved draft when focus is toggled", async () => {
  render(<RetreatCloseout retreatId="retreat1" onOpenTab={jest.fn()} />);
  await screen.findByText("Send a thank-you email");
  fireEvent.change(screen.getAllByLabelText("Owner")[1], {
    target: { value: "Helper" },
  });
  fireEvent.click(screen.getByLabelText("Show only the next step"));
  expect(screen.getByText("Reconcile expenses")).toBeInTheDocument();
  expect(screen.getAllByLabelText("Owner")[1]).toHaveValue("Helper");
});
it("shows loading failure without presenting an empty completed checklist", async () => {
  (retreatCloseoutApi.get as jest.Mock).mockRejectedValue(new Error("offline"));
  render(<RetreatCloseout retreatId="retreat1" onOpenTab={jest.fn()} />);
  await screen.findByText(
    "Unable to load the closeout checklist. Reopen this tab to try again.",
  );
  expect(
    screen.queryByText("All closeout steps are complete."),
  ).not.toBeInTheDocument();
});
