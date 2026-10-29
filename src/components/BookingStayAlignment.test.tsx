import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BookingStayAlignment from "./BookingStayAlignment";
import { bookingsApi } from "../services/api";
jest.mock("../services/api", () => ({
  bookingsApi: { repairRetreatAlignment: jest.fn() },
}));
const booking = {
  _id: "booking",
  rescheduleHistory: [{}],
  bookingType: "full_retreat",
};
it("explicitly aligns historical moved dates, refreshes and allows retry after failure", async () => {
  const refresh = jest.fn().mockResolvedValue(undefined);
  (bookingsApi.repairRetreatAlignment as jest.Mock)
    .mockRejectedValueOnce(Error("offline"))
    .mockResolvedValueOnce({});
  render(
    <BookingStayAlignment booking={booking} isAdmin onRefresh={refresh} />,
  );
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
  expect(refresh).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button"));
  await screen.findByText("Stay dates aligned to the current retreat.");
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(bookingsApi.repairRetreatAlignment).toHaveBeenCalledWith("booking");
});
it("does not offer date replacement to non-admins, boosters or never-moved bookings; rooms block changes", () => {
  const { rerender } = render(
    <BookingStayAlignment
      booking={booking}
      isAdmin={false}
      onRefresh={jest.fn()}
    />,
  );
  expect(screen.queryByRole("button")).toBeNull();
  rerender(
    <BookingStayAlignment
      booking={{ ...booking, bookingType: "booster" }}
      isAdmin
      onRefresh={jest.fn()}
    />,
  );
  expect(screen.queryByRole("button")).toBeNull();
  rerender(
    <BookingStayAlignment
      booking={{ ...booking, rescheduleHistory: [] }}
      isAdmin
      onRefresh={jest.fn()}
    />,
  );
  expect(screen.queryByRole("button")).toBeNull();
  rerender(
    <BookingStayAlignment
      booking={{ ...booking, roomId: "1" }}
      isAdmin
      onRefresh={jest.fn()}
    />,
  );
  expect(screen.getByRole("button")).toBeDisabled();
});
