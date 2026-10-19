import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import WorkModePage from "./WorkModePage";
import { workApi } from "./WorkModeContext";
jest.mock("./WorkModeContext", () => ({
  workApi: { get: jest.fn(), post: jest.fn() },
  workError: () => "Save failed; draft kept",
  useWorkMode: () => ({
    refresh: jest.fn(),
    enter: jest.fn(),
    data: { sessions: [] },
  }),
}));
const step = {
  key: "A",
  label: "Artifacts",
  help: "Inspect source",
  remaining: 1,
};
const source = {
  key: "artifact:a",
  sourceId: "a",
  step: "A",
  label: "Artifact #1",
  state: "actionable",
  version: "v1",
  route: "/admin/medical-artifacts/a",
};
const session = {
  _id: "session",
  status: "active",
  revision: 1,
  total: 1,
  step: "A",
  currentKey: source.key,
  current: { key: source.key, source },
  items: [],
  counts: {
    pending: 1,
    reviewed: 0,
    skipped: 0,
    blocked: 0,
    waiting: 0,
    external: 0,
  },
  steps: [step],
  newArrivals: [],
  waitingSources: [],
  blockedSources: [],
};
const renderPage = (path = "/admin/work-modes/sessions/session") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/work-modes" element={<WorkModePage />} />
        <Route
          path="/admin/work-modes/sessions/:sessionId"
          element={<WorkModePage />}
        />
      </Routes>
    </MemoryRouter>,
  );
beforeEach(() => {
  jest.resetAllMocks();
  Object.defineProperty(global.crypto, "randomUUID", {
    configurable: true,
    value: () => "00000000-0000-4000-8000-000000000000",
  });
});
it("keeps source context and draft after a failed outcome; retry uses the same source/version", async () => {
  (workApi.get as jest.Mock).mockResolvedValue(session);
  (workApi.post as jest.Mock).mockImplementation((path: string) =>
    path.endsWith("/reconcile")
      ? Promise.resolve(session)
      : Promise.reject(new Error("offline")),
  );
  renderPage();
  fireEvent.click(
    await screen.findByText("Operational review, skip or block this item"),
  );
  const note = await screen.findByLabelText(
    "Short operational note (no medical details)",
  );
  fireEvent.change(note, {
    target: { value: "Checked the existing workflow" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save review outcome and advance" }),
  );
  await screen.findByRole("alert");
  expect(note).toHaveValue("Checked the existing workflow");
  expect(screen.getByText("Current item · Artifact #1")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Open source editor" }),
  ).toHaveAttribute(
    "href",
    "/admin/medical-artifacts/a?returnTo=%2Fadmin%2Fwork-modes%2Fsessions%2Fsession",
  );
  (workApi.post as jest.Mock).mockResolvedValue({
    ...session,
    current: null,
    currentKey: null,
    counts: { ...session.counts, pending: 0, reviewed: 1 },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save review outcome and advance" }),
  );
  await screen.findByText("No actionable items remain in step A");
  const calls = (workApi.post as jest.Mock).mock.calls.filter(([p]: [string]) =>
    p.endsWith("/outcomes"),
  );
  expect(calls).toHaveLength(2);
  expect(calls[0][1]).toEqual(calls[1][1]);
});
it("keeps arrivals outside a fixed cohort until selected and added", async () => {
  const value = {
    ...session,
    newArrivals: [{ ...source, key: "artifact:b", label: "Artifact #2" }],
  };
  (workApi.get as jest.Mock).mockResolvedValue(value);
  (workApi.post as jest.Mock).mockResolvedValue(value);
  renderPage();
  await screen.findByText("New arrivals · 1");
  expect(
    screen.getByRole("button", { name: "Add selected arrivals (0)" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "A · Artifact #2" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Add selected arrivals (1)" }),
  );
  await waitFor(() =>
    expect(workApi.post).toHaveBeenCalledWith("/sessions/session/control", {
      revision: 1,
      action: "add",
      keys: ["artifact:b"],
    }),
  );
});
it("shows waiting-only queues without allowing an empty batch", async () => {
  (workApi.get as jest.Mock).mockResolvedValue({
    steps: [step],
    items: [{ ...source, state: "waiting" }],
  });
  renderPage("/admin/work-modes");
  await screen.findByText("Current queues");
  expect(
    screen.getByRole("button", { name: "Start all actionable" }),
  ).toBeDisabled();
  expect(screen.getAllByText("Not available yet")).toHaveLength(2);
});

it('keeps completed medical actions linked to their saved source for follow-up', async () => {
  const value = {...session, current:null, items:[{key:source.key,domainAction:'reply',source}]};
  (workApi.get as jest.Mock).mockResolvedValue(value);(workApi.post as jest.Mock).mockResolvedValue(value);
  renderPage();await screen.findByRole('heading',{name:'Saved medical actions'});
  expect(screen.getByRole('link',{name:'Open saved source'})).toHaveAttribute('href', '/admin/medical-artifacts/a?returnTo=%2Fadmin%2Fwork-modes%2Fsessions%2Fsession');
});
