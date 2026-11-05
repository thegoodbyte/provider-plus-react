import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StaffAccessEditor from "./StaffAccessEditor";
import { api } from "../services/api";
jest.mock("../services/api", () => ({ api: { put: jest.fn() } }));
beforeEach(() => {
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => "11111111-1111-4111-8111-111111111111",
  });
  jest.clearAllMocks();
  (api.put as jest.Mock).mockResolvedValue({ data: {} });
});
test("grant selection includes required read; revocation and actor-sensitive revision are sent without touching user role", async () => {
  const done = jest.fn();
  render(
    <StaffAccessEditor
      user={{
        _id: "worker",
        email: "worker@example.invalid",
        role: "staff",
        staffAccessRevision: 3,
      }}
      onClose={jest.fn()}
      onSaved={done}
    />,
  );
  fireEvent.click(screen.getByLabelText("Match and allocate receipts"));
  expect(screen.getByLabelText("View financial records")).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Save work access" }));
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith(
      "/staff-access/users/worker",
      expect.objectContaining({
        profiles: ["payments"],
        capabilities: ["finance.read", "finance.reconcile"],
        revision: 3,
        requestKey: expect.any(String),
      }),
    ),
  );
  expect(done).toHaveBeenCalled();
});
test("failed grant remains open and retries the same idempotency key", async () => {
  (api.put as jest.Mock)
    .mockRejectedValueOnce(Error("Offline"))
    .mockResolvedValue({ data: {} });
  const close = jest.fn();
  render(
    <StaffAccessEditor
      user={{
        _id: "worker",
        email: "worker@example.invalid",
        staffProfiles: ["payments"],
        staffCapabilities: ["finance.read"],
        staffAccessRevision: 1,
      }}
      onClose={close}
      onSaved={jest.fn()}
    />,
  );
  fireEvent.click(screen.getByLabelText("View financial records"));
  fireEvent.click(screen.getByRole("button", { name: "Save work access" }));
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save work access" }));
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect((api.put as jest.Mock).mock.calls[1][1]).toEqual(
    (api.put as jest.Mock).mock.calls[0][1],
  );
  expect((api.put as jest.Mock).mock.calls[1][1].profiles).toEqual([]);
});
