import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CommunicationsSettingsPage from "./CommunicationsSettingsPage";
import { communicationsApi } from "../services/api";
jest.mock("../services/api", () => ({
  communicationsApi: {
    getSettings: jest.fn(),
    saveMedicalEmailMasterSwitch: jest.fn(),
  },
}));
const view = () =>
  render(
    <MemoryRouter initialEntries={["/admin/communications-settings"]}>
      <CommunicationsSettingsPage />
    </MemoryRouter>,
  );
beforeEach(() => {
  jest.clearAllMocks();
  (communicationsApi.getSettings as jest.Mock).mockResolvedValue({
    data: { clientMedicalReviewEmailsEnabled: true },
  });
  (
    communicationsApi.saveMedicalEmailMasterSwitch as jest.Mock
  ).mockResolvedValue({ data: { clientMedicalReviewEmailsEnabled: false } });
});
it("shows saved state and the exact notification scope", async () => {
  view();
  await screen.findByText("Last confirmed setting: Enabled");
  expect(screen.getByRole("checkbox")).toBeChecked();
  expect(
    screen.getByRole("button", { name: "Save master switch" }),
  ).toBeDisabled();
  expect(
    screen.getByText(/Manual emails, booking reminders/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Other communications settings" }),
  ).toHaveAttribute("href", "/admin/communications?tab=settings");
});
it("requires explicit save using the narrow endpoint", async () => {
  view();
  await screen.findByText("Last confirmed setting: Enabled");
  fireEvent.click(screen.getByRole("checkbox"));
  expect(communicationsApi.saveMedicalEmailMasterSwitch).not.toHaveBeenCalled();
  expect(screen.getByText(/Unsaved change/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save master switch" }));
  await screen.findByText("Email master switch saved.");
  expect(communicationsApi.saveMedicalEmailMasterSwitch).toHaveBeenCalledWith(
    false,
  );
  expect(
    screen.getByText("Last confirmed setting: Disabled"),
  ).toBeInTheDocument();
});
it("keeps confirmed state and exposes a failed save", async () => {
  (
    communicationsApi.saveMedicalEmailMasterSwitch as jest.Mock
  ).mockRejectedValue(new Error("offline"));
  view();
  await screen.findByText("Last confirmed setting: Enabled");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Save master switch" }));
  await screen.findByRole("alert");
  expect(
    screen.getByText("Last confirmed setting: Enabled"),
  ).toBeInTheDocument();
  expect(
    screen.queryByText("Email master switch saved."),
  ).not.toBeInTheDocument();
});
it("disables edits on load failure and supports reload", async () => {
  (communicationsApi.getSettings as jest.Mock).mockRejectedValueOnce(
    new Error("offline"),
  );
  view();
  await screen.findByRole("alert");
  expect(screen.getByRole("checkbox")).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Reload current setting" }),
  );
  await screen.findByText("Last confirmed setting: Enabled");
  expect(screen.getByRole("checkbox")).toBeEnabled();
});
