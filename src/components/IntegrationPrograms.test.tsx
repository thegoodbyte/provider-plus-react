import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import IntegrationPrograms from "./IntegrationPrograms";
import { integrationProgramsApi as api } from "../services/integrationProgramsApi";

jest.mock("../services/integrationProgramsApi", () => ({
  integrationProgramsApi: Object.fromEntries(
    [
      "list",
      "save",
      "publish",
      "archive",
      "setDefault",
      "enrollments",
      "preview",
      "enroll",
    ].map((key) => [key, jest.fn()]),
  ),
}));
const config = {
  timezone: "Europe/Prague",
  owner: "Indy",
  backup: "Backup",
  bookingUrl: "https://calendly.com/ibogaspirit/support",
  groupCalls: [
    {
      key: "group-1",
      title: "Group call 1",
      targetDay: 7,
      earliestDay: 5,
      latestDay: 10,
      durationMinutes: 75,
    },
    {
      key: "group-2",
      title: "Group call 2",
      targetDay: 21,
      earliestDay: 21,
      latestDay: 28,
      durationMinutes: 75,
    },
    {
      key: "group-3",
      title: "Group call 3",
      targetDay: 56,
      earliestDay: 42,
      latestDay: 56,
      durationMinutes: 75,
    },
  ],
  personal: {
    count: 3,
    durationMinutes: 30,
    accessDays: 84,
    cancellationPolicy: "restore",
    noShowPolicy: "restore",
    extensionPolicy: "staff_approval",
    maximumExtensionDays: 28,
  },
  emails: [{ key: "welcome", title: "Welcome home", day: 1 }],
  channels: ["email", "app"],
  dailyContactCap: 1,
  quietStart: "21:00",
  quietEnd: "09:00",
  review: {
    contentReference: "reviewed-v1",
    contentReviewed: true,
    capacityReviewed: true,
  },
};
const program = {
  _id: "program-1",
  name: "Homecoming",
  revision: 2,
  archived: false,
  draft: config,
  versions: [
    { number: 1, name: "Homecoming", config, publishedAt: "2026-10-11" },
  ],
};
const enrollment = {
  _id: "enrollment-1",
  bookingId: "booking-1",
  clientId: { firstName: "Local", lastName: "Test" },
  programId: "program-1",
  programVersion: 1,
  revision: 1,
  homecomingDate: "2026-10-10",
  status: "active",
  snapshot: config,
};
const preview = {
  previewHash: "fresh-preview",
  schedule: {
    groupCalls: [
      {
        key: "group-1",
        title: "Group call 1",
        targetDate: "2026-10-24",
        earliestDate: "2026-10-22",
        latestDate: "2026-10-27",
        planningState: "suggested",
        pastWindow: false,
      },
    ],
    emails: [
      {
        key: "welcome",
        title: "Welcome home",
        date: "2026-10-18",
        state: "skip_past",
      },
    ],
    personalExpiresOn: "2027-01-09",
  },
  beforeSchedule: {
    groupCalls: [{ key: "group-1", targetDate: "2026-10-17" }],
  },
  warnings: ["Existing appointments and answers remain unchanged."],
};
const mock = (fn: any) => fn as jest.Mock;
beforeEach(() => {
  mock(api.list).mockResolvedValue({
    data: {
      programs: [program],
      defaults: [{ _id: "regular", programId: "program-1" }],
      starter: config,
    },
  });
  mock(api.enrollments).mockResolvedValue({
    data: {
      enrollments: [enrollment],
      bookings: [
        {
          id: "booking-1",
          name: "Local Test",
          retreatName: "Retreat",
          suggestedHomecomingDate: "2026-10-17",
          defaultProgramId: "program-1",
        },
      ],
    },
  });
  mock(api.save).mockResolvedValue({ data: { ...program, revision: 3 } });
  mock(api.preview).mockResolvedValue({ data: preview });
  mock(api.enroll).mockResolvedValue({ data: enrollment });
});
async function editor() {
  render(<IntegrationPrograms />);
  await screen.findByRole("option", { name: /Homecoming.*published versions/ });
  fireEvent.change(screen.getByLabelText("Choose program"), {
    target: { value: "program-1" },
  });
}
async function clientEditor() {
  render(<IntegrationPrograms />);
  await screen.findByRole("option", { name: /Homecoming.*published versions/ });
  fireEvent.click(screen.getByRole("button", { name: "Client enrollments" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit enrollment" }));
}
it("adds a fourth call to the draft and requires capacity reapproval before publication", async () => {
  await editor();
  fireEvent.click(screen.getByRole("button", { name: "Add group call" }));
  expect(screen.getByLabelText("Group call 4 targetDay")).toHaveValue(84);
  expect(
    screen.getByLabelText("Owner and backup can deliver this plan"),
  ).not.toBeChecked();
  expect(
    screen.getByRole("button", { name: "Publish saved draft" }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByLabelText("Owner and backup can deliver this plan"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(api.save).toHaveBeenCalled());
  expect(mock(api.save).mock.calls[0][1].config.groupCalls).toHaveLength(4);
  expect(program.versions[0].config.groupCalls).toHaveLength(3);
  expect(api.enroll).not.toHaveBeenCalled();
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Enrolled clients retain",
  );
});
it("previews moved homecoming windows and invalidates consent on another edit", async () => {
  await clientEditor();
  fireEvent.change(screen.getByLabelText("Homecoming date"), {
    target: { value: "2026-10-17" },
  });
  expect(
    screen.getByRole("button", { name: "Apply previewed plan" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Preview plan" }));
  const region = await screen.findByRole("region", {
    name: "Enrollment preview",
  });
  expect(within(region).getByText("2026-10-17")).toBeInTheDocument();
  expect(within(region).getByText("2026-10-24")).toBeInTheDocument();
  expect(within(region).getByText(/Skipped \(past date\)/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Homecoming date"), {
    target: { value: "2026-10-18" },
  });
  expect(
    screen.queryByRole("region", { name: "Enrollment preview" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Apply previewed plan" }),
  ).toBeDisabled();
  expect(api.enroll).not.toHaveBeenCalled();
});
it("applies only the previewed snapshot with its expected revision", async () => {
  await clientEditor();
  fireEvent.change(screen.getByLabelText("Homecoming date"), {
    target: { value: "2026-10-17" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Preview plan" }));
  await screen.findByRole("region", { name: "Enrollment preview" });
  fireEvent.click(screen.getByRole("button", { name: "Apply previewed plan" }));
  await waitFor(() =>
    expect(api.enroll).toHaveBeenCalledWith(
      "enrollment-1",
      expect.objectContaining({
        expectedRevision: 1,
        previewHash: "fresh-preview",
        homecomingDate: "2026-10-17",
        programVersion: 1,
      }),
    ),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "No messages or invitations were sent",
  );
});
it("keeps staff changes available after a conflict and displays the error", async () => {
  await clientEditor();
  mock(api.preview).mockRejectedValue({
    response: {
      data: { message: "This enrollment changed. Reload before saving." },
    },
  });
  fireEvent.change(screen.getByLabelText("Homecoming date"), {
    target: { value: "2026-10-17" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Preview plan" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Reload before saving",
  );
  expect(screen.getByLabelText("Homecoming date")).toHaveValue("2026-10-17");
  expect(
    screen.getByRole("button", { name: "Apply previewed plan" }),
  ).toBeDisabled();
});
it("honors retreat-type defaults when selecting a new client", async () => {
  mock(api.enrollments).mockResolvedValue({
    data: {
      enrollments: [],
      bookings: [
        {
          id: "booking-1",
          name: "Local Test",
          retreatName: "Retreat",
          suggestedHomecomingDate: "2026-10-17",
          defaultProgramId: "program-1",
        },
      ],
    },
  });
  render(<IntegrationPrograms />);
  await screen.findByRole("option", { name: /Homecoming.*published versions/ });
  fireEvent.click(screen.getByRole("button", { name: "Client enrollments" }));
  fireEvent.click(screen.getByRole("button", { name: "Enroll client" }));
  fireEvent.change(screen.getByLabelText("Client and retreat"), {
    target: { value: "booking-1" },
  });
  expect(screen.getByLabelText("Homecoming date")).toHaveValue("2026-10-17");
  expect(screen.getByLabelText("Published program")).toHaveValue("program-1");
  expect(api.enroll).not.toHaveBeenCalled();
});
