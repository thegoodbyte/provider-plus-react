import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EkgRequirementStatus from "./EkgRequirementStatus";
import { ekgRequirementApi } from "../services/ekgRequirementApi";
jest.mock("../services/ekgRequirementApi", () => ({
  ekgRequirementApi: { get: jest.fn() },
}));
beforeEach(() => jest.clearAllMocks());
it("renders the server decision and deadline without inferring completion from uploaded files", async () => {
  (ekgRequirementApi.get as jest.Mock).mockResolvedValue({
    data: {
      state: "uploaded",
      label: "Uploaded",
      dueDate: "2027-01-02",
      latestEvidence: { id: "a", version: 2 },
    },
  });
  render(<EkgRequirementStatus bookingId="b" />);
  expect(await screen.findByText("Uploaded")).toHaveAttribute(
    "data-ekg-state",
    "uploaded",
  );
  expect(screen.getByText(/Evidence version 2/)).toBeInTheDocument();
});
it("shows unavailable on failure and recovers only from a new server response", async () => {
  (ekgRequirementApi.get as jest.Mock)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ data: { state: "accepted", label: "Accepted" } });
  render(<EkgRequirementStatus bookingId="b" />);
  await screen.findByText("Status unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Refresh EKG status" }));
  await screen.findByText("Accepted");
  expect(ekgRequirementApi.get).toHaveBeenCalledTimes(2);
});
it("rejects a late result belonging to a previously selected booking", async () => {
  let finish: any;
  (ekgRequirementApi.get as jest.Mock)
    .mockReturnValueOnce(new Promise((r) => (finish = r)))
    .mockResolvedValue({ data: { state: "missing", label: "Missing" } });
  const view = render(<EkgRequirementStatus bookingId="old" />);
  await waitFor(() => expect(ekgRequirementApi.get).toHaveBeenCalled());
  view.rerender(<EkgRequirementStatus bookingId="new" />);
  await screen.findByText("Missing");
  finish({ data: { state: "accepted", label: "Accepted" } });
  await waitFor(() =>
    expect(screen.queryByText("Accepted")).not.toBeInTheDocument(),
  );
});

it('keeps caution visible separately from a missing test date',async()=>{
 (ekgRequirementApi.get as jest.Mock).mockResolvedValue({data:{state:'validity_unknown',label:'Test date needs confirmation',validity:'unknown',satisfied:false,latestReview:{result:'caution'}}});
 render(<EkgRequirementStatus bookingId="b"/>);await screen.findByText('Test date needs confirmation');expect(screen.getByText(/Medical review: Accepted — caution/)).toBeInTheDocument();
});
