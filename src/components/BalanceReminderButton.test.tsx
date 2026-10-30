import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BalanceReminderButton from "./BalanceReminderButton";
import { paymentsApi } from "../services/api";
import { authService } from "../services/authService";
jest.mock("../services/api", () => ({
  paymentsApi: {
    previewBalanceReminder: jest.fn(),
    sendBalanceReminder: jest.fn(),
  },
}));
jest.mock("../services/authService", () => ({
  authService: { getUser: jest.fn() },
}));
jest.mock("./EmailComposeModal", () => ({
  __esModule: true,
  default: (p: any) => (
    <div role="dialog">
      <h2>{p.title}</h2>
      {p.extraContent}
      <p>{p.initialValues.subject}</p>
      <button
        onClick={() =>
          p.onSendEmail({
            ...p.initialValues,
            bodyText: "Personal edited message",
          })
        }
      >
        Send reviewed draft
      </button>
      <button onClick={p.onClose}>Close composer</button>
    </div>
  ),
}));
const api = paymentsApi as jest.Mocked<typeof paymentsApi>;
const draft: any = {
  subject: "Overdue reminder",
  bodyText: "Balance 600 PLN",
  tone: "overdue",
  resolvedLanguage: "en",
  balanceSnapshot: "snapshot",
  templateId: "template",
  variables: { balanceReminder: { amountFormatted: "PLN 600.00" } },
};
beforeEach(() => {
  jest.clearAllMocks();
  (authService.getUser as jest.Mock).mockReturnValue({ role: "admin" });
  api.previewBalanceReminder.mockResolvedValue({ data: draft } as any);
  api.sendBalanceReminder.mockResolvedValue({
    data: { status: "sent" },
  } as any);
});
it("opens reviewed current balance without sending and dispatches edits with its snapshot", async () => {
  render(<BalanceReminderButton bookingId="a" clientName="Ada" />);
  fireEvent.click(
    screen.getByRole("button", { name: /Email client about balance/ }),
  );
  await screen.findByText("Overdue reminder");
  expect(api.previewBalanceReminder).toHaveBeenCalledWith("a", {
    tone: "auto",
  });
  expect(api.sendBalanceReminder).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Send reviewed draft" }));
  await waitFor(() =>
    expect(api.sendBalanceReminder).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({
        bodyText: "Personal edited message",
        balanceSnapshot: "snapshot",
        tone: "overdue",
        language: "en",
      }),
    ),
  );
});
it("changes tone/language through a newly prepared draft and can close without sending", async () => {
  render(<BalanceReminderButton bookingId="a" />);
  fireEvent.click(
    screen.getByRole("button", { name: /Email client about balance/ }),
  );
  await screen.findByText("Overdue reminder");
  fireEvent.change(screen.getByLabelText("Reminder wording"), {
    target: { value: "due" },
  });
  await waitFor(() =>
    expect(api.previewBalanceReminder).toHaveBeenLastCalledWith("a", {
      tone: "due",
    }),
  );
  await screen.findByText("Overdue reminder");
  fireEvent.change(screen.getByLabelText("Reminder language"), {
    target: { value: "pl" },
  });
  await waitFor(() =>
    expect(api.previewBalanceReminder).toHaveBeenLastCalledWith("a", {
      tone: "due",
      language: "pl",
    }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Close composer" }),
  );
  expect(api.sendBalanceReminder).not.toHaveBeenCalled();
});
it("retains a readable preparation error and retries without dispatching", async () => {
  api.previewBalanceReminder.mockRejectedValueOnce({
    response: { data: { message: "No unpaid balance." } },
  });
  render(<BalanceReminderButton bookingId="a" />);
  fireEvent.click(
    screen.getByRole("button", { name: /Email client about balance/ }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No unpaid balance",
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("Overdue reminder");
  expect(api.sendBalanceReminder).not.toHaveBeenCalled();
});
it("disables ineligible balances and hides the action for non-financial roles", () => {
  const view = render(
    <BalanceReminderButton bookingId="a" disabledReason="No unpaid balance." />,
  );
  expect(screen.getByRole("button")).toBeDisabled();
  (authService.getUser as jest.Mock).mockReturnValue({ role: "facilitator" });
  view.rerender(<BalanceReminderButton bookingId="a" />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(api.previewBalanceReminder).not.toHaveBeenCalled();
});
