jest.mock('./EmailSafetySettings', () => () => null);
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AnnouncementsPage, { announcementTiming } from "./AnnouncementsPage";
import { announcementsApi, communicationsApi } from "../services/api";
jest.mock("../services/api", () => ({
  announcementsApi: {
    get: jest.fn(),
    sendTest: jest.fn(),
    setRuleActive: jest.fn(),
    save: jest.fn(),
    applyDefaults: jest.fn(),
    generate: jest.fn(),
    setEnabled: jest.fn(),
    preview: jest.fn(),
    updateDelivery: jest.fn(),
  },
  communicationsApi: {
    getTemplates: jest.fn(),
    getSentEmail: jest.fn(),
    getSentEmails: jest.fn(),
  },
}));
const template = {
  _id: "template",
  name: "Thank you for participating",
  language: "pl",
  subject: "Thank you",
  bodyText: "Hello {{client.firstName}}",
  attachmentAssetIds: ["pdf-1", "pdf-2", "pdf-3"],
};
const rule = {
  _id: "rule",
  title: template.name,
  days: 3,
  timing: "after_end",
  sendTime: "09:00",
  emailTemplateId: template,
  useRecipientLanguage: true,
  active: true,
  scheduledFor: "2026-10-10T07:00:00Z",
};
const data = {
  rules: [rule],
  settings: { enabled: false },
  deliveries: [],
  worker: null,
};
const mount = (retreatId?: string) =>
  render(
    <MemoryRouter>
      <AnnouncementsPage retreatId={retreatId} />
    </MemoryRouter>,
  );
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
beforeEach(() => {
  jest.clearAllMocks();
  (announcementsApi.get as jest.Mock).mockResolvedValue({ data });
  (communicationsApi.getTemplates as jest.Mock).mockResolvedValue({
    data: [template],
  });
  (announcementsApi.save as jest.Mock).mockResolvedValue({ data: rule });
});
it("walks through the post-retreat wizard and saves without sending or enabling automation", async () => {
  mount();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "+ Add announcement" }),
    ).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "+ Add announcement" }));
  fireEvent.change(screen.getByLabelText("Before or after"), {
    target: { value: "after_end" },
  });
  fireEvent.change(screen.getByLabelText("Number of days"), {
    target: { value: "7" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(screen.getByLabelText("Email template"), {
    target: { value: "template" },
  });
  expect(
    screen.getByLabelText("Use each recipient’s preferred language"),
  ).toBeChecked();
  expect(
    screen.getByText("Template preview · 3 attachments"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(
    screen.getByText(/7 days after the retreat ends at 09:00/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save announcement" }));
  await waitFor(() =>
    expect(announcementsApi.save).toHaveBeenCalledWith(
      undefined,
      undefined,
      expect.objectContaining({
        timing: "after_end",
        days: 7,
        useRecipientLanguage: true,
        emailTemplateId: "template",
      }),
    ),
  );
  expect(announcementsApi.setEnabled).not.toHaveBeenCalled();
});
it("edits one retreat and supports forcing the selected template language", async () => {
  mount("retreat");
  fireEvent.click(
    await screen.findByRole("button", { name: "Edit announcement" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(
    screen.getByLabelText("Use each recipient’s preferred language"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Save announcement" }));
  await waitFor(() =>
    expect(announcementsApi.save).toHaveBeenCalledWith(
      "retreat",
      "rule",
      expect.objectContaining({ useRecipientLanguage: false }),
    ),
  );
});
it("shows the actual date even before any recipients exist", async () => {
  mount("retreat");
  expect(await screen.findByText(/Send date: 10 Oct 2026/)).toBeInTheDocument();
  expect(screen.getByText(/Cron not enabled yet/)).toBeInTheDocument();
});
it("shows failures and safe retry controls, with no automatic retry for uncertain delivery", async () => {
  (announcementsApi.get as jest.Mock).mockResolvedValue({
    data: {
      ...data,
      deliveries: [
        {
          _id: "failed",
          ruleId: "rule",
          title: "Missing translation",
          status: "failed",
          scheduledFor: rule.scheduledFor,
          lastError: "Missing CZ translation",
          history: [],
        },
        {
          _id: "uncertain",
          ruleId: "rule",
          title: "Interrupted",
          status: "uncertain",
          scheduledFor: rule.scheduledFor,
          history: [],
        },
      ],
    },
  });
  mount("retreat");
  fireEvent.click(
    await screen.findByRole("button", { name: "Needs attention (2)" }),
  );
  expect(screen.getByText("Missing CZ translation")).toBeInTheDocument();
  expect(
    screen.getAllByRole("button", { name: "Retry delivery" }),
  ).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Retry delivery" }));
  await waitFor(() =>
    expect(announcementsApi.updateDelivery).toHaveBeenCalledWith(
      "failed",
      "retry",
    ),
  );
});
it("shows load failures instead of claiming there are no announcements", async () => {
  (announcementsApi.get as jest.Mock).mockRejectedValue(new Error("offline"));
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not load announcements",
  );
  expect(
    screen.queryByText("Your timeline starts here"),
  ).not.toBeInTheDocument();
});
it.each([
  ["before_start", "Arrival day"],
  ["after_end", "Departure day"],
])("uses plain language for day zero: %s", (timing, expected) => {
  expect(announcementTiming({ days: 0, timing: timing as any })).toBe(expected);
});

it('sends an explicit announcement test using the selected participant, without enabling the retreat', async () => {
  (announcementsApi.get as jest.Mock).mockResolvedValue({ data: { ...data, testRecipients: [{ bookingId: 'booking', name: 'Anna', language: 'pl' }] } });
  (announcementsApi.sendTest as jest.Mock).mockResolvedValue({ data: { status: 'sent', recipient: ['info@ibogaspirit.cz'] } });
  mount('retreat');
  fireEvent.change(await screen.findByLabelText('Sample participant'), { target: { value: 'booking' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send test to safety inbox' }));
  await waitFor(() => expect(announcementsApi.sendTest).toHaveBeenCalledWith('rule', 'booking'));
  expect(await screen.findByText(/Test email sent to info@ibogaspirit.cz/)).toBeInTheDocument();
  expect(announcementsApi.setEnabled).not.toHaveBeenCalled();
});
