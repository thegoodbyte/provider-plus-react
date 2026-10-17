import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import EnvironmentBanner, { captureLinks } from "./EnvironmentBanner";
import { environmentApi } from "../services/api";
jest.mock("../services/api", () => ({
  environmentApi: {
    status: jest.fn(),
    capture: jest.fn(),
    capturedMessage: jest.fn(),
  },
}));
let mockRole = "admin";
jest.mock("../services/authService", () => ({
  authService: { getUser: () => ({ role: mockRole }) },
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockRole = "admin";
  (global as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  (environmentApi.status as jest.Mock).mockResolvedValue({
    data: { environment: "development", production: false, enabledJobs: [] },
  });
  (environmentApi.capture as jest.Mock).mockResolvedValue({
    data: [
      {
        id: "capture1",
        capturedAt: "2026-10-11T10:00:00Z",
        subject: "Test submission",
        attachmentCount: 1,
      },
    ],
  });
  (environmentApi.capturedMessage as jest.Mock).mockResolvedValue({
    data: {
      subject: "Test submission",
      capturedAt: "2026-10-11T10:00:00Z",
      intendedRecipients: { to: ["real@example.com"], cc: [], bcc: [] },
      bodyText: "Welcome. Open http://localhost:3005/login?token=test",
      bodyHtml: "",
      attachments: [],
    },
  });
});
it("shows the development environment and lets admins inspect captured messages and test links", async () => {
  render(<EnvironmentBanner />);
  await screen.findByText("DEVELOPMENT · Test environment");
  expect(
    screen.getByText(/Emails captured.*Jobs: disabled/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByText("Capture inbox"));
  fireEvent.click(await screen.findByText("Test submission"));
  await screen.findByText(
    /Intended recipients \(no delivery\): real@example.com/,
  );
  expect(
    screen.getByRole("link", {
      name: "http://localhost:3005/login?token=test",
    }),
  ).toHaveAttribute("href", "http://localhost:3005/login?token=test");
});
it("does not offer the admin inbox to a facilitator", async () => {
  mockRole = "facilitator";
  render(<EnvironmentBanner />);
  await screen.findByText("DEVELOPMENT · Test environment");
  expect(screen.queryByText("Capture inbox")).not.toBeInTheDocument();
});
it("clearly labels production without capture actions", async () => {
  (environmentApi.status as jest.Mock).mockResolvedValue({
    data: { environment: "production", production: true },
  });
  render(<EnvironmentBanner />);
  await screen.findByText("Production");
  expect(screen.queryByText("Capture inbox")).not.toBeInTheDocument();
});
it("does not guess an environment when the API fails", async () => {
  (environmentApi.status as jest.Mock).mockRejectedValue(new Error("offline"));
  render(<EnvironmentBanner />);
  await screen.findByText("Environment status unavailable.");
  expect(screen.queryByText("Production")).not.toBeInTheDocument();
});
// PPVC-829: a malformed response (e.g. an empty array, which a generic
// network-mocking "unmatched route" fallback commonly returns) must not
// crash this banner -- it sits in the persistent app shell, outside any
// per-route error boundary, so an unhandled throw here used to blank the
// entire app.
it("PPVC-829: renders nothing (not a crash) when the status response is malformed", async () => {
  (environmentApi.status as jest.Mock).mockResolvedValue({ data: [] });
  const { container } = render(<EnvironmentBanner />);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(container).toBeEmptyDOMElement();
  expect(screen.queryByText("Production")).not.toBeInTheDocument();
});
it("does not create clickable live checkout or production app links", () => {
  expect(
    captureLinks(
      "https://checkout.revolut.com/pay/live https://retreatengine.com/login http://localhost:3000/test https://dev.retreatengine.com/test",
    ),
  ).toEqual([
    "http://localhost:3000/test",
    "https://dev.retreatengine.com/test",
  ]);
});
