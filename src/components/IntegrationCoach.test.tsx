import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import IntegrationCoach from "./IntegrationCoach";
import { api } from "../services/api";
jest.mock("../services/api", () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "named-staff", role: "facilitator" } }),
}));
it("loads only entries shared with the authenticated staff account, without a client browsing control", async () => {
  (api.get as jest.Mock).mockResolvedValue({
    data: {
      entries: [
        {
          id: "entry",
          clientName: "Own consenting client",
          title: "Shared version",
          text: "Explicitly shared words",
          version: 3,
          sharedAt: "2026-10-12",
        },
      ],
    },
  });
  render(<IntegrationCoach />);
  expect(
    await screen.findByText("Explicitly shared words"),
  ).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith("/integration/coach/shared-journals");
  expect(screen.queryByText("Coach configuration")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});
