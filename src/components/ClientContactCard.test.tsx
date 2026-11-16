import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import ClientContactCard from "./ClientContactCard";
import { clientsApi } from "../services/api";
jest.mock("../services/api", () => ({
  clientsApi: { contactCard: jest.fn() },
}));
const api = clientsApi.contactCard as jest.Mock;
const card = (name = "ISCZ-1233 | Adam Smith | AD | R:17.11.26") => ({
  displayName: name,
  filename: "ISCZ-1233.vcf",
  phone: "+48881745713",
  email: "adam@example.test",
  notes: "Original name: Adam Smith\nFirst contact: 23.03.26",
  warnings: [],
  vcard: "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:" + name + "\r\nEND:VCARD\r\n",
});
beforeEach(() => {
  jest.clearAllMocks();
  api.mockResolvedValue({ data: card() });
  let n = 0;
  URL.createObjectURL = jest.fn(() => `blob:card-${++n}`);
  URL.revokeObjectURL = jest.fn();
});
it("prepares on demand and offers the previewed VCF with original notes", async () => {
  const { unmount } = render(<ClientContactCard clientId="a" />);
  expect(api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Contact card (.vcf)" }));
  await screen.findByText(card().displayName);
  expect(api).toHaveBeenCalledWith("a", "compact");
  const link = await screen.findByRole("link", { name: "Download vCard" });
  expect(link).toHaveAttribute("download", "ISCZ-1233.vcf");
  expect(link).toHaveAttribute("href", "blob:card-1");
  fireEvent.click(screen.getByText("Contact notes"));
  await waitFor(() => expect(screen.getByText(/Original name: Adam Smith/)).toBeVisible());
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:card-1");
});
it("removes the old download during a format change and uses the new response", async () => {
  render(<ClientContactCard clientId="a" />);
  fireEvent.click(screen.getByRole("button", { name: "Contact card (.vcf)" }));
  await screen.findByRole("link", { name: "Download vCard" });
  let finish!: (v: any) => void;
  api.mockImplementationOnce(
    () => new Promise((resolve) => (finish = resolve)),
  );
  fireEvent.change(screen.getByLabelText("Contact name format"), {
    target: { value: "complete" },
  });
  expect(
    screen.queryByRole("link", { name: "Download vCard" }),
  ).not.toBeInTheDocument();
  await act(async () => finish({ data: card("Complete reviewed contact") }));
  await screen.findByText("Complete reviewed contact");
  expect(api).toHaveBeenLastCalledWith("a", "complete");
  expect(
    await screen.findByRole("link", { name: "Download vCard" }),
  ).toHaveAttribute("href", "blob:card-2");
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:card-1");
});
it("shows no download on failure and retries without changing the client", async () => {
  api.mockRejectedValueOnce(new Error("offline"));
  render(<ClientContactCard clientId="a" />);
  fireEvent.click(screen.getByRole("button", { name: "Contact card (.vcf)" }));
  await screen.findByRole("alert");
  expect(
    screen.queryByRole("link", { name: "Download vCard" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry contact card" }));
  await screen.findByRole("link", { name: "Download vCard" });
  expect(api).toHaveBeenLastCalledWith("a", "compact");
});
it("ignores late sibling responses and rejects invalid export payloads", async () => {
  let finish!: (v: any) => void;
  api.mockImplementationOnce(
    () => new Promise((resolve) => (finish = resolve)),
  );
  const view = render(<ClientContactCard clientId="a" />);
  fireEvent.click(screen.getByRole("button", { name: "Contact card (.vcf)" }));
  view.rerender(<ClientContactCard clientId="b" />);
  await screen.findByRole("link", { name: "Download vCard" });
  await act(async () => finish({ data: card("Wrong sibling") }));
  expect(screen.queryByText("Wrong sibling")).not.toBeInTheDocument();
  api.mockResolvedValueOnce({ data: { vcard: "HTML error" } });
  fireEvent.change(screen.getByLabelText("Contact name format"), {
    target: { value: "brackets" },
  });
  await screen.findByRole("alert");
  expect(
    screen.queryByRole("link", { name: "Download vCard" }),
  ).not.toBeInTheDocument();
});
