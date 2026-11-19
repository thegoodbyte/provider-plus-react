import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppleLayout from "./AppleLayout";

// AppleLayout renders dozens of lazily-loaded route pages inside its own
// <Routes>/<Route> tree. We only care about the always-mounted header shell
// here, so the react-router-dom Routes/Route primitives are stubbed out to
// avoid pulling in that whole lazy-loaded surface area. useNavigate is also
// replaced with a spy so we can assert on exactly what AppleLayout asks the
// router to do, without depending on real navigation actually occurring.
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Routes: () => null,
    Route: () => null,
  };
});

jest.mock("./EnvironmentBanner", () => ({
  __esModule: true,
  EnvironmentBadge: () => <span data-testid="env-badge">Production</span>,
  default: (props: { hideProductionBadge?: boolean }) =>
    props.hideProductionBadge ? null : <span data-testid="env-banner-full">full</span>,
}));

const mockLogout = jest.fn();
let mockUser: any = {
  id: "admin-1",
  firstName: "Ada",
  lastName: "Min",
  email: "admin@example.com",
  role: "admin",
};
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: mockUser,
    login: jest.fn(),
    storeSession: jest.fn(),
    logout: mockLogout,
    startMedicalStaffPreview: jest.fn().mockResolvedValue(undefined),
    startUserImpersonation: jest.fn(),
    stopImpersonation: jest.fn(),
    loading: false,
  }),
}));

let mockWorkModeActive = false;
jest.mock("../workModes/WorkModeContext", () => ({
  useWorkMode: () => ({
    data: null,
    active: mockWorkModeActive,
    error: "",
    refresh: jest.fn(),
    enter: jest.fn(),
    exit: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock("../services/api", () => {
  const actual = jest.requireActual("../services/api");
  return {
    ...actual,
    api: { ...actual.api, get: jest.fn().mockResolvedValue({ data: {} }), post: jest.fn().mockResolvedValue({ data: {} }) },
    configSummaryApi: { ...actual.configSummaryApi, get: jest.fn().mockResolvedValue({ data: {} }) },
    retreatsApi: { ...actual.retreatsApi, getAll: jest.fn().mockResolvedValue({ data: [] }) },
    bookingsApi: { ...actual.bookingsApi, getByRetreatWithDetails: jest.fn().mockResolvedValue({ data: [] }) },
  };
});

const renderLayout = (initialEntry = "/admin/launcher") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppleLayout />
    </MemoryRouter>,
  );

beforeAll(() => {
  // jsdom doesn't implement Element.scrollTo; AppleLayout calls it on the
  // scrollable main content ref whenever the route changes.
  if (!(Element.prototype as any).scrollTo) {
    (Element.prototype as any).scrollTo = jest.fn();
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  mockWorkModeActive = false;
  mockUser = {
    id: "admin-1",
    firstName: "Ada",
    lastName: "Min",
    email: "admin@example.com",
    role: "admin",
  };
  localStorage.clear();
});

describe("AppleLayout header", () => {
  it("renders breadcrumb, search, Quick Menu and account menu all inside one workspace-header", () => {
    renderLayout();
    const header = document.querySelector("header.workspace-header");
    expect(header).toBeTruthy();
    const scoped = within(header as HTMLElement);

    expect(scoped.getByText(/Workspace/)).toBeInTheDocument();
    expect(scoped.getByRole("textbox", { name: "Global search" })).toBeInTheDocument();
    expect(scoped.getByRole("button", { name: "Quick Menu" })).toBeInTheDocument();
    expect(scoped.getByLabelText("Account and tools")).toBeInTheDocument();
  });

  it("renders the EnvironmentBadge inside workspace-header-leading, not in its own row", () => {
    renderLayout();
    const leading = document.querySelector(".workspace-header-leading");
    expect(leading).toBeTruthy();
    expect(within(leading as HTMLElement).getByTestId("env-badge")).toBeInTheDocument();
    // And the full (non-production-tag) EnvironmentBanner mount, if it
    // renders anything at all, lives outside the header, not duplicated
    // inside workspace-header-leading.
    expect(within(leading as HTMLElement).queryByTestId("env-banner-full")).not.toBeInTheDocument();
  });

  it("shows the mode-select dropdown for an admin user in normal mode", () => {
    renderLayout();
    expect(screen.getByLabelText("Work mode")).toBeInTheDocument();
  });

  it("hides the mode-select dropdown while a focused work mode is active", () => {
    mockWorkModeActive = true;
    renderLayout();
    expect(screen.queryByLabelText("Work mode")).not.toBeInTheDocument();
  });

  it("hides the mode-select dropdown for a non-admin role", () => {
    mockUser = { ...mockUser, role: "facilitator" };
    renderLayout();
    expect(screen.queryByLabelText("Work mode")).not.toBeInTheDocument();
  });

  it('clicking "Choose work mode" navigates to /admin/focus, preserving the old staff-focus-banner behavior', () => {
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: "Choose work mode" }));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/focus");
  });

  it('clicking "All tools" calls staffFocus.setMode(\'all\') and navigates to /admin/launcher', () => {
    // Seed a non-"all" focus so the click has an observable effect on the
    // rendered label, in addition to the navigate() call.
    localStorage.setItem("staff-focus:admin-1", "medical");
    renderLayout();

    const details = screen.getByLabelText("Work mode").closest("details") as HTMLDetailsElement;
    expect(within(details).getByText("Process medicals")).toBeInTheDocument();
    expect(within(details).getByRole("button", { name: "Return to focus" })).toBeInTheDocument();

    details.setAttribute("open", "true");
    fireEvent.click(within(details).getByRole("button", { name: "All tools" }));

    expect(mockNavigate).toHaveBeenCalledWith("/admin/launcher");
    expect(localStorage.getItem("staff-focus:admin-1")).toBe("all");
    // Same close-on-click-inside pattern as the existing account menu.
    expect(details.hasAttribute("open")).toBe(false);
  });

  it("no longer renders the old staff-focus-banner element anywhere", () => {
    renderLayout();
    expect(document.querySelector(".staff-focus-banner")).toBeNull();
  });
});
