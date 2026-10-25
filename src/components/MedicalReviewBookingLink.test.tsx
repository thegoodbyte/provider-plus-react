import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MedicalReviewBookingLink from "./MedicalReviewBookingLink";
import { medicalReviewRequestsApi } from "../services/api";
jest.mock("../services/api", () => ({
  medicalReviewRequestsApi: {
    previewBookingLink: jest.fn(),
    linkBooking: jest.fn(),
  },
}));
jest.mock("antd", () => ({
  Modal: ({ open, children }: any) =>
    open ? <div role="dialog">{children}</div> : null,
}));
const base = {
  bookings: [
    {
      id: "booking",
      bookingNumber: 1929,
      retreatName: "Test Retreat",
      status: "confirmed",
      startDate: "2026-11-17",
    },
  ],
  documents: [{ id: "artifact", number: 2929, title: "EKG", bookingId: null }],
};
beforeEach(() => {
  jest.clearAllMocks();
  (medicalReviewRequestsApi.previewBookingLink as jest.Mock).mockImplementation(
    (_id, bookingId) =>
      Promise.resolve({
        data: {
          ...base,
          ...(bookingId ? { bookingId, token: "a".repeat(64) } : {}),
        },
      }),
  );
});
it("previews the affected documents and requires explicit booking confirmation", async () => {
  const refreshed = jest.fn().mockResolvedValue(undefined);
  (medicalReviewRequestsApi.linkBooking as jest.Mock).mockResolvedValue({
    data: { linked: true },
  });
  render(
    <MemoryRouter>
      <MedicalReviewBookingLink
        requestId="review"
        prefix="/admin"
        onLinked={refreshed}
      />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(medicalReviewRequestsApi.previewBookingLink).toHaveBeenCalled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Link to booking" }));
  expect(await screen.findByText("#2929 · EKG")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Confirm booking link" }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Client booking"), {
    target: { value: "booking" },
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Confirm booking link" }),
    ).toBeEnabled(),
  );
  expect(medicalReviewRequestsApi.linkBooking).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm booking link" }));
  await waitFor(() =>
    expect(medicalReviewRequestsApi.linkBooking).toHaveBeenCalledWith(
      "review",
      "booking",
      "a".repeat(64),
    ),
  );
  expect(await screen.findByText(/Booking link saved/)).toBeInTheDocument();
  expect(refreshed).toHaveBeenCalled();
});
it("keeps a rejected link visible and requires a fresh preview before retrying", async () => {
  (medicalReviewRequestsApi.linkBooking as jest.Mock).mockRejectedValue({
    response: { data: { message: "Document was linked elsewhere" } },
  });
  render(
    <MemoryRouter>
      <MedicalReviewBookingLink
        requestId="review"
        prefix="/admin"
        onLinked={jest.fn()}
      />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(medicalReviewRequestsApi.previewBookingLink).toHaveBeenCalled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Link to booking" }));
  fireEvent.change(await screen.findByLabelText("Client booking"), {
    target: { value: "booking" },
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Confirm booking link" }),
    ).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm booking link" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Document was linked elsewhere",
  );
  expect(
    screen.getByRole("button", { name: "Confirm booking link" }),
  ).toBeDisabled();
});
